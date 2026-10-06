export const CONSENT_VERSION = '2026-09-20-v1';
export const CONSENT_KEY = 'tgcar.storage-preferences';
const LIFETIME = 180 * 24 * 60 * 60 * 1000;
export function consentRecord(now = Date.now()) {
  return { version: CONSENT_VERSION, necessary: true, analytics: false, savedAt: now, expiresAt: now + LIFETIME };
}
export function readConsent(raw, now = Date.now()) {
  try {
    const data = JSON.parse(raw);
    return data?.version === CONSENT_VERSION && data.necessary === true && data.analytics === false &&
      Number.isFinite(data.savedAt) && data.savedAt <= now && Number.isFinite(data.expiresAt) &&
      data.expiresAt > now && data.expiresAt - data.savedAt === LIFETIME ? data : null;
  } catch { return null; }
}
export function validateClient({name, phone, consent}) {
  if (!name?.trim() || name.trim().length < 2) return 'Укажите имя и фамилию.';
  if (!/^[+\d ()-]+$/.test(phone || '') || !/^\d{10,15}$/.test((phone || '').replace(/\D/g,''))) return 'Проверьте телефон: нужно от 10 до 15 цифр.';
  if (consent !== true) return 'Подтвердите отдельное согласие на обработку данных.';
  return '';
}
