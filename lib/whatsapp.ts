export const WHATSAPP_AUTOMATION_KEY = "whatsapp_message";

export function normalizeWhatsAppPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export function isValidWhatsAppPhone(value: string) {
  const digits = normalizeWhatsAppPhone(value);
  return digits.length >= 12 && digits.length <= 15;
}

export function formatWhatsAppPhone(value: string) {
  const digits = normalizeWhatsAppPhone(value);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const area = digits.slice(2, 4);
    const number = digits.slice(4);
    const split = number.length === 9 ? 5 : 4;
    return `+55 (${area}) ${number.slice(0, split)}-${number.slice(split)}`;
  }
  return `+${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const digits = normalizeWhatsAppPhone(phone);
  return `whatsapp://send?phone=${digits}&text=${encodeURIComponent(message)}`;
}
