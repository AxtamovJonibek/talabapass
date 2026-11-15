import { Suspense } from "react";
import { Intro } from "@/components/app/intro";
import { GuestOnly } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

// Ilova (Capacitor) boshlanish sahifasi: birinchi ochilishda tanishtiruv (Main, Slide2–4), keyin — kirish.
// Kirgan foydalanuvchi o'z bosh sahifasiga o'tadi. Brauzerda bosh sahifaga qaytaradi (sayt o'zgarmaydi).
export default async function AppIntroPage({ params }: PageProps<"/[locale]/ilova">) {
  await resolveLocale(params);
  return (
    <>
      <Suspense fallback={null}>
        <GuestOnly />
      </Suspense>
      <Intro kind="student" />
    </>
  );
}
