import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { UnblockButton } from "@/components/admin/blocked";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { blockedBusinesses, blockedStudents } from "@/server/admin/blocked";
import { blockedCounts } from "@/server/admin/overview";
import { requireRole } from "@/server/auth/session";

const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 font-semibold";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5 align-top";
const tab = (on: boolean) => cn("flex h-[34px] items-center gap-2 rounded-8 px-3 text-13 font-bold text-ink no-underline", on ? "bg-white" : "bg-transparent");

const dotted = (at: Date | null) => {
  if (!at) return "—";
  const iso = new Date(at.getTime() + 5 * 60 * 60 * 1000).toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
};

// Bloklanganlar: talabalar va bizneslar (sabab, sana, kim blokladi) + blokdan chiqarish. Dizaynda faqat yon panel bandi bor.
async function BlockedContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/bloklanganlar">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const kind = (Array.isArray(query.tur) ? query.tur[0] : query.tur) === "bizneslar" ? "businesses" : "students";
  const [t, reasons, counts, students, businesses] = await Promise.all([
    getTranslations("admin.blocked"),
    getTranslations("admin.review.reasons"),
    blockedCounts(),
    kind === "students" ? blockedStudents() : Promise.resolve([]),
    kind === "businesses" ? blockedBusinesses() : Promise.resolve([]),
  ]);
  // Sabab: tanlangan kalit bo'lsa — matni, aks holda saqlangan matn o'zi
  const reasonText = (scope: "student" | "business", value: string | null) =>
    value ? (reasons.has(`${scope}.${value}` as "student.fake") ? reasons(`${scope}.${value}` as "student.fake") : value) : "—";

  return (
    <AdminShell user={admin} active="blocked">
      <header>
        <div className="text-13 text-muted">{t("sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
      </header>
      <section className="flex min-w-0 flex-col gap-3.5 rounded-16 bg-white p-5">
        <div role="tablist" aria-label={t("title")} className="flex w-fit gap-[3px] rounded-10 bg-admin-bg p-[3px]">
          <Link role="tab" aria-selected={kind === "students"} href="/admin/bloklanganlar" className={tab(kind === "students")}>
            {t("students")} <span className="font-mono text-12 text-muted">{counts.students}</span>
          </Link>
          <Link role="tab" aria-selected={kind === "businesses"} href="/admin/bloklanganlar?tur=bizneslar" className={tab(kind === "businesses")}>
            {t("businesses")} <span className="font-mono text-12 text-muted">{counts.businesses}</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          {kind === "students" ? (
            <table className="w-full min-w-[820px] border-collapse text-14">
              <thead>
                <tr className="text-left text-12 text-muted">
                  <th className={th}>{t("columns.student")}</th>
                  <th className={th}>{t("columns.reason")}</th>
                  <th className={th}>{t("columns.when")}</th>
                  <th className={cn(th, "text-right")}>{t("columns.action")}</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={cn(td, "py-6 text-muted")}>
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className={td}>
                      <b>{s.name || "—"}</b>
                      <div className="text-12 text-muted">{[s.university, formatPhone(s.phone)].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className={td}>{reasonText("student", s.reason)}</td>
                    <td className={cn(td, "whitespace-nowrap")}>
                      <span className="font-mono">{dotted(s.at)}</span>
                      {s.by ? <div className="text-12 text-muted">{t("by", { name: s.by })}</div> : null}
                    </td>
                    <td className={cn(td, "text-right")}>
                      <UnblockButton kind="student" id={s.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[820px] border-collapse text-14">
              <thead>
                <tr className="text-left text-12 text-muted">
                  <th className={th}>{t("columns.business")}</th>
                  <th className={th}>{t("columns.reason")}</th>
                  <th className={th}>{t("columns.when")}</th>
                  <th className={cn(th, "text-right")}>{t("columns.action")}</th>
                </tr>
              </thead>
              <tbody>
                {businesses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={cn(td, "py-6 text-muted")}>
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
                {businesses.map((b) => (
                  <tr key={b.id}>
                    <td className={td}>
                      <b>{b.name}</b>
                      <div className="text-12 text-muted">{[b.owner, formatPhone(b.phone)].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className={td}>{reasonText("business", b.reason)}</td>
                    <td className={cn(td, "whitespace-nowrap")}>
                      <span className="font-mono">{dotted(b.at)}</span>
                      {b.by ? <div className="text-12 text-muted">{t("by", { name: b.by })}</div> : null}
                    </td>
                    <td className={cn(td, "text-right")}>
                      <div className="inline-flex gap-1.5">
                        <Link href={`/admin/bizneslar?id=${b.id}`} className="flex h-8 items-center rounded-8 border-hair border-line bg-white px-2.5 text-13 font-semibold text-ink no-underline">
                          {t("view")}
                        </Link>
                        <UnblockButton kind="business" id={b.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="m-0 text-13 text-muted">{t("note")}</p>
      </section>
    </AdminShell>
  );
}

export default function BlockedPage({ searchParams }: PageProps<"/[locale]/admin/bloklanganlar">) {
  return (
    <Suspense fallback={null}>
      <BlockedContent searchParams={searchParams} />
    </Suspense>
  );
}
