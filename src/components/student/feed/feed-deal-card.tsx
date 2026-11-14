"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { DealTag, FeedCard } from "@/components/ui/feed-card";
import { StatusPill } from "@/components/ui/status-pill";
import { urgencyOf, type FeedDeal } from "@/lib/feed";
import { formatSom } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { useDealText } from "./labels";

/**
 * Karta va tafsilot rasmidagi belgilar: holat pilyulkasi (ochiq / tez orada / yopiq) va alohida zaxira yorlig'i
 * ("Tez tugaydi · 2/20" — faqat oz qolganda, pilyulka ostida). Pastki qatorda — qoldiq.
 */
export function useDealMarks(deal: FeedDeal, now: Date) {
  const t = useTranslations("deal.card");
  const text = useDealText();
  const urgency = urgencyOf(deal, now);
  const counts = { left: deal.left, total: deal.total };
  const lowStock = deal.live && urgency?.kind === "lowStock";
  const stock = lowStock ? t("hot", counts) : undefined;
  const status = t(lowStock ? "leftLow" : "left", counts);
  return { urgency: lowStock ? urgency : null, pill: text.pill(deal, now), stock, status };
}

/** Rasm ustidagi belgilar ustuni: pilyulka, ostida (bo'lsa) zaxira yorlig'i — bir-birini yopmaydi. */
export function DealImageMarks({ deal, now, className }: { deal: FeedDeal; now: Date; className?: string }) {
  const { pill, stock } = useDealMarks(deal, now);
  return (
    <div className={cn("flex flex-col items-start gap-1.5", className)}>
      <StatusPill tone={pill.tone} onImage>
        {pill.text}
      </StatusPill>
      {stock ? (
        <DealTag hot className="rounded-full" data-testid="stock-tag">
          {stock}
        </DealTag>
      ) : null}
    </div>
  );
}

/** T4 va WT2 lentasidagi chegirma kartasi. */
export function FeedDealCard({ deal, now }: { deal: FeedDeal; now: Date }) {
  const t = useTranslations("deal.card");
  const tDeal = useTranslations("deal");
  const text = useDealText();
  const { urgency, status } = useDealMarks(deal, now);

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
      marks={<DealImageMarks deal={deal} now={now} className="absolute top-3 left-3 z-[2] max-w-[calc(100%-96px)]" />}
      status={status}
      statusTone={urgency ? "hot" : "later"}
      image={deal.images[0]}
      pendingLabel={t("pending")}
      tileColor={deal.tile}
      inkColor={deal.ink}
    />
  );
}

/** Tafsilot rasmi ustidagi belgilar (T5 / WT3): kartadagi bilan bir xil. */
export const DealHeroTag = DealImageMarks;
