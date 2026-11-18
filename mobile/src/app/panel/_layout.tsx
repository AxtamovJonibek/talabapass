import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { OrdersWatch } from "@/business/orders-watch";
import { copy } from "@/copy";
import { registerPush } from "@/lib/push";
import { resetTo, routeFor, useApp } from "@/state";
import { colors } from "@/theme";
import { BIZ_TABS, TabBar } from "@/ui/tab-bar";

/**
 * Biznes ilovasi (kirgandan keyin) — saytdagi kabi: egasi — qora pastki menyu (Skaner, Buyurtmalar, Chegirmalar,
 * Statistika, Profil; Sotuvlar — statistikadan); kassir — menyusiz skaner (server ham boshqasiga 403 beradi). Egasi faqat tasdiqlangan biznes bilan
 * (aks holda `routeFor` — ariza yoki tekshiruv ekrani). Push: ruxsat va token (bosilgan xabar — `PushHandler`, ildizda).
 * Android "orqaga" (`backBehavior="firstRoute"`): istalgan tabdan → birinchi tab (egasi — Statistika, kassir — Skaner;
 * shuning uchun kassirda Skaner ro'yxatda birinchi), undan — ilova fonga.
 */
export default function BusinessTabs() {
  const { me } = useApp();
  const owner = me?.role === "BUSINESS_OWNER" && (me.business?.status === "APPROVED" || me.business?.status === "WARNED");
  const cashier = me?.role === "CASHIER" && Boolean(me.business);
  const allowed = owner || cashier;

  useEffect(() => {
    if (me && !allowed) resetTo(routeFor(me));
  }, [me, allowed]);

  useEffect(() => {
    if (allowed) void registerPush();
  }, [allowed]);

  if (!allowed) return null;
  const hidden = owner ? {} : { href: null };

  return (
    <OrdersWatch active={owner}>
      {/* Boshlang'ich tab manzildan: egasi — /panel/stats, kassir — /panel/scan (`routeFor`) */}
      <Tabs
        backBehavior="firstRoute"
        tabBar={(props) => (owner ? <TabBar {...props} {...BIZ_TABS} /> : null)}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
      >
        {/* Saytdagi tartib: Skaner, Buyurtmalar, Chegirmalar, Statistika, Profil; kassirda menyu yo'q (skanerda "Hisobdan chiqish") */}
        <Tabs.Screen name="scan" options={{ title: copy.biz.tabs.scan }} />
        <Tabs.Screen name="orders" options={{ title: copy.biz.tabs.orders, ...hidden }} />
        <Tabs.Screen name="discounts" options={{ title: copy.biz.tabs.discounts, ...hidden }} />
        <Tabs.Screen name="stats" options={{ title: copy.biz.tabs.stats, ...hidden }} />
        <Tabs.Screen name="profile" options={{ title: copy.biz.tabs.profile, ...hidden }} />
        {/* Menyuda yo'q (TabBar belgisi yo'q tabni ko'rsatmaydi); `href: null` emas — manzil bilan ochilishi uchun */}
        <Tabs.Screen name="sales" options={{ title: copy.biz.tabs.sales, ...hidden }} />
        <Tabs.Screen name="cashiers" options={{ title: copy.biz.cashiers.title, ...hidden }} />
      </Tabs>
    </OrdersWatch>
  );
}
