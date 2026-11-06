/**
 * Ilova qulfi (bank ilovalaridagidek):
 *  - O'rnatilgan ilova (PWA) ichida foydalanuvchi 4 xonali kirish kodi (PIN) o'rnatadi
 *  - Qurilmada barmoq izi / Face ID bo'lsa — WebAuthn (platform authenticator) orqali ochish
 *  - Ilova fon rejimiga o'tganda yoki 5 daqiqa faolsizlikdan keyin sessiya serverda "qulflanadi"
 *  - Qulflangan sessiya bilan hech qanday API ishlamaydi (423), faqat PIN/biometrik bilan ochiladi
 *  - 5 marta noto'g'ri PIN — sessiya bekor qilinadi, parol bilan qayta kirish kerak
 */
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { ah, ok, parse } from '../../common/http';
import { badRequest, unauthorized } from '../../common/errors';
import { requireAuth, requireAuthAllowLocked } from '../../middleware/auth';
import { authLimiter } from '../../middleware/security';
import { clearAuthCookies } from './auth.service';

export const appLockRouter = Router();

const PIN_MAX_FAILS = 5;
const pinSchema = z.string().regex(/^\d{4}$/, 'PIN 4 ta raqam');

const origins = () => Array.from(new Set([env.APP_URL, ...env.corsOrigins]));

async function sessionDevice(sid: string) {
  const s = await prisma.authSession.findUniqueOrThrow({ where: { id: sid } });
  const device = s.deviceId ? await prisma.appDevice.findUnique({ where: { id: s.deviceId } }) : null;
  return { session: s, device };
}

appLockRouter.post(
  '/setup',
  requireAuth,
  ah(async (req, res) => {
    const b = parse(z.object({ pin: pinSchema, deviceName: z.string().max(80).optional() }), req.body);
    if (/^(\d)\1{3}$/.test(b.pin) || ['1234', '4321', '0123'].includes(b.pin)) {
      throw badRequest('PIN_WEAK', 'Juda oddiy kod. Boshqa kod tanlang');
    }
    const { session, device } = await sessionDevice(req.user!.sid);
    const pinHash = await bcrypt.hash(b.pin, 10);
    const d = device
      ? await prisma.appDevice.update({ where: { id: device.id }, data: { pinHash, pinFailed: 0 } })
      : await prisma.appDevice.create({ data: { userId: req.user!.id, name: b.deviceName, pinHash } });
    await prisma.authSession.update({ where: { id: session.id }, data: { deviceId: d.id, requiresUnlock: false } });
    ok(res, { deviceId: d.id, hasPin: true, hasBiometric: !!d.credentialId });
  }),
);

appLockRouter.post(
  '/lock',
  requireAuthAllowLocked,
  ah(async (req, res) => {
    const { session } = await sessionDevice(req.user!.sid);
    if (session.deviceId) await prisma.authSession.update({ where: { id: session.id }, data: { requiresUnlock: true } });
    ok(res, { locked: !!session.deviceId });
  }),
);

appLockRouter.post(
  '/unlock',
  authLimiter,
  requireAuthAllowLocked,
  ah(async (req, res) => {
    const b = parse(z.object({ pin: pinSchema }), req.body);
    const { session, device } = await sessionDevice(req.user!.sid);
    if (!device?.pinHash) throw badRequest('NO_PIN', 'Kirish kodi o\'rnatilmagan');
    if (!(await bcrypt.compare(b.pin, device.pinHash))) {
      const fails = device.pinFailed + 1;
      if (fails >= PIN_MAX_FAILS) {
        await prisma.$transaction([
          prisma.appDevice.delete({ where: { id: device.id } }),
          prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), deviceId: null } }),
        ]);
        clearAuthCookies(res);
        throw unauthorized('PIN_BLOCKED', 'Ko\'p noto\'g\'ri urinish. Parol bilan qayta kiring');
      }
      await prisma.appDevice.update({ where: { id: device.id }, data: { pinFailed: fails } });
      throw badRequest('PIN_INVALID', `Kod noto'g'ri. Qolgan urinishlar: ${PIN_MAX_FAILS - fails}`, { left: PIN_MAX_FAILS - fails });
    }
    await prisma.$transaction([
      prisma.appDevice.update({ where: { id: device.id }, data: { pinFailed: 0, lastUsedAt: new Date() } }),
      prisma.authSession.update({ where: { id: session.id }, data: { requiresUnlock: false, lastActiveAt: new Date() } }),
    ]);
    ok(res, { unlocked: true });
  }),
);

appLockRouter.post(
  '/disable',
  requireAuth,
  ah(async (req, res) => {
    const { session, device } = await sessionDevice(req.user!.sid);
    if (device) {
      await prisma.authSession.updateMany({ where: { deviceId: device.id }, data: { deviceId: null, requiresUnlock: false } });
      await prisma.appDevice.delete({ where: { id: device.id } });
    }
    ok(res, { disabled: true, sessionId: session.id });
  }),
);

/* ---------------------- Barmoq izi (WebAuthn) ---------------------- */

appLockRouter.post(
  '/biometric/register-options',
  requireAuth,
  ah(async (req, res) => {
    const { device } = await sessionDevice(req.user!.sid);
    if (!device?.pinHash) throw badRequest('NO_PIN', 'Avval kirish kodini o\'rnating');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userName: user.email ?? user.phone ?? user.id,
      userDisplayName: user.fullName,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // faqat qurilmaning o'zidagi sensor (barmoq izi / Face ID)
        userVerification: 'required',
        residentKey: 'discouraged', // parol menejeriga "passkey" bo'lib saqlanmaydi — telefonning ekran qulfi oynasi chiqadi
      },
      preferredAuthenticatorType: 'localDevice', // QR-kod / boshqa telefon variantlarini ko'rsatmaslik
      excludeCredentials: device.credentialId ? [{ id: device.credentialId }] : [],
    });
    await prisma.appDevice.update({ where: { id: device.id }, data: { challenge: options.challenge } });
    ok(res, options);
  }),
);

appLockRouter.post(
  '/biometric/register-verify',
  requireAuth,
  ah(async (req, res) => {
    const { device } = await sessionDevice(req.user!.sid);
    if (!device?.challenge) throw badRequest('NO_CHALLENGE');
    const verification = await verifyRegistrationResponse({
      response: req.body?.response,
      expectedChallenge: device.challenge,
      expectedOrigin: origins(),
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw badRequest('BIOMETRIC_FAILED');
    const { credential } = verification.registrationInfo;
    await prisma.appDevice.update({
      where: { id: device.id },
      data: {
        credentialId: credential.id,
        credentialKey: Buffer.from(credential.publicKey),
        credentialCounter: credential.counter,
        transports: credential.transports ?? [],
        challenge: null,
      },
    });
    ok(res, { hasBiometric: true });
  }),
);

appLockRouter.post(
  '/biometric/unlock-options',
  requireAuthAllowLocked,
  ah(async (req, res) => {
    const { device } = await sessionDevice(req.user!.sid);
    if (!device?.credentialId) throw badRequest('NO_BIOMETRIC');
    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      userVerification: 'required',
      allowCredentials: [{ id: device.credentialId, transports: device.transports as any }],
    });
    await prisma.appDevice.update({ where: { id: device.id }, data: { challenge: options.challenge } });
    ok(res, { ...options, hints: ['client-device'] }); // brauzerga: faqat shu qurilmadagi sensor
  }),
);

appLockRouter.post(
  '/biometric/unlock-verify',
  authLimiter,
  requireAuthAllowLocked,
  ah(async (req, res) => {
    const { session, device } = await sessionDevice(req.user!.sid);
    if (!device?.credentialId || !device.credentialKey || !device.challenge) throw badRequest('NO_BIOMETRIC');
    const verification = await verifyAuthenticationResponse({
      response: req.body?.response,
      expectedChallenge: device.challenge,
      expectedOrigin: origins(),
      expectedRPID: env.WEBAUTHN_RP_ID,
      requireUserVerification: true,
      credential: {
        id: device.credentialId,
        publicKey: new Uint8Array(device.credentialKey),
        counter: device.credentialCounter,
        transports: device.transports as any,
      },
    });
    if (!verification.verified) throw unauthorized('BIOMETRIC_FAILED');
    await prisma.$transaction([
      prisma.appDevice.update({
        where: { id: device.id },
        data: { credentialCounter: verification.authenticationInfo.newCounter, challenge: null, pinFailed: 0, lastUsedAt: new Date() },
      }),
      prisma.authSession.update({ where: { id: session.id }, data: { requiresUnlock: false, lastActiveAt: new Date() } }),
    ]);
    ok(res, { unlocked: true });
  }),
);

appLockRouter.post(
  '/biometric/remove',
  requireAuth,
  ah(async (req, res) => {
    const { device } = await sessionDevice(req.user!.sid);
    if (device) {
      await prisma.appDevice.update({
        where: { id: device.id },
        data: { credentialId: null, credentialKey: null, credentialCounter: 0, transports: [] },
      });
    }
    ok(res, { hasBiometric: false });
  }),
);
