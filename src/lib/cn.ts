export type ClassValue = string | false | null | undefined;

/** Shartli klasslarni birlashtiradi. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
