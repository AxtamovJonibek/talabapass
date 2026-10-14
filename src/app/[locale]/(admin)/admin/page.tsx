import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/server/auth/session";

// TODO(10-bosqich): A1 — admin umumiy ko'rinishi. Hozircha tekshiruv navbatiga yo'naltiriladi.
export default async function AdminHomePage() {
  await requireRole("ADMIN");
  redirect({ href: "/admin/talabalar", locale: await getLocale() });
}
