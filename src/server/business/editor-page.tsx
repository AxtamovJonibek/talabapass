import "server-only";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DiscountEditorScreen } from "@/components/business/discount/editor-screen";
import type { IconName } from "@/components/ui/icons";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "../auth/session";
import { db } from "../db";
import { CATEGORY_BY_KIND, ownDiscount, ownerBusinessForDiscounts, todayInTashkent, visitHint } from "./discounts";

/** /biznes/chegirma/yangi va /biznes/chegirma/[id] uchun umumiy server qismi. */
export async function DiscountEditorPage({ discountId }: { discountId: string | null }) {
  const user = await requireRole("BUSINESS_OWNER");
  const business = await ownerBusinessForDiscounts(user.id);
  if (!business) return redirect({ href: "/biznes", locale: await getLocale() });

  const existing = discountId ? await ownDiscount(user.id, discountId) : null;
  if (discountId && !existing) notFound();
  const category =
    existing?.category ??
    (await db.category.findUniqueOrThrow({ where: { slug: CATEGORY_BY_KIND[business.kind] }, select: { icon: true, tileColor: true, inkColor: true } }));

  const t = await getTranslations("discountEditor");
  const statusText = existing
    ? existing.status === "REJECTED"
      ? t("status.REJECTED", { reason: existing.rejectReason ?? "—" })
      : t(`status.${existing.status}`)
    : null;

  return (
    <DiscountEditorScreen
      id={existing?.id ?? null}
      initial={existing?.draft ?? null}
      today={todayInTashkent()}
      category={{ ...category, icon: category.icon as IconName }}
      businessName={business.name}
      statusText={statusText}
      businessPending={business.status === "PENDING"}
      live={existing?.status === "ACTIVE" || existing?.status === "PAUSED"}
      hint={await visitHint(user.id)}
    />
  );
}
