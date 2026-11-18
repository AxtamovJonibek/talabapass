import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { AdminPasswordScreen } from "@/components/auth/admin-password-screen";
import { AdminSmsScreen } from "@/components/auth/admin-sms-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { adminUnlocked, getCurrentUser, homePathFor } from "@/server/auth/session";

/** Kirmagan — SMS qadami; SMS bilan kirgan admin — parol; boshqa rol yoki parol kiritilgan — o'z bosh sahifasi. */
async function AdminLogin() {
  const user = await getCurrentUser();
  if (!user) return <AdminSmsScreen />;
  if (user.role !== "ADMIN" || (await adminUnlocked())) return redirect({ href: homePathFor(user.role), locale: await getLocale() });
  return <AdminPasswordScreen />;
}

// Admin kirishi (dizaynda yo'q): SMS kod → umumiy admin paroli. Parolsiz admin sahifalari va admin API ochilmaydi.
export default async function AdminLoginPage({ params }: PageProps<"/[locale]/kirish/admin">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={null}>
      <AdminLogin />
    </Suspense>
  );
}
