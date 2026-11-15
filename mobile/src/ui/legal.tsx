import { Linking, StyleSheet } from "react-native";
import { API_URL } from "@/api/client";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { Txt } from "./kit";

export const openSite = (path: string) => void Linking.openURL(`${API_URL}${path}`);

/** "Davom etib, Foydalanish shartlari va Maxfiylik siyosatiga rozilik bildirasiz." — havolalar saytdagi huquqiy sahifalar. */
export function Consent() {
  const l = copy.login;
  return (
    <Txt style={styles.text}>
      {l.consentLead}
      <Txt style={styles.link} accessibilityRole="link" onPress={() => openSite("/huquqiy/shartlar")}>
        {l.terms}
      </Txt>
      {l.and}
      <Txt style={styles.link} accessibilityRole="link" onPress={() => openSite("/huquqiy/maxfiylik")}>
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
