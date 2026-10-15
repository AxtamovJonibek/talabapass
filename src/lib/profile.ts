import { z } from "zod";

/** Ism/familiya: harf bilan boshlanadi, 2–40 belgi (ʻ, ' va tire ruxsat). Ro'yxat va profil bir xil qoida. */
export const NAME = /^[\p{L}][\p{L}'ʻʼ’` -]{1,39}$/u;
export const FACULTY_MAX = 80;
export const COURSES = ["C1", "C2", "C3", "C4", "MASTER"] as const;

/** Bo'sh qator — qiymat yo'q (null). */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** "Shaxsiy ma'lumotlar" formasi (T8 / WT4): universitet va guvohnoma ma'lumoti bu yerda o'zgarmaydi. */
export const profileSchema = z.object({
  firstName: z.string().trim().regex(NAME),
  lastName: z.string().trim().regex(NAME),
  course: z.enum(COURSES),
  faculty: optional(FACULTY_MAX),
  /** Ixtiyoriy: "Hudud" auditoriyasi (bildirishnomalar) shu maydondan olinadi */
  districtId: optional(40),
});
export type ProfileInput = z.infer<typeof profileSchema>;
