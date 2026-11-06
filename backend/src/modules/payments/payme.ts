/**
 * Payme Merchant API (JSON-RPC 2.0) — https://developer.help.paycom.uz/
 * Payme serveri shu endpointga so'rov yuboradi; to'lov holati FAQAT shu yerda o'zgaradi.
 */
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { safeEqual } from '../../common/crypto';
import { toTiyin } from '../../common/money';
import { afterPaidNotify, markPaid } from './payments.service';

const TIMEOUT_MS = 12 * 3600_000;

const msg = (uz: string, ru: string, en: string) => ({ uz, ru, en });
const E = {
  auth: { code: -32504, message: msg('Ruxsat yo\'q', 'Недостаточно привилегий', 'Insufficient privileges') },
  method: { code: -32601, message: msg('Metod topilmadi', 'Метод не найден', 'Method not found') },
  amount: { code: -31001, message: msg('Noto\'g\'ri summa', 'Неверная сумма', 'Incorrect amount') },
  notFoundTx: { code: -31003, message: msg('Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found') },
  cantPerform: { code: -31008, message: msg('Amalni bajarib bo\'lmaydi', 'Невозможно выполнить операцию', 'Unable to perform operation') },
  account: { code: -31050, message: msg('Buyurtma topilmadi', 'Заказ не найден', 'Order not found'), data: 'payment_id' },
  busy: { code: -31051, message: msg('Buyurtma band', 'Заказ уже ожидает оплаты', 'Order is busy'), data: 'payment_id' },
};

function reply(res: Response, id: unknown, result?: unknown, error?: unknown) {
  res.json(error ? { jsonrpc: '2.0', id, error } : { jsonrpc: '2.0', id, result });
}

function authorized(req: Request) {
  const h = req.get('authorization') ?? '';
  if (!h.startsWith('Basic ') || !env.PAYME_SECRET_KEY) return false;
  const decoded = Buffer.from(h.slice(6), 'base64').toString();
  return safeEqual(decoded, `Paycom:${env.PAYME_SECRET_KEY}`);
}

async function findPayment(account: any) {
  const id = account?.payment_id;
  if (!id || typeof id !== 'string') return null;
  return prisma.payment.findUnique({ where: { id }, include: { booking: true } });
}

export async function paymeHandler(req: Request, res: Response) {
  const { method, params = {}, id } = req.body ?? {};
  if (!authorized(req)) return reply(res, id, undefined, E.auth);

  switch (method) {
    case 'CheckPerformTransaction': {
      const p = await findPayment(params.account);
      if (!p || p.status !== 'pending' || !['requested', 'confirmed'].includes(p.booking.status)) return reply(res, id, undefined, E.account);
      if (toTiyin(p.amount) !== Number(params.amount)) return reply(res, id, undefined, E.amount);
      return reply(res, id, { allow: true });
    }
    case 'CreateTransaction': {
      const existing = await prisma.paymentTransaction.findUnique({ where: { provider_externalId: { provider: 'payme', externalId: String(params.id) } } });
      if (existing) {
        if (existing.state !== 1) return reply(res, id, undefined, E.cantPerform);
        if (Date.now() - existing.createdAt.getTime() > TIMEOUT_MS) {
          await prisma.paymentTransaction.update({ where: { id: existing.id }, data: { state: -1, reason: 4, cancelledAt: new Date() } });
          return reply(res, id, undefined, E.cantPerform);
        }
        return reply(res, id, { create_time: existing.createdAt.getTime(), transaction: existing.id, state: 1 });
      }
      const p = await findPayment(params.account);
      if (!p || p.status !== 'pending') return reply(res, id, undefined, E.account);
      if (toTiyin(p.amount) !== Number(params.amount)) return reply(res, id, undefined, E.amount);
      const active = await prisma.paymentTransaction.findFirst({ where: { paymentId: p.id, provider: 'payme', state: 1 } });
      if (active) return reply(res, id, undefined, E.busy);
      const tx = await prisma.paymentTransaction.create({
        data: { paymentId: p.id, provider: 'payme', externalId: String(params.id), state: 1, amount: p.amount, raw: params },
      });
      await prisma.payment.update({ where: { id: p.id }, data: { status: 'processing' } });
      return reply(res, id, { create_time: tx.createdAt.getTime(), transaction: tx.id, state: 1 });
    }
    case 'PerformTransaction': {
      const tx = await prisma.paymentTransaction.findUnique({ where: { provider_externalId: { provider: 'payme', externalId: String(params.id) } } });
      if (!tx) return reply(res, id, undefined, E.notFoundTx);
      if (tx.state === 2) return reply(res, id, { transaction: tx.id, perform_time: tx.performedAt!.getTime(), state: 2 });
      if (tx.state !== 1) return reply(res, id, undefined, E.cantPerform);
      if (Date.now() - tx.createdAt.getTime() > TIMEOUT_MS) {
        await prisma.paymentTransaction.update({ where: { id: tx.id }, data: { state: -1, reason: 4, cancelledAt: new Date() } });
        return reply(res, id, undefined, E.cantPerform);
      }
      const performedAt = new Date();
      await prisma.$transaction(async (t) => {
        await t.paymentTransaction.update({ where: { id: tx.id }, data: { state: 2, performedAt } });
        await markPaid(t, tx.paymentId);
      });
      await afterPaidNotify(tx.paymentId);
      return reply(res, id, { transaction: tx.id, perform_time: performedAt.getTime(), state: 2 });
    }
    case 'CancelTransaction': {
      const tx = await prisma.paymentTransaction.findUnique({ where: { provider_externalId: { provider: 'payme', externalId: String(params.id) } } });
      if (!tx) return reply(res, id, undefined, E.notFoundTx);
      if (tx.state < 0) return reply(res, id, { transaction: tx.id, cancel_time: tx.cancelledAt!.getTime(), state: tx.state });
      const cancelledAt = new Date();
      const newState = tx.state === 2 ? -2 : -1;
      await prisma.$transaction(async (t) => {
        await t.paymentTransaction.update({ where: { id: tx.id }, data: { state: newState, cancelledAt, reason: Number(params.reason) || null } });
        if (newState === -2) {
          await t.payment.update({ where: { id: tx.paymentId }, data: { status: 'refunded' } });
          await t.teacherEarning.updateMany({ where: { paymentId: tx.paymentId }, data: { status: 'reversed' } });
          await t.refund.updateMany({ where: { paymentId: tx.paymentId, status: 'approved' }, data: { status: 'processed', processedAt: cancelledAt } });
        } else {
          await t.payment.update({ where: { id: tx.paymentId }, data: { status: 'cancelled' } });
        }
      });
      return reply(res, id, { transaction: tx.id, cancel_time: cancelledAt.getTime(), state: newState });
    }
    case 'CheckTransaction': {
      const tx = await prisma.paymentTransaction.findUnique({ where: { provider_externalId: { provider: 'payme', externalId: String(params.id) } } });
      if (!tx) return reply(res, id, undefined, E.notFoundTx);
      return reply(res, id, {
        create_time: tx.createdAt.getTime(),
        perform_time: tx.performedAt?.getTime() ?? 0,
        cancel_time: tx.cancelledAt?.getTime() ?? 0,
        transaction: tx.id,
        state: tx.state,
        reason: tx.reason,
      });
    }
    case 'GetStatement': {
      const txs = await prisma.paymentTransaction.findMany({
        where: { provider: 'payme', createdAt: { gte: new Date(Number(params.from)), lte: new Date(Number(params.to)) } },
        orderBy: { createdAt: 'asc' },
      });
      return reply(res, id, {
        transactions: txs.map((tx) => ({
          id: tx.externalId,
          time: (tx.raw as any)?.time ?? tx.createdAt.getTime(),
          amount: toTiyin(tx.amount),
          account: { payment_id: tx.paymentId },
          create_time: tx.createdAt.getTime(),
          perform_time: tx.performedAt?.getTime() ?? 0,
          cancel_time: tx.cancelledAt?.getTime() ?? 0,
          transaction: tx.id,
          state: tx.state,
          reason: tx.reason,
        })),
      });
    }
    default:
      return reply(res, id, undefined, E.method);
  }
}
