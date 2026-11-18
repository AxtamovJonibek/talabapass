import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { AppBusinessRegister } from "@/components/app/business-register";
import { BusinessRegisterScreen } from "@/components/business/register-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { isAppRequest } from "@/server/app-mode";
import { readPendingPassword } from "@/server/auth/password-steps";
import { getCurrentUser, getVerifiedPhone, homePathFor } from "@/server/auth/session";
import { ownBusiness } from "@/server/business/registration";

async function Register() {
  const user = await getCurrentUser();
  if (user) {
    // Ariza shu sahifada yuborilayotganda hisob ochiladi (sessiya cookie'si sahifani yangilaydi): fayllar yuklanib bo'lguncha
    // forma shu yerda qoladi. Yuborilgan ariza va boshqa rollar — o'z bo'limiga.
    const business = user.role === "BUSINESS_OWNER" ? await ownBusiness(user.id) : null;
    if (business && business.status === "PENDING" && !business.submittedAt) {
      return (await isAppRequest()) ? <AppBusinessRegister signedIn verifiedPhone={user.phone} /> : <BusinessRegisterScreen signedIn verifiedPhone={user.phone} />;
    }
    return redirect({ href: homePathFor(user.role), locale: await getLocale() });
  }
  const verifiedPhone = await getVerifiedPhone();
  // Ma'lumotlar formasi faqat telefon → SMS kod → parol qadamlaridan keyin (parolsiz hisob ochilmaydi)
  if (!verifiedPhone || !(await readPendingPassword(verifiedPhone))) return redirect({ href: "/kirish?royxat=biznes", locale: await getLocale() });
  if (await isAppRequest()) return <AppBusinessRegister verifiedPhone={verifiedPhone} />;
  return <BusinessRegisterScreen verifiedPhone={verifiedPhone} />;
}

// B1 / WB1 — biznes ro'yxati, 1–2-qadam
export default async function BusinessRegisterPage({ params }: PageProps<"/[locale]/biznes/royxat">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={null}>
      <Register />
    </Suspense>
  );
}
