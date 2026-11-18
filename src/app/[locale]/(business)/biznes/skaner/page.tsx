import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { OwnerBottomNav } from "@/components/business/owner-nav";
import { ScannerScreen } from "@/components/cashier/scanner-screen";
import { Icon } from "@/components/ui/icon";
import { formatMinute, toTashkent } from "@/lib/time";
import { logoutAction } from "@/server/actions/auth";
import { requireRole } from "@/server/auth/session";
import { scannerFor, scannerSummary, shortName } from "@/server/coupons/scan";

// B3 / B4 — kassir skaneri (egasi ham skanerlay oladi). Biznes faqat sessiyadan (`scannerFor`).
async function ScannerContent() {
  const user = await requireRole("BUSINESS_OWNER", "CASHIER");
  const t = await getTranslations("scanner");
  const scanner = await scannerFor(user);
  const cashier = user.role === "CASHIER";

  // Kassir uchun pastki navigatsiya o'rniga chiqish (unga faqat skaner ochiq)
  const footer = cashier ? (
    <form action={logoutAction} className="px-4 pb-6">
      <button type="submit" className="tp-btn tp-paint flex h-12 w-full items-center justify-center gap-2 rounded-14 border-hair border-ink-4 bg-transparent font-sans text-14 font-semibold text-fog-2">
        <Icon name="logout" size={18} />
        {t("logout")}
      </button>
    </form>
  ) : (
    <OwnerBottomNav active="scanner" />
  );

  if (!scanner) {
    return (
      <div data-edge="ink-0" className="flex h-dvh flex-col bg-ink-0 text-paper">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <b className="text-18">{t("noBusinessTitle")}</b>
          <p className="m-0 text-14 leading-[1.45] text-fog-0">{t("noBusinessText")}</p>
        </div>
        {footer}
      </div>
    );
  }

  const { todaySales, lastSale } = await scannerSummary(scanner);

  return (
    <ScannerScreen
      business={{ name: scanner.businessName, initial: scanner.businessName.trim().charAt(0).toUpperCase() }}
      cashierName={shortName(user.firstName, user.lastName)}
      todaySales={todaySales}
      lastSale={lastSale ? { student: lastSale.student, item: lastSale.item, time: formatMinute(toTashkent(lastSale.at).minute) } : null}
      footer={footer}
    />
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ScannerContent />
    </Suspense>
  );
}
