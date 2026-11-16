import { Linking, StyleSheet } from "react-native";
import { API_URL } from "@/api/client";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { Txt } from "./kit";

export const openSite = (path: string) => void Linking.openURL(`${API_URL}${path}`);

/**
 * Saytdagi ochiq manzillar — do'kon formalariga ham shular yoziladi (docs/store-checklist.md). Qisqa manzillar
 * `next.config.ts` da huquqiy sahifalarga yo'naltiriladi; hisobni o'chirish sahifasi ilovasiz ham ochiladi.
 */
export const LEGAL = {
  privacy: "/uz/maxfiylik",
  terms: "/uz/shartlar",
  partnerTerms: "/uz/huquqiy/biznes",
  deleteAccount: "/uz/hisobni-ochirish",
} as const;

/** "Davom etib, Foydalanish shartlari va Maxfiylik siyosatiga rozilik bildirasiz." — havolalar saytdagi huquqiy sahifalar. */
export function Consent() {
  const l = copy.login;
  return (
    <Txt style={styles.text}>
      {l.consentLead}
      <Txt style={styles.link} accessibilityRole="link" onPress={() => openSite(LEGAL.terms)}>
        {l.terms}
      </Txt>
      {l.and}
      <Txt style={styles.link} accessibilityRole="link" onPress={() => openSite(LEGAL.privacy)}>
        {l.privacy}
      </Txt>
      {l.consentTail}
    </Txt>
  );
}

const styles = StyleSheet.create({
  text: { marginTop: 8, marginHorizontal: 4, fontSize: 13, lineHeight: 19.5, color: colors.muted2, textAlign: "center" },
  link: { ...font(700), color: colors.ink, textDecorationLine: "underline" },
});
