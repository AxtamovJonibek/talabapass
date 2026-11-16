/** "901234567" → "+998901234567" (server E.164 kutadi) */
export const toE164 = (digits: string) => `+998${digits}`;

/** "901234567" → "+998 90 123 45 67" */
export function displayPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^998(?=\d{9}$)/, "");
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`.trim();
}

/** "+998901234567" → "901234567" */
export const localDigits = (e164: string) => e164.replace(/\D/g, "").replace(/^998/, "");

/** Profil ostidagi aloqa qatori: raqam yoki (Google/Apple bilan ochilgan, raqamsiz hisobda) email */
export const contactLine = (me: { phone: string | null; email: string | null }) => (me.phone ? displayPhone(localDigits(me.phone)) : (me.email ?? ""));
