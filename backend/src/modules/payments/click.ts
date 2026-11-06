/**
 * Click SHOP API (Prepare / Complete) — https://docs.click.uz/click-api-request/
 * So'rovlar application/x-www-form-urlencoded formatida keladi va MD5 imzo bilan tekshiriladi.
 */
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { md5, safeEqual } from '../../common/crypto';
import { toTiyin } from '../../common/money';
import { afterPaidNotify, markPaid } from './payments.service';

const err = (res: Response, body: Record<string, unknown>, error: number, note: string) =>
  res.json({ ...body, error, error_note: note });

export async function clickPrepare(req: Request, res: Response) {
  const b = req.body ?? {};
  const base = { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id };
  const sign = md5(`${b.click_trans_id}${b.service_id}${env.CLICK_SECRET_KEY}${b.merchant_trans_id}${b.amount}${b.action}${b.sign_time}`);
  if (!env.CLICK_SECRET_KEY || !safeEqual(sign, String(b.sign_string ?? ''))) return err(res, base, -1, 'SIGN CHECK FAILED');
  if (String(b.action) !== '0') return err(res, base, -3, 'Action not found');
  const p = await prisma.payment.findUnique({ where: { id: String(b.merchant_trans_id) }, include: { booking: true } });
  if (!p) return err(res, base, -5, 'Order not found');
  if (p.status === 'paid') return err(res, base, -4, 'Already paid');
  if (p.status !== 'pending' && p.status !== 'processing') return err(res, base, -9, 'Transaction cancelled');
  if (toTiyin(p.amount) !== toTiyin(b.amount)) return err(res, base, -2, 'Incorrect parameter amount');
  const tx = await prisma.paymentTransaction.upsert({
    where: { provider_externalId: { provider: 'click', externalId: String(b.click_trans_id) } },
    create: { paymentId: p.id, provider: 'click', externalId: String(b.click_trans_id), state: 1, amount: p.amount, raw: b },
    update: {},
  });
  await prisma.payment.update({ where: { id: p.id }, data: { status: 'processing' } });
  return res.json({ ...base, merchant_prepare_id: tx.id, error: 0, error_note: 'Success' });
}

export async function clickComplete(req: Request, res: Response) {
  const b = req.body ?? {};
  const base = { click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id };
  const sign = md5(
    `${b.click_trans_id}${b.service_id}${env.CLICK_SECRET_KEY}${b.merchant_trans_id}${b.merchant_prepare_id}${b.amount}${b.action}${b.sign_time}`,
  );
  if (!env.CLICK_SECRET_KEY || !safeEqual(sign, String(b.sign_string ?? ''))) return err(res, base, -1, 'SIGN CHECK FAILED');
  if (String(b.action) !== '1') return err(res, base, -3, 'Action not found');
  const tx = await prisma.paymentTransaction.findUnique({ where: { id: String(b.merchant_prepare_id) } });
  if (!tx || tx.externalId !== String(b.click_trans_id)) return err(res, base, -6, 'Transaction does not exist');
  if (tx.state === 2) return err(res, { ...base, merchant_confirm_id: tx.id }, -4, 'Already paid');
  if (tx.state < 0) return err(res, base, -9, 'Transaction cancelled');
  if (toTiyin(tx.amount) !== toTiyin(b.amount)) return err(res, base, -2, 'Incorrect parameter amount');
  if (Number(b.error) < 0) {
    await prisma.$transaction([
      prisma.paymentTransaction.update({ where: { id: tx.id }, data: { state: -1, cancelledAt: new Date() } }),
      prisma.payment.update({ where: { id: tx.paymentId }, data: { status: 'failed' } }),
    ]);
    return err(res, base, -9, 'Transaction cancelled');
  }
  await prisma.$transaction(async (t) => {
    await t.paymentTransaction.update({ where: { id: tx.id }, data: { state: 2, performedAt: new Date() } });
    await markPaid(t, tx.paymentId);
  });
  await afterPaidNotify(tx.paymentId);
  return res.json({ ...base, merchant_confirm_id: tx.id, error: 0, error_note: 'Success' });
}
