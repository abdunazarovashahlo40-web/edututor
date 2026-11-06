/**
 * Platformadan tashqariga chiqib ketishning (va firibgarlikning) oldini olish:
 * o'rtada to'langan bron bo'lmasa, telefon raqamlari va Telegram/link'lar yashiriladi.
 */
export function maskContacts(text: string) {
  return text
    .replace(/(\+?998[\s-]?)?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, '[raqam yashirildi]')
    .replace(/(^|\s)@[a-zA-Z0-9_]{4,}/g, '$1[kontakt yashirildi]')
    .replace(/(https?:\/\/)?(t\.me|wa\.me|telegram\.me)\/\S+/gi, '[havola yashirildi]');
}
