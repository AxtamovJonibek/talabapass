"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { formatMinute, toTashkent } from "@/lib/time";
import { createInviteAction, removeCashierAction, revokeInviteAction } from "@/server/actions/cashiers";
import type { OwnerCashiers } from "@/server/business/cashiers";

const hhmm = (iso: string | Date) => {
  const t = toTashkent(new Date(iso));
  return `${t.date.toISOString().slice(8, 10)}.${t.date.toISOString().slice(5, 7)} ${formatMinute(t.minute)}`;
};

/** Sarlavha qatori: "Kassirlar" + "+ Taklif qilish" (B5). */
export function CashierHeader({ data, onInvite, pending }: { data: OwnerCashiers; onInvite: () => void; pending: boolean }) {
  const t = useTranslations("cashiers");
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="m-0 text-18 font-extrabold font-stretch-110%">{t("title")}</h2>
      {data.canInvite ? (
        <button type="button" onClick={onInvite} disabled={pending} className="flex h-11 items-center border-0 bg-transparent p-0 font-sans text-14 font-bold text-rust">
          {t("invite")}
        </button>
      ) : null}
    </div>
  );
}

/** B5 — kassirlar: ro'yxat, taklif havolasi (bir martalik, 48 soat), ochiq takliflar, o'chirish. */
export function CashierList({ data }: { data: OwnerCashiers }) {
  const t = useTranslations("cashiers");
  const router = useRouter();
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invite() {
    setError(null);
    startTransition(async () => {
      const result = await createInviteAction();
      if (!result.ok) return setError(t(result.error));
      setLink({ url: `${window.location.origin}${result.path}`, expiresAt: result.expiresAt });
      setCopied(false);
      router.refresh();
    });
  }

  function run(action: () => Promise<{ ok: boolean }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(t("failed"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <CashierHeader data={data} onInvite={invite} pending={pending} />
      {!data.canInvite ? <p className="mt-0 mb-2 text-13 text-muted">{t("notApproved")}</p> : null}
      {error ? (
        <p role="alert" className="mt-0 mb-2 text-13 font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {link ? (
        <div data-testid="invite-link" className="mb-2 flex flex-col gap-2 rounded-16 border-hair border-dashed border-line-strong p-3">
          <span className="text-12 font-bold tracking-[0.05em] text-muted uppercase">{t("linkTitle")}</span>
          <code className="rounded-10 bg-white px-3 py-2.5 font-mono text-13 break-all">{link.url}</code>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="ink"
              size="sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(link.url).catch(() => undefined);
                setCopied(true);
              }}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
            <span className="text-12 text-muted">{t("linkHint")}</span>
          </div>
        </div>
      ) : null}

      {data.cashiers.length === 0 ? (
        <p className="m-0 rounded-16 bg-white px-3.5 py-4 text-14 leading-[1.45] text-muted">{t("empty")}</p>
      ) : (
        <ul className="m-0 list-none rounded-16 bg-white p-0">
          {data.cashiers.map((c, i) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
            return (
              <li
                key={c.memberId}
                data-testid="cashier-row"
                className={cn("flex items-center gap-3 px-3.5 py-3", i < data.cashiers.length - 1 && "border-b border-solid border-surface")}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-18 bg-track text-13 font-extrabold">{initials(c.firstName, c.lastName)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-14 font-bold">{name}</div>
                  <div className="text-12 text-muted">{t("scansToday", { count: c.scansToday })}</div>
                </div>
                {c.shift === "on" ? (
                  <span className="text-12 font-bold text-green">{t("onShift")}</span>
                ) : c.shift === "ended" ? (
                  <span className="text-12 font-semibold text-muted">{t("shiftEnded")}</span>
                ) : null}
                {/* Dizaynda yo'q: egasi kassirni o'chiradi (sessiyasi darhol yopiladi) */}
                <button
                  type="button"
                  aria-label={`${t("remove")}: ${name}`}
                  title={t("remove")}
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(t("confirmRemove", { name }))) run(() => removeCashierAction(c.memberId));
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-8 border-0 bg-transparent p-0 text-muted hover:text-danger"
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data.invites.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-13 font-semibold">{t("openInvites")}</span>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {data.invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 rounded-12 bg-white px-3.5 py-2 text-13">
                <span className="font-mono text-12 text-muted">{t("inviteUntil", { time: hhmm(inv.expiresAt) })}</span>
                <Button variant="danger-ghost" size="sm" disabled={pending} onClick={() => run(() => revokeInviteAction(inv.id))}>
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
