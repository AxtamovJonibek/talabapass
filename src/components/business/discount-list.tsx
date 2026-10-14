"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { discountTerms, weekdaysLabel } from "@/lib/discount";
import { formatMinute } from "@/lib/time";
import { setDiscountActiveAction } from "@/server/actions/discounts";
import type { OwnerDiscount } from "@/server/business/discounts";

/** B5 — chegirmalar ro'yxati: yorliq, nom, jadval va bugungi sotuv; faol/to'xtatilgan uchun switch. */
export function DiscountList({ discounts }: { discounts: OwnerDiscount[] }) {
  const t = useTranslations("discountList");
  const weekday = useTranslations("weekday");
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [items, setOptimistic] = useOptimistic(
    discounts,
    (list, change: { id: string; active: boolean }) =>
      list.map((d) =>
        d.id === change.id
          ? {
              ...d,
              status: change.active ? ("ACTIVE" as const) : ("PAUSED" as const),
            }
          : d,
      ),
  );

  if (items.length === 0)
    return (
      <p className="m-0 rounded-16 bg-white px-3.5 py-4 text-14 leading-[1.45] text-muted">
        {t("empty")}
      </p>
    );

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      setOptimistic({ id, active });
      const result = await setDiscountActiveAction(id, active);
      setFailed(!result.ok);
    });
  }

  return (
    <>
      {failed ? (
        <p role="alert" className="m-0 text-13 font-semibold text-danger">
          {t("toggleFailed")}
        </p>
      ) : null}
      <ul className="m-0 list-none rounded-16 bg-white p-0">
        {items.map((d, i) => {
          const live = d.status === "ACTIVE";
          const schedule = `${weekdaysLabel(d.weekdays, (n) => weekday(`short.${n}` as "short.1"), weekday("everyDay"))} · ${formatMinute(d.fromMinute)}–${formatMinute(d.toMinute)}`;
          const state =
            d.status === "ACTIVE"
              ? `${schedule} · ${t("sold", { sold: d.soldToday, limit: d.dailyLimit })}`
              : d.status === "REJECTED"
                ? t("state.REJECTED", { reason: d.rejectReason ?? "—" })
                : d.status === "ENDED"
                  ? t("state.ENDED", {
                      date: `${d.endsOn.slice(8, 10)}.${d.endsOn.slice(5, 7)}`,
                    })
                  : `${t(`state.${d.status}`)} · ${schedule}`;
          return (
            <li
              key={d.id}
              data-testid="discount-row"
              className={cn(
                "flex items-center gap-3 px-3.5 py-3",
                i < items.length - 1 && "border-b border-solid border-surface",
              )}
            >
              <span
                className={cn(
                  "min-w-10 rounded-6 px-1.5 py-1 text-center text-16 font-black font-stretch-70%",
                  live ? "bg-orange text-ink" : "bg-track text-muted",
                )}
              >
                {discountTerms(d).badge}
              </span>
              <Link
                href={`/biznes/chegirma/${d.id}`}
                className="min-w-0 flex-1 text-ink no-underline"
              >
                <div className={cn("text-14 font-bold", !live && "text-muted")}>
                  {d.title}
                </div>
                <div className="text-12 text-muted">{state}</div>
              </Link>
              {d.status === "ACTIVE" || d.status === "PAUSED" ? (
                <Switch
                  small
                  checked={live}
                  label={live ? t("active") : t("inactive")}
                  onChange={(next) => toggle(d.id, next)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
