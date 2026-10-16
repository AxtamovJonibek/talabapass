"use client";

import { useTranslations } from "next-intl";
import { DealTag, FeedCard } from "@/components/ui/feed-card";
import { urgencyOf, type FeedDeal } from "@/lib/feed";
import { formatSom } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { useDealText } from "./labels";

/** Karta va tafsilot rasmidagi yorliq hamda holat matni: rasmsiz, Tez tugaydi, Ertaga, 1+1 holatlari shu yerda yig'iladi. */
export function useDealMarks(deal: FeedDeal, now: Date) {
  const t = useTranslations("deal.card");
  const text = useDealText();
  const urgency = urgencyOf(deal, now);
  const counts = { left: deal.left, total: deal.total };

  let tag: { text: string; hot: boolean } | undefined;
  let status: string;
  if (deal.live) {
    status = t(urgency?.kind === "lowStock" ? "openLow" : "open", counts);
    if (urgency) tag = { text: urgency.kind === "closing" ? t("hotClosing", { minutes: urgency.minutes }) : t("hot", counts), hot: true };
  } else {
    const when = text.webStatus(deal, now);
    status = when ? t("later", { when, ...counts }) : `${deal.left}/${deal.total}`;
    if (when) tag = { text: when, hot: false };
  }
  return { urgency, tag, status };
}

/** T4 va WT2 lentasidagi chegirma kartasi. */
export function FeedDealCard({ deal, now }: { deal: FeedDeal; now: Date }) {
  const t = useTranslations("deal.card");
  const tDeal = useTranslations("deal");
  const text = useDealText();
  const { urgency, tag, status } = useDealMarks(deal, now);

  return (
    <FeedCard
      href={`/chegirmalar/${deal.id}`}
      badge={deal.badge}
      store={deal.store}
      where={[deal.district, deal.distanceKm !== null ? formatKm(deal.distanceKm) : null].filter(Boolean).join(" · ")}
      title={deal.title}
      price={deal.price ? { now: formatSom(deal.price.now), old: deal.price.old ? formatSom(deal.price.old) : undefined, currency: text.currency } : undefined}
      note={deal.price ? undefined : text.note(deal, true)}
      saves={deal.price?.old ? tDeal("saves", { amount: formatSom(deal.price.old - deal.price.now) }) : null}
      tag={tag}
      status={status}
      statusTone={urgency ? "hot" : deal.live ? "open" : "later"}
      image={deal.images[0]}
      pendingLabel={t("pending")}
      tileColor={deal.tile}
      inkColor={deal.ink}
    />
  );
}

/** Tafsilot rasmi ustidagi yorliq (T5 / WT3): kartadagi bilan bir xil matn. */
export function DealHeroTag({ deal, now, className }: { deal: FeedDeal; now: Date; className?: string }) {
  const { tag } = useDealMarks(deal, now);
  return tag ? (
    <DealTag hot={tag.hot} className={className}>
      {tag.text}
    </DealTag>
  ) : null;
}
