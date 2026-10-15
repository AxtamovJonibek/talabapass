"use server";

import { profileSchema } from "@/lib/profile";
import { audit } from "../audit";
import { requireActiveStudent } from "../auth/student";
import { setNotifyDeals, updateProfile } from "../student/profile";

export type ProfileFormState = { status: "idle" } | { status: "saved" } | { status: "error"; fields: string[] };

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

/** "Shaxsiy ma'lumotlar": ism, familiya, kurs, fakultet, tuman. Universitet va guvohnoma ma'lumoti o'zgarmaydi. */
export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireActiveStudent();
  const parsed = profileSchema.safeParse({
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    course: text(formData, "course"),
    faculty: text(formData, "faculty"),
    districtId: text(formData, "districtId"),
  });
  if (!parsed.success) return { status: "error", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const result = await updateProfile(user.id, parsed.data);
  if (!result.ok) return { status: "error", fields: [result.field] };
  await audit({ actorId: user.id, action: "student.profile.update", entity: "User", entityId: user.id });
  return { status: "saved" };
}

/** Yangi chegirmalar haqida xabar: yoqish/o'chirish. */
export async function setNotifyDealsAction(on: boolean): Promise<boolean> {
  const user = await requireActiveStudent();
  const value = on === true;
  await setNotifyDeals(user.id, value);
  return value;
}
