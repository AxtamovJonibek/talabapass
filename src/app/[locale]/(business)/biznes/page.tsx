import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { BusinessPendingScreen } from "@/components/business/pending-screen";
import { BusinessRegisterScreen } from "@/components/business/register-screen";
import { StatsScreen } from "@/components/business/stats/stats-screen";
import { resolveLocale } from "@/i18n/locale";
import { parsePeriod } from "@/lib/stats";
import { requireRole } from "@/server/auth/session";
import { ownBusiness } from "@/server/business/registration";
import { businessStats } from "@/server/business/stats";

/**
 * Biznes egasining bosh sahifasi — arizasi holatiga qarab:
 * hujjatlar hali yuborilmagan yoki rad etilgan → ariza formasi (B1/WB1); tekshiruvda → WB1 3-qadam;
 * tasdiqlangan (APPROVED/WARNED) → B6 statistika. Kassir bu yerga kira olmaydi (o'z skaneriga yo'naltiriladi).
 */
async function BusinessHome({ searchParams }: { searchParams: PageProps<"/[locale]/biznes">["searchParams"] }) {
  const user = await requireRole("BUSINESS_OWNER");
  const business = await ownBusiness(user.id);
  // Egasi bor, biznesi yo'q (ariza hali boshlanmagan) — forma, bo'sh ma'lumot bilan
  if (!business) return <BusinessRegisterScreen signedIn verifiedPhone={user.phone} />;

  const editable = (business.status === "PENDING" && !business.submittedAt) || business.status === "REJECTED";
  if (editable) {
    return (
      <BusinessRegisterScreen
        signedIn
        verifiedPhone={user.phone}
        rejectReason={business.status === "REJECTED" ? business.rejectReason : null}
        initial={{
          name: business.name,
          kind: business.kind,
          address: business.address,
          workingHours: business.workingHours,
          description: business.description ?? "",
          tin: business.tin ?? "",
          contactName: business.contactName ?? "",
          phone: user.phone,
        }}
        docs={business.docs}
      />
    );
  }
  if (business.status === "PENDING") return <BusinessPendingScreen />;

  const now = new Date();
  const stats = await businessStats(business.id, parsePeriod((await searchParams).davr), now);
  return <StatsScreen stats={stats} now={now} />;
}

export default async function BusinessHomePage({ params, searchParams }: PageProps<"/[locale]/biznes">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BusinessHome searchParams={searchParams} />
    </Suspense>
  );
}
