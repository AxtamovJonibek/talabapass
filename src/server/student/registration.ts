import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { NAME } from "@/lib/profile";
import { toTashkent } from "@/lib/time";
import { db } from "../db";
import { isUniqueViolation } from "../db-errors";


export const studentFormSchema = z.object({
  firstName: z.string().trim().regex(NAME),
  lastName: z.string().trim().regex(NAME),
  universityId: z.string().min(1).max(40),
  course: z.enum(["C1", "C2", "C3", "C4", "MASTER"]),
});
export type StudentForm = z.infer<typeof studentFormSchema>;

/** TP-2610-0418: yil-oy va 4 raqam. Takrorlansa qayta uriniladi. */
function newPublicId(now: Date): string {
  const d = toTashkent(now).date;
  const yymm = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `TP-${yymm}-${String(randomInt(0, 10_000)).padStart(4, "0")}`;
}

/** Tasdiqlangan raqam uchun talaba hisobini ochadi (holat: DRAFT — guvohnoma hali yuklanmagan). */
export async function createStudent(phone: string, form: StudentForm): Promise<{ id: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.user.create({
        data: {
          phone,
          role: "STUDENT",
          firstName: form.firstName,
          lastName: form.lastName,
          student: { create: { universityId: form.universityId, course: form.course, publicId: newPublicId(new Date()) } },
        },
        select: { id: true },
      });
    } catch (error) {
      // publicId to'qnashuvi (unique) — yangi raqam bilan qayta urinamiz; boshqa xatolar yuqoriga chiqadi.
      if (!isUniqueViolation(error, "publicId") || attempt >= 5) throw error;
    }
  }
}
