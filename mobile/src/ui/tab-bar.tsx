import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { cachedCoupons, onCouponsChange } from "@/lib/offline";
import { colors, font } from "@/theme";
import { Icon, type IconName } from "./icons";
import { Txt } from "./kit";

const ICONS: Record<string, IconName> = { deals: "tag", nearby: "map", coupon: "ticket", saved: "bookmark", profile: "user" };

/**
 * Pastki menyu (saytdagi talaba pastki navigatsiyasi, 84px): belgi + yozuv, faoli ko'k. "Kupon" ustida faol kupon
 * bo'lsa to'q sariq nuqta (qurilmadagi nusxadan — internetsiz ham).
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const [hasCoupon, setHasCoupon] = useState(false);
  useEffect(() => {
    void cachedCoupons().then((list) => setHasCoupon(list.length > 0));
    return onCouponsChange((list) => setHasCoupon(list.length > 0));
  }, []);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const title = descriptors[route.key]?.options.title ?? route.name;
        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        const color = focused ? colors.blue : colors.muted2;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={title}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <View style={[styles.iconWrap, focused ? styles.iconOn : null]}>
              <Icon name={ICONS[route.name] ?? "all"} size={24} strokeWidth={focused ? 2.6 : 2.2} color={color} />
              {route.name === "coupon" && hasCoupon ? <View style={styles.dot} /> : null}
            </View>
            <Txt numberOfLines={1} style={[font(focused ? 800 : 600), { fontSize: 11, color: focused ? colors.ink : colors.muted2 }]}>
              {title}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: colors.white, borderTopWidth: 1.5, borderTopColor: colors.lineSoft, paddingTop: 8, paddingHorizontal: 6 },
  item: { flex: 1, alignItems: "center", gap: 3, minHeight: 56, justifyContent: "center" },
  pressed: { transform: [{ scale: 0.94 }] },
  iconWrap: { width: 52, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  iconOn: { backgroundColor: colors.blueTint },
  dot: { position: "absolute", top: 2, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.white },
});
