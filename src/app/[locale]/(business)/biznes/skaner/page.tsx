import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { OwnerBottomNav } from "@/components/business/owner-nav";
import { ScannerScreen } from "@/components/cashier/scanner-screen";
import { Icon } from "@/components/ui/icon";
import { formatMinute, fromTashkent, toTashkent } from "@/lib/time";
import { logoutAction } from "@/server/actions/auth";
import { requireRole } from "@/server/auth/session";
import { scannerFor } from "@/server/coupons/scan";
import { db } from "@/server/db";

const short = (first?: string | null, last?: string | null) => [first, last ? `${last.charAt(0)}.` : null].filter(Boolean).join(" ");

// B3 / B4 — kassir skaneri (egasi ham skanerlay oladi). Biznes faqat sessiyadan (`scannerFor`).
async function ScannerContent() {
  const user = await requireRole("BUSINESS_OWNER", "CASHIER");
  const t = await getTranslations("scanner");
  const scanner = await scannerFor(user);
  const cashier = user.role === "CASHIER";

  // Kassir uchun pastki navigatsiya o'rniga chiqish (unga faqat skaner ochiq)
  const footer = cashier ? (
    <form action={logoutAction} className="px-4 pb-6">
      <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-14 border-hair border-ink-4 bg-transparent font-sans text-14 font-semibold text-fog-2">
        <Icon name="logout" size={18} />
        {t("logout")}
      </button>
    </form>
  ) : (
    <OwnerBottomNav active="scanner" />
  );

  if (!scanner) {
    return (
      <div className="flex h-dvh flex-col bg-ink-0 text-paper">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <b className="text-18">{t("noBusinessTitle")}</b>
          <p className="m-0 text-14 leading-[1.45] text-fog-0">{t("noBusinessText")}</p>
        </div>
        {footer}
      </div>
    );
  }

  const today = fromTashkent(toTashkent(new Date()).date);
  const [todaySales, last] = await Promise.all([
    db.redemption.count({ where: { businessId: scanner.businessId, createdAt: { gte: today } } }),
    db.redemption.findFirst({
      where: { businessId: scanner.businessId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, student: { select: { firstName: true, lastName: true } }, coupon: { select: { termsTitle: true } } },
    }),
  ]);

  return (
    <ScannerScreen
      business={{ name: scanner.businessName, initial: scanner.businessName.trim().charAt(0).toUpperCase() }}
      cashierName={short(user.firstName, user.lastName)}
      todaySales={todaySales}
      lastSale={last ? { student: short(last.student.firstName, last.student.lastName), item: last.coupon.termsTitle, time: formatMinute(toTashkent(last.createdAt).minute) } : null}
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
