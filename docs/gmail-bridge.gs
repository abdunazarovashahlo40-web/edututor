/**
 * EduTutor — Gmail "ko'prigi" (Google Apps Script)
 *
 * Nima uchun: Render bepul rejasida SMTP portlari (25/465/587) yopiq.
 * Bu skript Google serverida ishlaydi: sayt unga HTTPS orqali so'rov yuboradi,
 * skript esa xatni sizning Gmail'ingizdan jo'natadi.
 *
 * O'rnatish:
 *  1) script.google.com → New project → shu kodni joylang → Save.
 *  2) Project Settings (tishli g'ildirak) → Script Properties → Add property:
 *       TOKEN = <uzun tasodifiy matn>  (Render'dagi GMAIL_SCRIPT_TOKEN bilan bir xil)
 *  3) Deploy → New deployment → turi: Web app
 *       Execute as: Me      Who has access: Anyone
 *     → Deploy → ruxsat bering → Web app URL (…/exec) ni nusxalang = GMAIL_SCRIPT_URL
 *  Kodni o'zgartirsangiz: Deploy → Manage deployments → Edit → Version: New version.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || data.token !== token) return json_({ ok: false, error: 'unauthorized' });
    if (!data.to || !data.subject) return json_({ ok: false, error: 'bad_request' });

    GmailApp.sendEmail(String(data.to), String(data.subject), String(data.text || ''), {
      htmlBody: data.html ? String(data.html) : undefined,
      name: data.name ? String(data.name) : 'EduTutor',
    });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err).slice(0, 200) });
  }
}

// Brauzerda URL ochilganda tekshiruv uchun
function doGet() {
  return json_({ ok: true, service: 'edututor-gmail-bridge', quotaLeft: MailApp.getRemainingDailyQuota() });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
