import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { HistoryScreen } from "@/components/student/history/history-screen";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { receipt, studentHistory } from "@/server/coupons/receipts";
import { profileData } from "@/server/student/profile-data";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

// T7 / WT4 — xaridlar tarixi va cheklar (PDF bilan). `?oy=YYYY-MM`, `?chek=<id>`, `&yangi=1`.
async function HistoryPageContent({ searchParams }: { searchParams: PageProps<"/[locale]/tarix">["searchParams"] }) {
  await connection();
  const user = await requireActiveStudent();
  const params = await searchParams;
  const now = new Date();
  const chek = first(params.chek);
  const [history, coupons, profile] = await Promise.all([studentHistory(user.id, first(params.oy), now), activeCouponCount(user.id), profileData(user)]);

  // Tanlangan chek boshqa oyda bo'lishi mumkin — faqat o'ziniki
  let selected = history.receipts.find((r) => r.id === chek) ?? null;
  if (!selected && chek && /^[a-z0-9_]{10,40}$/.test(chek)) {
    const found = await receipt(chek);
    if (found?.studentId === user.id) selected = found.data;
  }
  selected ??= history.receipts[0] ?? null;

  // `yangi=1` — kupon ekranidan sotuv tasdiqlangach kelindi (faqat shu chek uchun)
  const fresh = first(params.yangi) === "1" && selected?.id === chek;
  return <HistoryScreen history={history} selected={selected} coupons={coupons} now={now} profile={profile} fresh={fresh} />;
}

export default function StudentHistoryPage({ searchParams }: PageProps<"/[locale]/tarix">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HistoryPageContent searchParams={searchParams} />
    </Suspense>
  );
}
