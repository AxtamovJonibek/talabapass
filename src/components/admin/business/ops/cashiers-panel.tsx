"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ConfirmAction } from "@/components/admin/super/controls";
import { ToneBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { formatPhone } from "@/lib/format";
import { addCashierAction, blockCashierAction, removeCashierAdminAction } from "@/server/actions/admin-business";

export type CashierItem = { memberId: string; userId: string; name: string; phone: string; blocked: boolean };
export type InviteItem = { id: string; phone: string | null; until: string };

function CashierRow({ businessId, cashier }: { businessId: string; cashier: CashierItem }) {
  const t = useTranslations("adminBusiness.ops.cashiers");
  const [reason, setReason] = useState("");
  return (
    <li className="flex flex-wrap items-start gap-3 border-0 border-b border-solid border-surface py-3" data-testid="ops-cashier">
      <span className="min-w-0 flex-1">
        <b className="text-14">{cashier.name}</b>
        <div className="font-mono text-12 text-muted">{cashier.phone ? formatPhone(cashier.phone) : "—"}</div>
      </span>
      {cashier.blocked ? <ToneBadge tone="bad">{t("blocked")}</ToneBadge> : null}
      {cashier.blocked ? (
        <ConfirmAction label={t("unblock")} confirmText={t("unblockConfirm")} run={() => blockCashierAction({ businessId, userId: cashier.userId, blocked: false })} testId="ops-cashier-unblock" />
      ) : (
        <ConfirmAction label={t("block")} confirmText={t("blockConfirm")} run={() => blockCashierAction({ businessId, userId: cashier.userId, blocked: true, reason })} danger testId="ops-cashier-block">
          <Input compact value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reason")} aria-label={t("reason")} maxLength={200} />
        </ConfirmAction>
      )}
      <ConfirmAction label={t("remove")} confirmText={t("removeConfirm")} run={() => removeCashierAdminAction({ businessId, memberId: cashier.memberId })} danger testId="ops-cashier-remove" />
    </li>
  );
}

/** Kassirlar: ro'yxat, qo'shish (telefon raqami bilan taklif), bloklash, o'chirish */
export function CashiersPanel({ businessId, cashiers, invites, canInvite }: { businessId: string; cashiers: CashierItem[]; invites: InviteItem[]; canInvite: boolean }) {
  const t = useTranslations("adminBusiness.ops.cashiers");
  const failed = useTranslations("adminBusiness.ops.cashiers.errors");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      setMessage(null);
      const r = await addCashierAction({ businessId, phone });
      if (!r.ok) return setMessage({ ok: false, text: failed((r.error ?? "failed") as "failed") });
      setPhone("");
      setMessage({ ok: true, text: t("invited") });
      router.refresh();
    });

  return (
    <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={t("title")} data-testid="ops-cashiers">
      <h3 className="m-0 text-16 font-extrabold">{t("title")}</h3>
      {cashiers.length === 0 ? (
        <p className="m-0 text-13 text-muted">{t("empty")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {cashiers.map((c) => (
            <CashierRow key={c.memberId} businessId={businessId} cashier={c} />
          ))}
        </ul>
      )}
      {invites.length > 0 ? (
        <div className="flex flex-col gap-1 text-13 text-muted">
          <b className="text-ink">{t("invites")}</b>
          {invites.map((i) => (
            <span key={i.id} className="font-mono">
              {i.phone ? formatPhone(i.phone) : "—"} · {t("until", { date: i.until })}
            </span>
          ))}
        </div>
      ) : null}
      {canInvite ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Field label={t("phone")} htmlFor="ops-cashier-phone">
              <Input id="ops-cashier-phone" compact mono={14} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" maxLength={20} />
            </Field>
          </div>
          <Button variant="ink" size="sm" loading={pending} onClick={add} data-testid="ops-cashier-add">
            {t("add")}
          </Button>
        </div>
      ) : (
        <p className="m-0 text-13 text-muted">{t("notApproved")}</p>
      )}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "m-0 text-13 font-bold text-green" : "m-0 text-13 font-bold text-danger"}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
