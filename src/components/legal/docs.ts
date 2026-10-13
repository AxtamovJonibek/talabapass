export const LEGAL_DOCS = ["maxfiylik", "shartlar", "biznes"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

export function isLegalDoc(value: string): value is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(value);
}

export type LegalSection = { h: string; p: string[] };
