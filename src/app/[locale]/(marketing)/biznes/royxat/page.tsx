import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { AppBusinessRegister } from "@/components/app/business-register";
import { BusinessRegisterScreen } from "@/components/business/register-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { isAppRequest } from "@/server/app-mode";
import { getCurrentUser, getVerifiedPhone, homePathFor } from "@/server/auth/session";

async function Register() {
  const user = await getCurrentUser();
  // Kirgan egasi arizasini /biznes da davom ettiradi (yoki ko'radi); boshqa rollar — o'z bo'limiga.
  if (user) redirect({ href: homePathFor(user.role), locale: await getLocale() });
  const verifiedPhone = await getVerifiedPhone();
  // Ilova (design/app-flow B6–B8): raqam kirishda SMS bilan tasdiqlangan bo'lishi kerak
  if (await isAppRequest()) {
    if (!verifiedPhone) redirect({ href: "/kirish?rol=biznes", locale: await getLocale() });
    return <AppBusinessRegister verifiedPhone={verifiedPhone} />;
  }
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
