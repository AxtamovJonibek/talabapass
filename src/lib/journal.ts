/**
 * Jurnal yozuvining tafsiloti: `meta.changed` — "maydon: oldin → keyin" qatorlari, qolgan kalitlar — "kalit: qiymat".
 * Parol, kod va xeshlar audit'ga umuman yozilmaydi; baribir shu nomdagi kalitlar ko'rsatilmaydi (ehtiyot).
 */
const HIDDEN = /password|hash|token|code|secret/i;
const MAX = 80;

const short = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > MAX ? `${s.slice(0, MAX - 1)}…` : s;
};

export function journalDetails(meta: unknown): string[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return meta === null || meta === undefined ? [] : [short(meta)];
  const lines: string[] = [];
  const { changed, ...rest } = meta as Record<string, unknown>;
  if (changed && typeof changed === "object" && !Array.isArray(changed)) {
    for (const [field, pair] of Object.entries(changed as Record<string, unknown>)) {
      if (HIDDEN.test(field)) continue;
      lines.push(Array.isArray(pair) && pair.length === 2 ? `${field}: ${short(pair[0])} → ${short(pair[1])}` : `${field}: ${short(pair)}`);
    }
  } else if (Array.isArray(changed)) lines.push(`changed: ${changed.map(short).join(", ")}`);
  for (const [key, value] of Object.entries(rest)) {
    if (HIDDEN.test(key)) continue;
    lines.push(`${key}: ${short(value)}`);
  }
  return lines;
}

/** UTC → Toshkent "2026-11-19 14:05" */
export const tashkentStamp = (at: Date | string) => new Date(new Date(at).getTime() + 5 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
