"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { toggleSavedAction } from "@/server/actions/student-feed";

const ROUND = "tp-lift flex size-11 items-center justify-center rounded-full border-0 bg-white text-ink transition-[scale] duration-150 ease-out active:scale-90";

/** T5 "Ulashish": tizim oynasi, bo'lmasa havolani nusxalash. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("dealPage");
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    toast(t("copied"));
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" aria-label={copied ? t("copied") : t("share")} title={copied ? t("copied") : undefined} onClick={share} className={ROUND}>
      <Icon name={copied ? "check" : "share"} size={19} />
    </button>
  );
}

/** T5 "Saqlash" — saqlangan bo'lsa to'ldirilgan belgi. */
export function SaveButton({ discountId, saved: initial }: { discountId: string; saved: boolean }) {
  const t = useTranslations("dealPage");
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      setSaved(!saved);
      const result = await toggleSavedAction(discountId);
      setSaved(result.saved);
      toast(result.saved ? t("savedToast") : t("unsavedToast"));
    });
  return (
    <button type="button" aria-label={saved ? t("unsave") : t("save")} aria-pressed={saved} disabled={pending} aria-busy={pending} onClick={toggle} className={cn(ROUND, "disabled:opacity-100")}>
      <Icon name="bookmark" size={19} filled={saved} />
    </button>
  );
}
