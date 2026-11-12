"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { formatSom } from "@/lib/format";
import { mockPayAction } from "@/server/actions/preorder";

/** "Test to'lov" — soxta provayder sahifasi: natijani tanlang, callback imzolanib yuboriladi, keyin buyurtmaga. */
export function MockCheckout({ paymentId, orderId, amount, title, business, open }: { paymentId: string; orderId: string; amount: number; title: string; business: string; open: boolean }) {
  const t = useTranslations("mockPay");
  const common = useTranslations("common");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const pay = (outcome: "success" | "fail") =>
    start(async () => {
      const result = await mockPayAction(paymentId, outcome);
      if (!result.ok) return setFailed(true);
      router.replace(`/buyurtmalar/${orderId}`);
    });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-0 px-4 py-10 text-ink">
      <div className="enter-rise flex w-full max-w-[400px] flex-col gap-4 rounded-22 bg-white p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-12 bg-warn-bg text-warn">
            <Icon name="info" size={20} />
          </span>
          <h1 className="m-0 text-22 font-black tracking-[-0.02em] font-stretch-110%">{t("title")}</h1>
        </div>
        <p className="m-0 rounded-12 bg-warn-bg px-3.5 py-3 text-13 leading-[1.45] text-warn">{t("notice")}</p>
        <div className="flex flex-col gap-0.5">
          <span className="text-13 text-muted">{business}</span>
          <span className="text-16 font-bold">{title}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-14 text-muted">{t("amount")}</span>
          <span className="font-mono text-28 font-semibold" data-testid="mock-amount">
            {formatSom(amount)} <span className="font-sans text-15">{common("currency")}</span>
          </span>
        </div>
        {open && !failed ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger-outline" size="md" disabled={pending} onClick={() => pay("fail")}>
              {t("fail")}
            </Button>
            <Button variant="green" size="md" loading={pending} onClick={() => pay("success")} data-testid="mock-success">
              {t("success")}
            </Button>
          </div>
        ) : (
          <>
            <p className="m-0 text-14 font-semibold text-danger">{t("notFound")}</p>
            <ButtonLink href={`/buyurtmalar/${orderId}`} variant="outline-soft" size="md" block>
              {t("toOrder")}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
