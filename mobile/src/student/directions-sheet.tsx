import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View, type ImageSourcePropType } from "react-native";
import type { Point } from "@/api/endpoints";
import { copy } from "@/copy";
import { openDirections, PROVIDERS, type Provider } from "@/lib/directions";
import { colors, font } from "@/theme";
import { Sheet } from "@/ui/app";
import { BRAND_LOGOS } from "@/ui/brands";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

const LOGO: Record<Provider, ImageSourcePropType> = { yandex: BRAND_LOGOS.yandexMaps, google: BRAND_LOGOS.googleMaps, yandexGo: BRAND_LOGOS.yandexGo };

/**
 * "Qanday borasiz?": faqat manzil, "Nusxalash" (bosilsa "Nusxalandi" va yengil tebranish) va 3 katak — Yandex Xaritalar,
 * Google Maps, Yandex Go (rasmiy belgilari bilan). Marshrut turi yo'q. Havola avval ilovada, ilova bo'lmasa brauzerda
 * ochiladi (`src/lib/directions.ts`).
 */
export function DirectionsSheet({
  visible,
  onClose,
  target,
}: {
  visible: boolean;
  onClose: () => void;
  target: { address: string; district: string | null; point: Point | null };
}) {
  const d = copy.directions;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  const copyAddress = async () => {
    await Clipboard.setStringAsync([target.address, target.district].filter(Boolean).join(", "));
    setCopied(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={d.title} titleSize={28} close={false}>
      <View style={styles.place}>
        <View style={styles.flex1}>
          <Txt style={[font(800), styles.address]}>{target.address}</Txt>
        </View>
        <Press
          onPress={() => void copyAddress()}
          accessibilityRole="button"
          accessibilityLiveRegion="polite"
          scale={0.95}
          style={[styles.copy, { backgroundColor: copied ? colors.greenTint : colors.paper }]}
        >
          <Icon name={copied ? "tick" : "copy"} size={16} color={copied ? colors.greenOk : colors.ink} />
          <Txt style={[font(800), styles.copyText, { color: copied ? colors.greenOk : colors.ink }]}>{copied ? d.copied : d.copy}</Txt>
        </Press>
      </View>

      <View style={styles.grid}>
        {PROVIDERS.map((p) => {
          const [first, second] = d.providers[p].split("\n");
          return (
            <Press
              key={p}
              onPress={() => {
                void openDirections(p, target).then((opened) => opened && onClose());
              }}
              accessibilityRole="link"
              accessibilityLabel={p === "yandexGo" ? `${d.providers[p]}, ${d.taxi}` : d.providers[p].replace("\n", " ")}
              scale={0.96}
              style={styles.cell}
            >
              <Image source={LOGO[p]} style={styles.logo} resizeMode="contain" resizeMethod="resize" accessibilityLabel={d.logo(d.providers[p].replace("\n", " "))} />
              <Txt style={[font(800), styles.label]}>
                {first}
                {"\n"}
                {p === "yandexGo" ? <Txt style={[font(600), { color: colors.muted2 }]}>{d.taxi}</Txt> : second}
              </Txt>
            </Press>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  place: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 18, paddingVertical: 12, paddingLeft: 16, paddingRight: 8 },
  address: { fontSize: 15 },
  copy: { height: 44, paddingHorizontal: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  copyText: { fontSize: 14 },
  grid: { flexDirection: "row", gap: 8, marginTop: 10 },
  cell: { flex: 1, alignItems: "center", gap: 10, paddingTop: 16, paddingBottom: 14, paddingHorizontal: 6, borderRadius: 20, backgroundColor: colors.white },
  logo: { width: 52, height: 52 },
  label: { fontSize: 13, lineHeight: 16, textAlign: "center" },
});
