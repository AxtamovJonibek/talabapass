/**
 * Parol qoidalari — saytdagi `src/lib/password.ts` nusxasi (server baribir o'zi tekshiradi).
 * Chetidagi bo'shliqlar hisobga olinmaydi.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const clean = (value: string) => value.trim();

/** "Kamida 8 ta belgi", "Harf va raqam birga" */
export function passwordRules(value: string) {
  const p = clean(value);
  return { length: p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX, mix: /\p{L}/u.test(p) && /\p{Nd}/u.test(p) };
}

/** Qoidalar alohida: kamida 8 belgi, bitta harf, bitta raqam */
export function passwordChecks(value: string) {
  const p = clean(value);
  return { length: p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX, letter: /\p{L}/u.test(p), digit: /\p{Nd}/u.test(p) };
}

export function isValidPassword(value: string): boolean {
  const r = passwordRules(value);
  return r.length && r.mix;
}

/** 0 — bo'sh, 1 — qoidaga mos emas, 2 — mos, 3–4 — katta+kichik harf, belgi, 12+ uzunlik. */
export function passwordStrength(value: string): 0 | 1 | 2 | 3 | 4 {
  const p = clean(value);
  if (!p) return 0;
  if (!isValidPassword(p)) return 1;
  const bonus = [/\p{Lu}/u.test(p) && /\p{Ll}/u.test(p), /[^\p{L}\p{Nd}]/u.test(p), p.length >= 12].filter(Boolean).length;
  return Math.min(4, 2 + bonus) as 2 | 3 | 4;
}

export const samePassword = (a: string, b: string) => clean(a) === clean(b);
