"use client";

import dynamic from "next/dynamic";
import type { FeedDeal } from "@/lib/feed";
import type { Point } from "@/lib/geo";

// MapLibre og'ir — faqat "Xarita" tanlanganda yuklanadi
const DealsMap = dynamic(() => import("./deals-map"), { ssr: false });

export function FeedMap({ deals, origin, now, className }: { deals: FeedDeal[]; origin: Point | null; now: Date; className?: string }) {
  return <DealsMap deals={deals} origin={origin} now={now} className={className} />;
}
