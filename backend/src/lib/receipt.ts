/**
 * To'lov cheki: HTML (brauzerda ochish, chop etish) va email uchun bitta andoza.
 * Til foydalanuvchi tanlagan tilda (uz/ru/en). Telefon ekraniga moslashgan.
 */
type Lang = 'uz' | 'ru' | 'en';

const T: Record<Lang, Record<string, string>> = {
  uz: {
    title: "To'lov cheki", no: 'Chek raqami', status: 'Holat', payer: "To'lovchi", lesson: 'Dars', teacher: "O'qituvchi",
    lessonTime: 'Dars vaqti', method: "To'lov usuli", paidAt: "To'langan vaqt", amount: 'Summa', sum: "so'm",
    note: "Karta ma'lumotlari EduTutor serverlarida saqlanmaydi.", print: 'Chop etish', thanks: "To'lovingiz uchun rahmat!",
    paid: "To'langan", pending: 'Kutilmoqda', processing: 'Jarayonda', failed: 'Muvaffaqiyatsiz', cancelled: 'Bekor qilingan', refunded: 'Qaytarilgan',
    sandbox: "Sinov to'lovi", payme: 'Payme', click: 'Click', manual: "Qo'lda",
  },
  ru: {
    title: 'Чек об оплате', no: 'Номер чека', status: 'Статус', payer: 'Плательщик', lesson: 'Урок', teacher: 'Преподаватель',
    lessonTime: 'Время урока', method: 'Способ оплаты', paidAt: 'Оплачено', amount: 'Сумма', sum: 'сум',
    note: 'Данные карты не хранятся на серверах EduTutor.', print: 'Распечатать', thanks: 'Спасибо за оплату!',
    paid: 'Оплачен', pending: 'Ожидает', processing: 'В обработке', failed: 'Не прошёл', cancelled: 'Отменён', refunded: 'Возвращён',
    sandbox: 'Тестовая оплата', payme: 'Payme', click: 'Click', manual: 'Вручную',
  },
  en: {
    title: 'Payment receipt', no: 'Receipt no.', status: 'Status', payer: 'Payer', lesson: 'Lesson', teacher: 'Tutor',
    lessonTime: 'Lesson time', method: 'Payment method', paidAt: 'Paid at', amount: 'Amount', sum: 'UZS',
    note: 'Card details are never stored on EduTutor servers.', print: 'Print', thanks: 'Thank you for your payment!',
    paid: 'Paid', pending: 'Pending', processing: 'Processing', failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded',
    sandbox: 'Test payment', payme: 'Payme', click: 'Click', manual: 'Manual',
  },
};

export type ReceiptPayment = {
  receiptNo: string;
  status: string;
  provider: string;
  amount: unknown;
  paidAt: Date | null;
  user: { fullName: string };
  booking: { lesson: { title: string }; teacher: { user: { fullName: string } }; session: { startAt: Date } };
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function receiptText(p: ReceiptPayment, lang: Lang = 'uz') {
  const t = T[lang] ?? T.uz;
  const intl = lang === 'en' ? 'en-GB' : lang === 'ru' ? 'ru-RU' : 'uz-UZ';
  const fmt = (d?: Date | null) => (d ? new Intl.DateTimeFormat(intl, { timeZone: 'Asia/Tashkent', dateStyle: 'long', timeStyle: 'short' }).format(d) : '—');
  const amount = `${Number(p.amount).toLocaleString('ru-RU')} ${t.sum}`;
  return { t, fmt, amount };
}

/** Chekning ichki qismi (email va sahifa uchun umumiy) */
export function receiptBody(p: ReceiptPayment, lang: Lang = 'uz') {
  const { t, fmt, amount } = receiptText(p, lang);
  const ok = p.status === 'paid';
  const row = (k: string, v: string) =>
    `<tr><td style="padding:10px 0;color:#64748B;border-bottom:1px dashed #E5E7EB">${k}</td><td style="padding:10px 0;text-align:right;font-weight:600;border-bottom:1px dashed #E5E7EB">${v}</td></tr>`;
  return `<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(109,40,217,.12);font-family:Inter,Arial,sans-serif;color:#111827">
<div style="background:linear-gradient(135deg,#6D28D9,#8B5CF6);color:#fff;padding:22px 24px">
<div style="font-size:20px;font-weight:800">🎓 EduTutor</div>
<div style="opacity:.85;font-size:13px;margin-top:2px">${t.title}</div>
<div style="font-size:30px;font-weight:800;margin-top:14px">${amount}</div>
<div style="display:inline-block;margin-top:8px;padding:4px 12px;border-radius:99px;background:${ok ? '#DCFCE7' : '#FEF3C7'};color:${ok ? '#166534' : '#92400E'};font-size:12px;font-weight:700">${ok ? '✓ ' : ''}${t[p.status] ?? p.status}</div>
</div>
<div style="padding:8px 24px 20px"><table style="width:100%;border-collapse:collapse;font-size:14px">
${row(t.no, esc(p.receiptNo))}${row(t.payer, esc(p.user.fullName))}${row(t.lesson, esc(p.booking.lesson.title))}
${row(t.teacher, esc(p.booking.teacher.user.fullName))}${row(t.lessonTime, fmt(p.booking.session.startAt))}
${row(t.method, t[p.provider] ?? p.provider)}${row(t.paidAt, fmt(p.paidAt))}
</table>
<p style="margin:16px 0 0;font-size:13px;font-weight:700;color:#6D28D9">${ok ? t.thanks : ''}</p>
<p style="margin:6px 0 0;font-size:12px;color:#94A3B8">${t.note}</p></div></div>`;
}

/** To'liq sahifa (brauzerda ochiladi): telefonga moslashgan, chop etish tugmasi bilan */
export function receiptPage(p: ReceiptPayment, lang: Lang = 'uz') {
  const { t } = receiptText(p, lang);
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.title} ${esc(p.receiptNo)}</title>
<style>body{margin:0;background:#F5F3FF;padding:20px 14px}@media print{body{background:#fff;padding:0}.np{display:none}}</style></head>
<body>${receiptBody(p, lang)}
<div class="np" style="max-width:480px;margin:16px auto 0;text-align:center">
<button onclick="print()" style="padding:12px 22px;border:0;border-radius:14px;background:#6D28D9;color:#fff;font-weight:700;font-size:15px;cursor:pointer">${t.print}</button></div>
</body></html>`;
}

export function receiptMail(to: string, p: ReceiptPayment, lang: Lang = 'uz') {
  const { t, amount } = receiptText(p, lang);
  return {
    to,
    subject: `${t.title} ${p.receiptNo} — ${amount}`,
    html: `<div style="background:#F5F3FF;padding:20px 10px">${receiptBody(p, lang)}</div>`,
    text: `${t.title} ${p.receiptNo}\n${t.lesson}: ${p.booking.lesson.title}\n${t.amount}: ${amount}`,
  };
}
