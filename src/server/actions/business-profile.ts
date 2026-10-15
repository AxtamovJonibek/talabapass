"use server";

import { requireRole } from "../auth/session";
import { editBusinessInfo } from "../business/profile-edit";

export type BusinessEditState = { status: "idle" } | { status: "saved"; rereview: boolean } | { status: "error"; fields: string[] } | { status: "notEditable" };

const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v.slice(0, 400) : "";
};

/** B5 "Tahrirlash": nom, manzil, ish vaqti, tavsif, aloqa (telefon, Telegram, Instagram). Nom/manzil o'zgarsa biznes qayta tekshiriladi. */
export async function editBusinessAction(_prev: BusinessEditState, formData: FormData): Promise<BusinessEditState> {
  const user = await requireRole("BUSINESS_OWNER");
  const result = await editBusinessInfo(user.id, {
    name: text(formData, "name"),
    address: text(formData, "address"),
    workingHours: text(formData, "workingHours"),
    description: text(formData, "description"),
    phone: text(formData, "phone"),
    telegram: text(formData, "telegram"),
    instagram: text(formData, "instagram"),
  });
  if (result.ok) return { status: "saved", rereview: result.rereview };
  return "fields" in result ? { status: "error", fields: result.fields } : { status: "notEditable" };
}
