/**
 * Ilova paroli qoidalari — forma (brauzer) va server bitta funksiyani ishlatadi (design/app-flow: Parol).
 * Chetidagi bo'shliqlar hisobga olinmaydi (o'rnatishda ham, kirishda ham kesiladi).
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordRules = { length: boolean; mix: boolean };

export const cleanPassword = (value: string) => value.trim();

/** "Kamida 8 ta belgi", "Harf va raqam birga" */
export function passwordRules(value: string): PasswordRules {
  const password = cleanPassword(value);
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    mix: /\p{L}/u.test(password) && /\p{Nd}/u.test(password),
  };
}

export function isValidPassword(value: string): boolean {
  const rules = passwordRules(value);
  return rules.length && rules.mix;
}

/**
 * Kuch shkalasi (4 bo'lak): 0 — bo'sh, 1 — qoidaga to'g'ri kelmaydi, 2 — qoidaga mos,
 * 3–4 — qo'shimcha: katta va kichik harf, belgi, 12+ uzunlik (har biri +1, ko'pi 4).
 */
export function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  const password = cleanPassword(value);
  if (!password) return 0;
  if (!isValidPassword(password)) return 1;
  const bonus = [/\p{Lu}/u.test(password) && /\p{Ll}/u.test(password), /[^\p{L}\p{Nd}]/u.test(password), password.length >= 12].filter(Boolean).length;
  return Math.min(4, 2 + bonus) as 2 | 3 | 4;
}

/** "+998901234567" → "+998 90 *** ** 67" (parol ekranida, SMS tasdiqlangandan keyin) */
export function maskPhone(e164: string): string {
  const m = /^\+998(\d{2})\d{5}(\d{2})$/.exec(e164);
  return m ? `+998 ${m[1]} *** ** ${m[2]}` : e164;
}
