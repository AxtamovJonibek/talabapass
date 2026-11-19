import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PushMessage } from "@/lib/push";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Txt } from "@/ui/kit";

const SHOW_MS = 5000;

/** Ochiq ilovada tepadan tushuvchi xabar banneri: 5 soniyadan keyin yo'qoladi, bosilsa — `onPress`. */
export function PushBanner({ message, onPress, onHide }: { message: PushMessage | null; onPress: (m: PushMessage) => void; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const [y] = useState(() => new Animated.Value(-160));

  useEffect(() => {
    if (!message) return;
    y.setValue(-160);
    Animated.timing(y, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const id = setTimeout(onHide, SHOW_MS);
    return () => clearTimeout(id);
  }, [message, onHide, y]);

  if (!message) return null;
  const shown = message;
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[shown.title, shown.body].filter(Boolean).join(". ")}
        onPress={() => onPress(message)}
        style={styles.card}
      >
        <View style={styles.icon}>
          <Icon name="bell" size={20} color={colors.white} />
        </View>
        <View style={styles.text}>
          <Txt numberOfLines={1} style={[font(800), styles.title]}>
            {shown.title}
          </Txt>
          {shown.body ? (
            <Txt numberOfLines={2} style={[font(600), styles.body]}>
              {shown.body}
            </Txt>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 100, elevation: 100 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.ink },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: colors.white },
  body: { fontSize: 13, color: colors.line },
});
