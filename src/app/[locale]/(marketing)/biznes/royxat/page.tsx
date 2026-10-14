import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { BusinessRegisterScreen } from "@/components/business/register-screen";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { getCurrentUser, getVerifiedPhone, homePathFor } from "@/server/auth/session";

async function Register() {
  const user = await getCurrentUser();
  // Kirgan egasi arizasini /biznes da davom ettiradi (yoki ko'radi); boshqa rollar — o'z bo'limiga.
  if (user) redirect({ href: homePathFor(user.role), locale: await getLocale() });
  return <BusinessRegisterScreen verifiedPhone={await getVerifiedPhone()} />;
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
