import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { ProfilePage } from "@/components/business/owner-pages";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { ownerCashiers } from "@/server/business/cashiers";
import { ownerBusinessForDiscounts, ownerDiscounts } from "@/server/business/discounts";
import { ownerProfile } from "@/server/business/profile";

async function Profile() {
  const user = await requireRole("BUSINESS_OWNER");
  // Ariza hali yuborilmagan bo'lsa — avval ariza (/biznes)
  if (!(await ownerBusinessForDiscounts(user.id))) return redirect({ href: "/biznes", locale: await getLocale() });
  const [profile, discounts, cashiers] = await Promise.all([ownerProfile(user.id), ownerDiscounts(user.id), ownerCashiers(user.id)]);
  if (!profile) return redirect({ href: "/biznes", locale: await getLocale() });
  return <ProfilePage profile={profile} discounts={discounts} cashiers={cashiers} />;
}

// B5 — biznes profili
export default async function BusinessProfilePage({ params }: PageProps<"/[locale]/biznes/profil">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}
