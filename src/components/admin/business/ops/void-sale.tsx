"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmAction } from "@/components/admin/super/controls";
import { Input } from "@/components/ui/field";
import { voidSaleAction } from "@/server/actions/admin-business";

/** Xato sotuvni bekor qilish: sabab majburiy (kamida 3 belgi), tasdiqdan keyin */
export function VoidSale({ redemptionId }: { redemptionId: string }) {
  const t = useTranslations("adminBusiness.ops.sales");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction label={t("void")} confirmText={t("voidConfirm")} run={() => voidSaleAction({ redemptionId, reason })} danger testId="ops-sale-void">
      <Input compact value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reason")} aria-label={t("reason")} maxLength={200} data-testid="ops-sale-reason" />
    </ConfirmAction>
  );
}
