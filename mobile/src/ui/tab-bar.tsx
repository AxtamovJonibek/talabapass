import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { cachedCoupons, onCouponsChange } from "@/lib/offline";
import { colors, font } from "@/theme";
import { Icon, type IconName } from "./icons";
import { Txt } from "./kit";

/** Talaba (saytdagi `StudentBottomNav`): Asosiy, Kuponlar, Tarix, Profil */
export const STUDENT_TABS = { icons: { deals: "home", coupon: "ticket", history: "clock", profile: "user" } as Record<string, IconName>, tone: "light" as const };
/** Biznes egasi (saytdagi `OwnerBottomNav`): qora, faoli to'q sariq */
export const BIZ_TABS = {
  icons: { scan: "scan", orders: "receipt", discounts: "ticket", stats: "chart", profile: "store" } as Record<string, IconName>,
  tone: "dark" as const,
  // Menyuda yo'q sahifalar: "Sotuvlar" — "Statistika", "Kassirlar" — "Profil" faol (saytdagidek)
  activeAs: { sales: "stats", cashiers: "profile" } as Record<string, string>,
};

/**
 * Pastki menyu — saytdagi `ui/bottom-nav.tsx` bilan bir xil: 66px + pastki xavfsiz hudud (kamida 18), yuqorida 1px chiziq;
 * ikonka 22 (→ 20, shkala) va 11px yozuv; faoli — qalin (talabada qora, "Asosiy" to'ldirilgan; biznesda to'q sariq).
 * "Kuponlar" ustida faol kuponlar soni (qurilmadagi nusxadan — internetsiz ham). `href: null` (rolga yopiq) tab ko'rinmaydi.
 */
export function TabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
  icons = STUDENT_TABS.icons,
  tone = "light",
  activeAs = {},
}: BottomTabBarProps & { icons?: Record<string, IconName>; tone?: "light" | "dark"; activeAs?: Record<string, string> }) {
  const [coupons, setCoupons] = useState(0);
  useEffect(() => {
    void cachedCoupons().then((list) => setCoupons(list.length));
    return onCouponsChange((list) => setCoupons(list.length));
  }, []);
  const dark = tone === "dark";

  return (
    <View style={[styles.bar, dark ? styles.barDark : null, { paddingBottom: Math.max(insets.bottom, 18) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        // Belgisi yo'q tab (masalan "Sotuvlar") menyuda chiqmaydi, lekin manzil bilan ochiladi
        if (!(route.name in icons) || (descriptors[route.key]?.options as { hidden?: boolean } | undefined)?.hidden) return null;
        const current = state.routes[state.index]?.name ?? "";
        const focused = index === state.index || activeAs[current] === route.name;
        const title = descriptors[route.key]?.options.title ?? route.name;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (index !== state.index && !event.defaultPrevented) navigateToTab(route.key);
        };
        const icon = icons[route.name] ?? "all";
        const color = dark ? (focused ? colors.orange : colors.fog3) : focused ? colors.ink : colors.muted;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={title}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <Icon name={icon} size={22} color={color} fill={focused && !dark && icon === "home" ? color : "none"} />
            <Txt numberOfLines={1} style={[font(focused ? 700 : 600), { fontSize: 11, color }]}>
              {title}
            </Txt>
            {route.name === "coupon" && coupons > 0 ? (
              <View style={styles.badge}>
                <Txt style={[font(800), styles.badgeText]}>{coupons}</Txt>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  barDark: { backgroundColor: colors.ink, borderTopColor: colors.ink3 },
  item: { flex: 1, height: 66, alignItems: "center", justifyContent: "center", gap: 4 },
  pressed: { transform: [{ scale: 0.94 }] },
  badge: { position: "absolute", top: 8, left: "52%", height: 16, minWidth: 16, borderRadius: 8, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { fontSize: 10, color: colors.ink },
});
