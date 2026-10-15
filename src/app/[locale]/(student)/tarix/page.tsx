import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { HistoryScreen } from "@/components/student/history/history-screen";
import { initials } from "@/lib/format";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { receipt, studentHistory } from "@/server/coupons/receipts";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

// T7 / WT4 — xaridlar tarixi va cheklar (PDF bilan). `?oy=YYYY-MM`, `?chek=<id>`.
async function HistoryPageContent({ searchParams }: { searchParams: PageProps<"/[locale]/tarix">["searchParams"] }) {
  await connection();
  const user = await requireActiveStudent();
  const params = await searchParams;
  const now = new Date();
  const chek = first(params.chek);
  const [history, coupons, t] = await Promise.all([studentHistory(user.id, first(params.oy), now), activeCouponCount(user.id), getTranslations()]);

  // Tanlangan chek boshqa oyda bo'lishi mumkin — faqat o'ziniki
  let selected = history.receipts.find((r) => r.id === chek) ?? null;
  if (!selected && chek && /^[a-z0-9_]{10,40}$/.test(chek)) {
    const found = await receipt(chek);
    if (found?.studentId === user.id) selected = found.data;
  }
  selected ??= history.receipts[0] ?? null;

  const s = user.student;
  const course = s.course === "MASTER" ? t("coupon.master") : t("coupon.course", { n: s.course.slice(1) });
  return (
    <HistoryScreen
      history={history}
      selected={selected}
      coupons={coupons}
      now={now}
      profile={{
        name: [user.firstName, user.lastName].filter(Boolean).join(" "),
        initials: initials(user.firstName, user.lastName),
        meta: [s.university.shortName, s.faculty, course].filter(Boolean).join(" · "),
        publicId: s.publicId,
        cardExpiresAt: s.cardExpiresAt?.toISOString() ?? null,
        notify: s.notifyDeals,
      }}
    />
  );
}

export default function StudentHistoryPage({ searchParams }: PageProps<"/[locale]/tarix">) {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent searchParams={searchParams} />
    </Suspense>
  );
}
