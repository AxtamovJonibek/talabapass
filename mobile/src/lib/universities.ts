import type { University } from "@/api/endpoints";

/** Qidiruv — saytdagi `searchUniversities` bilan bir xil: nom, qisqa nom yoki viloyat; barcha so'zlar mos kelsin. */
export function normalizeName(value: string): string {
  return value
    .replace(/[‘’ʻʼ`´′]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function searchUniversities(list: readonly University[], query: string): University[] {
  const words = normalizeName(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...list];
  const scored: [number, University][] = [];
  for (const u of list) {
    const name = normalizeName(u.name);
    const short = normalizeName(u.shortName);
    const haystack = `${name} ${short} ${normalizeName(u.region)}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    scored.push([name.startsWith(words[0]!) || short.startsWith(words[0]!) ? 0 : 1, u]);
  }
  return scored.sort((a, b) => a[0] - b[0]).map(([, u]) => u);
}
