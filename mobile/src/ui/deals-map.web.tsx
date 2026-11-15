import { StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { Icon } from "./icons";
import { Txt } from "./kit";
import type { DealsMapProps } from "./deals-map";

/** Web (faqat dizaynni ko'rib chiqish): react-native-maps brauzerda ishlamaydi — xarita o'rnida belgi. */
export function DealsMap({ deals }: DealsMapProps) {
  return (
    <View style={styles.box}>
      <Icon name="map" size={40} color={colors.muted} />
      <Txt style={[font(700), { color: colors.muted }]}>{copy.nearby.count(deals.length)}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.track, alignItems: "center", justifyContent: "center", gap: 8 },
});
