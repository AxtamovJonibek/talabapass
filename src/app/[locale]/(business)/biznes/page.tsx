import { Suspense } from "react";
import { PlaceholderHome } from "@/components/auth/placeholder-home";
import { BusinessPendingScreen } from "@/components/business/pending-screen";
import { BusinessRegisterScreen } from "@/components/business/register-screen";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { ownBusiness } from "@/server/business/registration";

/**
 * Biznes egasining bosh sahifasi — arizasi holatiga qarab:
 * hujjatlar hali yuborilmagan yoki rad etilgan → ariza formasi (B1/WB1); tekshiruvda → WB1 3-qadam;
 * tasdiqlangan → kabinet. Kassir bu yerga kira olmaydi (o'z skaneriga yo'naltiriladi).
 */
async function BusinessHome() {
  const user = await requireRole("BUSINESS_OWNER");
  const business = await ownBusiness(user.id);
  if (!business) return <PlaceholderHome area="business" roles={["BUSINESS_OWNER"]} />;

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
  // 9-bosqichda: B6 — biznes statistikasi.
  return <PlaceholderHome area="business" roles={["BUSINESS_OWNER"]} />;
}

export default async function BusinessHomePage({ params }: PageProps<"/[locale]/biznes">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={null}>
      <BusinessHome />
    </Suspense>
  );
}
