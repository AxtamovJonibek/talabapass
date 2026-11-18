import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { SubScreen } from "@/site/screen";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { LEGAL, openSite } from "@/ui/legal";
import { Press, Txt } from "@/ui/kit";

/** Aloqa (saytdagi `src/lib/contacts.ts` bilan bir xil manzillar) */
const CONTACT = { telegram: "axtamovjonibek", email: "talabapass@gmail.com", channel: "https://t.me/talabapass", instagram: "https://instagram.com/talabapass" } as const;

function Faq({ q, a, last }: { q: string; a: string; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={last ? null : styles.sep}>
      <Press onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} scale={1} style={styles.q}>
        <Txt style={[font(700), styles.flex1, { fontSize: 15 }]}>{q}</Txt>
        <View style={open ? { transform: [{ rotate: "180deg" }] } : null}>
          <Icon name="chevronDown" size={16} color={colors.placeholder} />
        </View>
      </Press>
      {open ? <Txt style={styles.a}>{a}</Txt> : null}
    </View>
  );
}

/** Yordam markazi (saytdagi `/yordam`): bog'lanish va ko'p so'raladigan savollar */
export default function Help() {
  const h = copy.help;
  const rows = [
    { label: h.telegram, value: `@${CONTACT.telegram}`, url: `https://t.me/${CONTACT.telegram}` },
    { label: h.email, value: CONTACT.email, url: `mailto:${CONTACT.email}` },
    { label: h.channel, value: "@talabapass", url: CONTACT.channel },
    { label: "Instagram", value: "@talabapass", url: CONTACT.instagram },
  ];
  return (
    <SubScreen title={h.title}>
      <Txt style={[font(800, 110), styles.h2]}>{h.contactTitle}</Txt>
      <Txt style={styles.lead}>{h.contactLead}</Txt>
      <View style={styles.card}>
        {rows.map((r, i) => (
          <Press key={r.url} onPress={() => void Linking.openURL(r.url)} accessibilityRole="link" scale={0.99} style={[styles.row, i < rows.length - 1 ? styles.sep : null]}>
            <Txt style={[font(600), styles.flex1, { fontSize: 15 }]}>{r.label}</Txt>
            <Txt style={{ fontSize: 13, color: colors.muted }}>{r.value}</Txt>
          </Press>
        ))}
      </View>
      <Txt style={[font(800, 110), styles.h2, { marginTop: 24, marginBottom: 12 }]}>{h.faqTitle}</Txt>
      <View style={styles.card}>
        {h.items.map((item, i) => (
          <Faq key={item.q} q={item.q} a={item.a} last={i === h.items.length - 1} />
        ))}
      </View>
      <Press onPress={() => openSite(LEGAL.privacy)} accessibilityRole="link" scale={0.98} style={styles.legal}>
        <Txt style={[font(700), { fontSize: 14, textDecorationLine: "underline" }]}>{h.legal}</Txt>
      </Press>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  h2: { fontSize: 18, marginBottom: 4 },
  lead: { marginBottom: 12, fontSize: 14, color: colors.muted },
  card: { overflow: "hidden", borderRadius: 16, backgroundColor: colors.white },
  row: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  q: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  a: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 14, lineHeight: 21.7, color: colors.muted },
  legal: { marginTop: 24, height: 44, justifyContent: "center", alignSelf: "flex-start" },
});
