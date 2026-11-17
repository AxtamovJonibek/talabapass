import { profileSchema } from "@/lib/profile";
import { studentAvatarUrl } from "@/lib/profile-image";
import { audit } from "@/server/audit";
import { signUrls } from "@/server/api/files";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { loadApiUser, meView, requireApiStudent } from "@/server/api/session";
import { updateProfile } from "@/server/student/profile";

/**
 * Talaba profili (saytdagi `/profil/tahrir` — T8/WT4 "Shaxsiy ma'lumotlar"). Tahrirlanadi: ism, familiya, kurs, fakultet,
 * tuman (`src/lib/profile.ts`, forma va sayt bilan bitta qoida); universitet, ID va guvohnoma — faqat ko'rish uchun.
 * Rasm — `POST/DELETE /student/avatar`, ko'rish — imzoli `avatarUrl`.
 */
export const GET = route(async (request) => {
  const { user } = await requireApiStudent(request);
  const s = user.student;
  return ok(
    signUrls({
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        course: s.course,
        faculty: s.faculty,
        districtId: s.districtId,
        publicId: s.publicId,
        university: { name: s.university.name, shortName: s.university.shortName },
        cardNumber: s.cardNumber,
        cardExpiresAt: s.cardExpiresAt?.toISOString().slice(0, 10) ?? null,
        avatarUrl: studentAvatarUrl(user.id, s.avatarKey),
      },
    }),
  );
});

/** Saqlash: bo'sh fakultet/tuman — o'chiriladi. Xato — `invalid_request` + `fields` (tuman topilmasa `districtId`). */
export const PATCH = route(async (request) => {
  const { user } = await requireApiStudent(request);
  await limit("write", user.id);
  const input = await readJson(request, profileSchema);
  const result = await updateProfile(user.id, input);
  if (!result.ok) throw new ApiError("invalid_request", { fields: [result.field] });
  await audit({ actorId: user.id, action: "student.profile.update", entity: "User", entityId: user.id, meta: { via: "api" } });
  return ok({ ok: true, user: meView(await loadApiUser(user.id)) });
});
