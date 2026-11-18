import { router } from "expo-router";
import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OrderStatus } from "@/api/endpoints";
import { copy } from "@/copy";
import { clock, toTashkent } from "@/lib/format";
import { colors, em, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";
import { mono } from "./ui";

/**
 * Saytdagi telefon "ichki sahifa" qobig'i (`PhoneSubScreen` / `OrdersFrame`): 58px tepada, "← Orqaga" (44px), 30px sarlavha
 * (900 / 112%), 20px yon padding. Orqaga — standart profilga (ichki sahifalar profil tabida).
 */
export function SubScreen({
  title,
  back,
  onBack,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  back?: string;
  onBack?: () => void;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 58, paddingBottom: insets.bottom + 24 }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.blue} /> : undefined}
    >
      <Press onPress={onBack ?? (() => router.navigate("/profile"))} accessibilityRole="link" scale={0.98} style={s.back}>
        <Icon name="chevronLeft" size={16} />
        <Txt style={[font(700), { fontSize: 14 }]}>{back ?? copy.back}</Txt>
      </Press>
      <Txt accessibilityRole="header" style={[font(900, 112), s.title]}>
        {title}
      </Txt>
      {children}
    </ScrollView>
  );
}

const ORDER_TONE: Record<OrderStatus, { bg: string; fg: string }> = {
  PENDING_PAYMENT: { bg: colors.warnBg, fg: colors.warn },
  PAID: { bg: colors.infoBg, fg: colors.blue },
  CONFIRMED: { bg: colors.infoBg, fg: colors.blue },
  READY: { bg: colors.greenBg, fg: colors.greenSite },
  COMPLETED: { bg: colors.surface, fg: colors.ink },
  REJECTED: { bg: colors.dangerBg, fg: colors.danger },
  CANCELLED: { bg: colors.surface, fg: colors.muted },
  NO_SHOW: { bg: colors.dangerBg, fg: colors.danger },
  EXPIRED: { bg: colors.dangerBg, fg: colors.danger },
};

/** Buyurtma holati belgisi (saytdagi `StatusBadge`): rounded-8, px-2 py-1, mono 11 bold uppercase */
export function OrderBadge({ status }: { status: OrderStatus }) {
  const tone = ORDER_TONE[status];
  return (
    <View style={[s.badge, { backgroundColor: tone.bg }]} testID="order-status">
      <Txt style={[mono(700), { fontSize: 11, letterSpacing: em(11, 0.06), color: tone.fg }]}>{(copy.orders.status[status] ?? status).toUpperCase()}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  title: { marginTop: 8, marginBottom: 16, fontSize: 30, lineHeight: 30, letterSpacing: em(30, -0.03) },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
});

/** "Bugun, 14:00–14:30" yoki to'lab olib ketishda "21-noyabr gacha" (saytdagi `useWhen`) */
export function orderWhen(startIso: string, endIso: string, kind: string): string {
  const o = copy.orders;
  if (kind === "PREPAID_PICKUP") {
    const last = new Date(toTashkent(new Date(endIso)).date.getTime() - 86_400_000);
    return o.validUntil(`${last.getUTCDate()}-${copy.months[last.getUTCMonth()]}`);
  }
  const start = toTashkent(new Date(startIso));
  const today = toTashkent(new Date()).date.getTime();
  const day = start.date.getTime() === today ? o.today : start.date.getTime() === today + 86_400_000 ? o.tomorrow : `${start.date.getUTCDate()}-${copy.months[start.date.getUTCMonth()]}`;
  return `${day}, ${clock(startIso)}–${clock(endIso)}`;
}

