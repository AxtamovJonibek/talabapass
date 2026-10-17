"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { setNotifyDealsAction } from "@/server/actions/student-profile";

function useNotify(initial: boolean) {
  const t = useTranslations("profile");
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const change = (next: boolean) => {
    setOn(next);
    start(async () => {
      const saved = await setNotifyDealsAction(next);
      setOn(saved);
      toast(saved ? t("notifyOnToast") : t("notifyOffToast"), saved ? "ok" : "info");
    });
  };
  return { on, change, pending };
}

/** T8: "Yangi chegirmalar haqida xabar" kaliti. */
export function NotifySwitch({ initial }: { initial: boolean }) {
  const t = useTranslations("profile");
  const { on, change, pending } = useNotify(initial);
  return <Switch id="notif" checked={on} onChange={change} label={t("notify")} disabled={pending} aria-busy={pending} />;
}

/** WT4: "Bildirishnomalar — yoqilgan/o'chirilgan" qatori; bosilsa almashadi. */
export function NotifyRow({ initial, className }: { initial: boolean; className: string }) {
  const t = useTranslations();
  const { on, change, pending } = useNotify(initial);
  return (
    <button type="button" role="switch" aria-checked={on} disabled={pending} aria-busy={pending} onClick={() => change(!on)} className={cn(className, "w-full border-x-0 border-t-0 bg-transparent text-left font-sans text-16")}>
      {t("history.menu.notifications")}
      <span className={cn("ml-auto text-13 font-bold", on ? "text-green" : "text-muted")}>{on ? t("history.menu.on") : t("history.menu.off")}</span>
    </button>
  );
}
