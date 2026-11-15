import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import type { Point } from "@/api/endpoints";
import { copy } from "@/copy";
import { defaultRouteMode, directionsUrl, PROVIDERS, ROUTE_MODES, type Provider } from "@/lib/directions";
import { formatKm } from "@/lib/format";
import { colors, font } from "@/theme";
import { Chip, MenuRow, Sheet } from "@/ui/app";
import type { IconName } from "@/ui/icons";
import { Txt } from "@/ui/kit";

const PROVIDER_ICON: Record<Provider, IconName> = { yandex: "map", google: "navigate", yandexGo: "pin" };

/** "Qanday boraman?" (saytdagi `deal/directions.tsx`): biznes, manzil, masofa, mo'ljal, marshrut turi va xarita ilovalari. */
export function DirectionsSheet({
  visible,
  onClose,
  target,
}: {
  visible: boolean;
  onClose: () => void;
  target: { store: string; address: string; landmark: string | null; point: Point | null; distanceKm: number | null };
}) {
  const d = copy.directions;
  const [mode, setMode] = useState(() => defaultRouteMode(target.distanceKm));

  return (
    <Sheet visible={visible} onClose={onClose} title={d.title}>
      <View style={styles.place}>
        <Txt style={[font(800), { fontSize: 17 }]}>{target.store}</Txt>
        <Txt style={styles.meta}>{target.address}</Txt>
        {target.distanceKm !== null ? <Txt style={styles.meta}>{d.away(formatKm(target.distanceKm))}</Txt> : null}
        {target.landmark ? <Txt style={styles.meta}>{copy.deal.landmark(target.landmark)}</Txt> : null}
      </View>
      <View style={styles.modes}>
        {ROUTE_MODES.map((m) => (
          <Chip key={m} selected={mode === m} onPress={() => setMode(m)}>
            {d.modes[m]}
          </Chip>
        ))}
      </View>
      <View style={styles.list}>
        {PROVIDERS.map((p, i) => {
          const url = directionsUrl(p, target, mode);
          if (!url) return null;
          return (
            <MenuRow
              key={p}
              icon={PROVIDER_ICON[p]}
              label={d.providers[p]}
              last={i === PROVIDERS.length - 1}
              onPress={() => {
                void Linking.openURL(url);
                onClose();
              }}
            />
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  place: { backgroundColor: colors.white, borderRadius: 20, padding: 16, gap: 4 },
  meta: { fontSize: 14, lineHeight: 20, color: colors.muted2 },
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 },
  list: { backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 14 },
});
