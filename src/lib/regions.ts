import type { Point } from "./geo";

/**
 * Joy tanlovidagi "Viloyatlar" guruhi: viloyat markazining koordinatasi (masofa shundan). Toshkent shahri —
 * bazadagi tumanlar (`District`). Klient va server umumiy; cookie'da `r:<id>` ko'rinishida saqlanadi.
 */
export const REGIONS = [
  { id: "andijon", name: "Andijon", lat: 40.7821, lng: 72.3442 },
  { id: "buxoro", name: "Buxoro", lat: 39.7747, lng: 64.4286 },
  { id: "fargona", name: "Farg'ona", lat: 40.3864, lng: 71.7864 },
  { id: "jizzax", name: "Jizzax", lat: 40.1158, lng: 67.8422 },
  { id: "namangan", name: "Namangan", lat: 40.9983, lng: 71.6726 },
  { id: "navoiy", name: "Navoiy", lat: 40.1039, lng: 65.3739 },
  { id: "qashqadaryo", name: "Qashqadaryo", lat: 38.8606, lng: 65.7891 },
  { id: "qoraqalpogiston", name: "Qoraqalpog'iston", lat: 42.4531, lng: 59.6103 },
  { id: "samarqand", name: "Samarqand", lat: 39.6542, lng: 66.9597 },
  { id: "sirdaryo", name: "Sirdaryo", lat: 40.4897, lng: 68.7842 },
  { id: "surxondaryo", name: "Surxondaryo", lat: 37.2242, lng: 67.2783 },
  { id: "toshkent-viloyati", name: "Toshkent viloyati", lat: 41.0453, lng: 69.3561 },
  { id: "xorazm", name: "Xorazm", lat: 41.5506, lng: 60.6317 },
] as const satisfies readonly ({ id: string; name: string } & Point)[];

export type Region = (typeof REGIONS)[number];

export function regionById(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}
