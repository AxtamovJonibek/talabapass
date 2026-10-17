"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

/** VAPID kaliti (base64url) → PushManager kutadigan baytlar. */
function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Telefon/brauzerda push yoqish-o'chirish. Ochiq kalit server tomondan prop bilan keladi (build vaqtiga bog'lanmaydi). */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const t = useTranslations("notifications.inbox");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported()) return cancelled || setState("unsupported");
      if (Notification.permission === "denied") return cancelled || setState("denied");
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const existing = await registration?.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const response = await fetch("/api/push/obuna", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setState(response.ok ? "on" : "off");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/obuna", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-16 bg-white p-4">
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="text-15 font-bold">{t("pushTitle")}</div>
        <div className="mt-0.5 text-13 text-muted">{t(`push.${state}`)}</div>
      </div>
      {state === "off" ? (
        <Button type="button" variant="blue" size="sm" disabled={busy} aria-busy={busy} onClick={enable}>
          {t("pushEnable")}
        </Button>
      ) : null}
      {state === "on" ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} aria-busy={busy} onClick={disable}>
          {t("pushDisable")}
        </Button>
      ) : null}
    </div>
  );
}
