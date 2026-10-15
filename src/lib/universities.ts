/** Universitetlar: nomni solishtirish, qisqa nom, qidiruv — server, skript va brauzer uchun umumiy. */

export type UniversityKindValue = "STATE" | "PRIVATE" | "FOREIGN" | "OTHER";

export type UniversityOption = { id: string; name: string; shortName: string; region: string; kind: UniversityKindValue };

/** Tutuq belgilarining barcha ko'rinishi (‘ ’ ʻ ʼ ` ´) → oddiy ('); kichik harf, ortiqcha bo'sh joysiz. */
export function normalizeName(value: string): string {
  return value
    .replace(/[‘’ʻʼ`´′]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const SKIP_WORDS = new Set(["nomidagi", "nomli", "va", "the", "of", "in", "shahridagi"]);

/** Qisqa nom berilmagan OTM uchun: so'zlarning bosh harflari (kamida 2, ko'pi bilan 6 belgi). */
export function shortNameFor(name: string): string {
  const words = name
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !SKIP_WORDS.has(w.toLowerCase()));
  const initials = words.map((w) => w.charAt(0).toUpperCase()).join("");
  if (words.length === 1) return words[0]!.slice(0, 16);
  return initials.slice(0, 6) || name.slice(0, 6);
}

/** Qidiruv: nom, qisqa nom yoki viloyat; barcha so'zlar (tartibsiz) mos kelishi kerak. Natija tartibi: nom boshidan mos kelganlar oldin. */
export function searchUniversities<T extends Pick<UniversityOption, "name" | "shortName" | "region">>(list: readonly T[], query: string): T[] {
  const words = normalizeName(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...list];
  const scored: [number, T][] = [];
  for (const u of list) {
    const name = normalizeName(u.name);
    const haystack = `${name} ${normalizeName(u.shortName)} ${normalizeName(u.region)}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    scored.push([name.startsWith(words[0]!) || normalizeName(u.shortName).startsWith(words[0]!) ? 0 : 1, u]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, u]) => u);
}

export const UNIVERSITY_NAME_MIN = 3;
export const UNIVERSITY_NAME_MAX = 120;

/** "Ro'yxatda yo'q" matni: 3–120 belgi, kamida bitta harf. Tozalangan nom yoki null. */
export function cleanRequestedName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= UNIVERSITY_NAME_MIN && name.length <= UNIVERSITY_NAME_MAX && /\p{L}/u.test(name) ? name : null;
}

/** "Ro'yxatda yo'q" tanlovining forma qiymati. */
export const OTHER_UNIVERSITY = "other";
