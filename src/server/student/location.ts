import "server-only";
import { cookies } from "next/headers";
import { isValidPoint, type Point } from "@/lib/geo";
import { db } from "../db";

/**
 * Talaba tanlagan joy — masofa shundan hisoblanadi. Maxfiy emas, lekin httpOnly: faqat server o'qiydi.
 * "d:<tuman id>" (tuman markazi) yoki "g:<lat>,<lng>" (brauzer geolokatsiyasi, 3 xonagacha yaxlitlangan ≈ 100 m).
 */
export const LOCATION_COOKIE = "tp_loc";
export const LOCATION_MAX_AGE_MS = 365 * 86_400_000;

export type Origin =
  | { kind: "district"; districtId: string; name: string; point: Point }
  | { kind: "gps"; point: Point };

export function parseLocationCookie(value: string | undefined): { districtId: string } | { point: Point } | null {
  if (!value) return null;
  if (value.startsWith("d:") && /^d:[a-z0-9]{10,40}$/.test(value)) return { districtId: value.slice(2) };
  const m = /^g:(-?\d{1,2}(?:\.\d{1,6})?),(-?\d{1,3}(?:\.\d{1,6})?)$/.exec(value);
  if (m) {
    const point = { lat: Number(m[1]), lng: Number(m[2]) };
    if (isValidPoint(point)) return { point };
  }
  return null;
}

export async function currentOrigin(): Promise<Origin | null> {
  const parsed = parseLocationCookie((await cookies()).get(LOCATION_COOKIE)?.value);
  if (!parsed) return null;
  if ("point" in parsed) return { kind: "gps", point: parsed.point };
  const district = await db.district.findUnique({ where: { id: parsed.districtId }, select: { id: true, name: true, lat: true, lng: true } });
  return district ? { kind: "district", districtId: district.id, name: district.name, point: { lat: district.lat, lng: district.lng } } : null;
}

export async function districtOptions() {
  return db.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
