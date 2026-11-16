import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "@/copy";
import { formatWhen } from "@/lib/format";
import { useOffline } from "@/lib/network";
import { colors, font } from "@/theme";
import { Icon } from "./icons";
import { Txt } from "./kit";

/**
 * Tarmoq yo'q banneri (ildizda, har ekran ustida): yuqorida kichik qora pilyulka, bosishni to'smaydi. Ekranlar shu paytda
 * oxirgi saqlangan ma'lumotni ko'rsatadi (`useLoad` `cacheKey`), yozuvchi amallar aniq xato beradi.
 */
export function OfflineBanner() {
  const offline = useOffline();
  const insets = useSafeAreaInsets();
  if (!offline) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]} accessibilityLiveRegion="polite">
      <View style={styles.pill}>
        <Icon name="info" size={16} color={colors.orange} strokeWidth={2.6} />
        <Txt style={[font(800), styles.text]}>{copy.offlineBanner}</Txt>
      </View>
    </View>
  );
}

/** "Oxirgi yangilanish: bugun, 14:42" — ma'lumot keshdan ko'rsatilayotganda (`Load.staleAt`) */
export function StaleNote({ at, style }: { at: number | null; style?: StyleProp<ViewStyle> }) {
  if (at === null) return null;
  return (
    <View style={[styles.stale, style]}>
      <Icon name="clock" size={14} color={colors.muted} strokeWidth={2.4} />
      <Txt style={[font(700), styles.staleText]}>{copy.staleAt(formatWhen(new Date(at).toISOString()))}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 100 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  text: { fontSize: 13, color: colors.white },
  stale: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.track, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  staleText: { fontSize: 12, color: colors.muted },
});
