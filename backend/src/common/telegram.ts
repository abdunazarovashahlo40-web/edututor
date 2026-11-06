import crypto from 'crypto';

/** Telegram Login Widget: https://core.telegram.org/widgets/login#checking-authorization */
export function verifyTelegram(data: Record<string, string>, botToken: string) {
  const { hash, ...rest } = data;
  const check = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(check).digest('hex');
  const fresh = Date.now() / 1000 - Number(rest.auth_date) < 86400;
  return hmac === hash && fresh;
}
