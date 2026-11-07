/**
 * Server bildirishnomalarni o'zbek tilida saqlaydi. Bu yerda ular foydalanuvchi tanlagan tilga o'giriladi:
 * sarlavha (va o'zgarmas matnli tanasi) andoza bo'yicha topiladi, dars nomi kabi ma'lumotlar o'zgarmay qoladi.
 */
type T = (k: string, v?: Record<string, string | number>) => string;

const EXACT: Record<string, string> = {
  'Profilingiz tasdiqlandi! 🎉': 'teacherApproved',
  'Profilingiz rad etildi': 'teacherRejected',
  "Darsingiz moderatsiyadan o'tmadi": 'lessonModerated',
  'Pul qaytarildi': 'refundApproved',
  "Qaytarish so'rovi rad etildi": 'refundRejected',
  "Pul kartangizga o'tkazildi": 'payoutPaid',
  'Pul yechish rad etildi': 'payoutRejected',
  "Shikoyatingiz ko'rib chiqildi": 'complaintResolved',
  "Dars boshlandi — qo'shiling!": 'lessonStarted',
  'Yangi uy vazifasi': 'hwAssigned',
  'Vazifa topshirildi': 'hwSubmitted',
  'Vazifangiz tekshirildi': 'hwReviewed',
  'Yangi shikoyat': 'newComplaint',
  "Yangi qaytarish so'rovi": 'newRefund',
  "To'lov qabul qilindi": 'paymentPaid',
  "To'lov amalga oshmadi": 'paymentFailed',
  "Yangi bron so'rovi": 'bookingNew',
  "Yangi to'langan bron": 'bookingPaid',
  'Dars tasdiqlandi': 'bookingConfirmed',
  'Bron rad etildi': 'bookingRejected',
  'Dars bekor qilindi': 'bookingCancelled',
  "O'quvchi darsni bekor qildi": 'bookingCancelledByStudent',
  "Dars vaqti o'zgardi": 'bookingRescheduled',
  "Dars yakunlandi — baho qo'ying": 'bookingCompleted',
  "O'qituvchi dars xulosasini yozdi": 'summary',
  'Sinov darsi kafolati ishlatildi': 'guarantee',
  "Yangi o'qituvchi tekshiruvga yubordi": 'teacherSubmitted',
  'Dars 1 soatdan keyin boshlanadi': 'reminder1h',
  "Chek: to'lov tasdiqlandi": 'receipt',
};

const BODY: [RegExp, string][] = [
  [/^Endi darslaringiz o'quvchilarga ko'rinadi$/, 'teacherApprovedBody'],
];

function money(text: string, t: T) {
  return text.replace(/so'm/g, t('common.sum'));
}

export function localizeNotif(n: { title: string; body?: string | null }, t: T) {
  let title = n.title;
  let body = n.body ?? '';
  const key = EXACT[n.title];
  if (key) title = t(`notifs.${key}`);
  else if (n.title.startsWith('Yangi sharh: ')) title = `${t('notifs.newReview')}: ${n.title.slice('Yangi sharh: '.length)}`;
  else if (n.title.startsWith('Yangi xabar: ')) title = t('notifs.newMessage', { name: n.title.slice('Yangi xabar: '.length) });
  for (const [re, k] of BODY) if (re.test(body)) body = t(`notifs.${k}`);
  body = body
    .replace(" — to'lov qaytariladi", ` — ${t('notifs.willRefund')}`)
    .replace(": o'quvchi to'lovni qaytarib oldi", `: ${t('notifs.guaranteeBody')}`);
  return { title, body: money(body, t) };
}
