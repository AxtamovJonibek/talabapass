import { router, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { appApi } from "@/api/endpoints";
import { onPushOpen, syncBadge } from "@/lib/push";
import { pushRoute } from "@/lib/push-route";
import { resetTo, routeFor, useApp } from "@/state";

/**
 * Bosilgan push xabari → tegishli ekran (deep link, `pushRoute`). Ilova yopiq turganda bosilgan bo'lsa — kirish
 * aniqlanib, ishga tushish ekrani (`/`) o'z yo'nalishini qilgandan keyin ochiladi. Qaror xabarlarida (guvohnoma, ariza)
 * avval `me` yangilanadi — holat o'zgargan bo'ladi. Ilova oldingi planga qaytganda ikonka raqami yangilanadi.
 */
export function PushHandler() {
  const { me, reloadMe } = useApp();
  const pathname = usePathname();
  const [pending, setPending] = useState<{ url: string | null } | null>(null);
  const handling = useRef(false);

  useEffect(() => onPushOpen((url) => setPending({ url })), []);

  useEffect(() => {
    if (!pending || !me || pathname === "/" || handling.current) return;
    handling.current = true;
    void reloadMe()
      .catch(() => me)
      .then((fresh) => {
        const target = pushRoute(pending.url, fresh);
        if (target) router.push(target);
        else resetTo(routeFor(fresh));
      })
      .finally(() => {
        handling.current = false;
        setPending(null);
      });
  }, [pending, me, pathname, reloadMe]);

  const inbox = me?.role === "STUDENT" || me?.role === "BUSINESS_OWNER";
  useEffect(() => {
    if (!inbox) return;
    const sync = () =>
      void appApi
        .notifications()
        .then((r) => syncBadge(r.unread))
        .catch(() => undefined);
    sync();
    const sub = AppState.addEventListener("change", (state) => state === "active" && sync());
    return () => sub.remove();
  }, [inbox]);

  return null;
}
