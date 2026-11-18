import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { OwnPasswordScreen } from "@/components/auth/own-password-screen";
import { Toaster } from "@/components/ui/toast";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getCurrentUser, homePathFor } from "@/server/auth/session";

async function OwnPassword() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) return redirect({ href: "/kirish", locale });
  if (user.role === "ADMIN") return redirect({ href: homePathFor(user.role), locale });
  const mode = !user.passwordHash ? "set" : user.passwordResetRequired ? "required" : "change";
  const business = user.role !== "STUDENT";
  return <OwnPasswordScreen mode={mode} backHref={business ? (user.role === "CASHIER" ? "/biznes/skaner" : "/biznes/profil") : "/profil"} business={business} />;
}

// Parol o'rnatish (parolsiz eski hisob, admin tiklagan) va almashtirish — dizaynda yo'q, mavjud primitivlardan
export default async function OwnPasswordPage({ params }: PageProps<"/[locale]/kirish/parol">) {
  await resolveLocale(params);
  return (
    <>
      <Suspense fallback={null}>
        <OwnPassword />
      </Suspense>
      <Toaster />
    </>
  );
}
