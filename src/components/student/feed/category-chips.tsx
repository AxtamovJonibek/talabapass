"use client";

import { useTranslations } from "next-intl";
import { CategoryPill } from "@/components/ui/category-pill";
import type { FeedCategory } from "@/lib/feed";
import { useDealText } from "./labels";

type Props = {
  categories: FeedCategory[];
  value: string;
  onChange: (slug: string) => void;
};

const ALL: FeedCategory = { slug: "all", icon: "all", tile: "var(--color-white)", ink: "var(--color-ink)" };

/** Kategoriya chiplari qatori (T4). */
export function CategoryChips({ categories, value, onChange }: Props) {
  const t = useTranslations("feed");
  const text = useDealText();
  return (
    <div role="group" aria-label={t("categories")} className="flex gap-2 overflow-x-auto px-4 py-1">
      {[ALL, ...categories].map((c) => (
        <CategoryPill key={c.slug} selected={value === c.slug} label={text.category(c.slug)} icon={c.icon} tileColor={c.tile} inkColor={c.ink} onClick={() => onChange(c.slug)} />
      ))}
    </div>
  );
}
