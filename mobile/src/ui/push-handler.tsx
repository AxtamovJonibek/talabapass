import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { appApi } from "@/api/endpoints";
import { onPushOpen, onPushReceived, registerPush, syncBadge, type PushMessage } from "@/lib/push";
import { pushRoute } from "@/lib/push-route";
import { resetTo, routeFor, useApp } from "@/state";
import { PushBanner } from "@/ui/push-banner";

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
  const [banner, setBanner] = useState<PushMessage | null>(null);
  const hideBanner = useCallback(() => setBanner(null), []);

  // Ruxsat va qurilma tokeni — kirgan har qanday talaba/biznes/kassir uchun (tasdiq/rad xabari holati kutilayotganlarga ham keladi)
  const userId = me?.id;
  useEffect(() => {
    if (userId) void registerPush();
  }, [userId]);

  // Ilova ochiq: tepadan banner; qaror xabarlarida holat darhol yangilanadi
  useEffect(
    () =>
      onPushReceived((message) => {
        setBanner(message);
        void reloadMe().catch(() => undefined);
      }),
    [reloadMe],
  );

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

  return (
    <PushBanner
      message={banner}
      onHide={hideBanner}
      onPress={(m) => {
        setBanner(null);
        setPending({ url: m.url });
      }}
    />
  );
}
