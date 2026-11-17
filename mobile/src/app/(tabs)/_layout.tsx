import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { copy } from "@/copy";
import { registerPush } from "@/lib/push";
import { resetTo, routeFor, useApp } from "@/state";
import { colors } from "@/theme";
import { TabBar } from "@/ui/tab-bar";

/**
 * Talaba ilovasi (kirgandan keyin): Chegirmalar, Yaqin, Kupon, Saralangan, Profil. Faqat tasdiqlangan (APPROVED)
 * talaba uchun — boshqa holatda o'z ekraniga (`routeFor`: DRAFT/EXPIRED — guvohnoma, PENDING/REJECTED — tekshiruv).
 * Push: tablarga kirganda ruxsat so'raladi va token yuboriladi (xatolar yutiladi).
 * Android "orqaga" (`backBehavior="firstRoute"`): tablar orasida tarix yig'ilmaydi — istalgan tabdan orqaga → Chegirmalar,
 * Chegirmalardan → ilova fonga o'tadi (ildiz stekda tablardan oldin ekran yo'q: kirish `resetTo` bilan tozalangan).
 */
export default function StudentTabs() {
  const { me } = useApp();
  const approved = me?.role === "STUDENT" && me.student?.status === "APPROVED";

  useEffect(() => {
    if (me && !approved) resetTo(routeFor(me));
  }, [me, approved]);

  useEffect(() => {
    if (approved) void registerPush();
  }, [approved]);

  if (!approved) return null;

  return (
    <Tabs backBehavior="firstRoute" tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}>
      <Tabs.Screen name="deals" options={{ title: copy.tabs.deals }} />
      <Tabs.Screen name="nearby" options={{ title: copy.tabs.nearby }} />
      <Tabs.Screen name="coupon" options={{ title: copy.tabs.coupon }} />
      <Tabs.Screen name="saved" options={{ title: copy.tabs.saved }} />
      <Tabs.Screen name="profile" options={{ title: copy.tabs.profile }} />
    </Tabs>
  );
}
