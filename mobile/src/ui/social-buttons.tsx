import * as AppleAuthentication from "expo-apple-authentication";
import { ActivityIndicator, Image, Platform, StyleSheet, View } from "react-native";
import type { SocialProvider } from "@/api/endpoints";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { BRAND_LOGOS } from "@/ui/brands";
import { GoogleG, Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

/**
 * Google va Apple tugmalari (ro'yxat ham, kirish ham shu): iOS — rasmiy `AppleAuthenticationButton`, Android — Apple'ning
 * rasmiy belgisi bilan qora tugma (web oqimi).
 */
export function SocialButtons({ methods, busy, onPick }: { methods: { google: boolean; apple: boolean }; busy: SocialProvider | null; onPick: (p: SocialProvider) => void }) {
  const a = copy.auth;
  return (
    <View style={styles.buttons}>
      {methods.google ? (
        <Press onPress={() => onPick("GOOGLE")} disabled={busy !== null} accessibilityRole="button" accessibilityState={{ busy: busy === "GOOGLE" }} style={[styles.method, styles.google]}>
          <View style={styles.mark}>
            <GoogleG size={22} />
          </View>
          <Txt style={[font(800), styles.methodText]}>{a.google}</Txt>
          {busy === "GOOGLE" ? <ActivityIndicator color={colors.ink} /> : <Icon name="chevronRight" size={20} strokeWidth={2.4} />}
        </Press>
      ) : null}

      {Platform.OS === "ios" ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={20}
          style={styles.apple}
          onPress={() => onPick("APPLE")}
        />
      ) : (
        <Press onPress={() => onPick("APPLE")} disabled={busy !== null} accessibilityRole="button" accessibilityState={{ busy: busy === "APPLE" }} style={[styles.method, styles.appleCustom]}>
          <Image source={BRAND_LOGOS.appleButton} style={styles.appleLogo} accessibilityIgnoresInvertColors />
          <Txt style={[font(800), styles.methodText, { color: colors.white }]}>{a.apple}</Txt>
          {busy === "APPLE" ? <ActivityIndicator color={colors.white} /> : <Icon name="chevronRight" size={20} strokeWidth={2.4} color={colors.white} />}
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: 10 },
  method: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: 20, backgroundColor: colors.white, gap: 14 },
  google: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 18 },
  mark: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  methodText: { flex: 1, fontSize: 17 },
  apple: { height: 58, width: "100%" },
  appleCustom: { backgroundColor: colors.ink, paddingLeft: 8, paddingRight: 18, gap: 8 },
  /** Apple'ning rasmiy logo-tugmasi (qora kvadrat, oq belgi) — qora tugma ichida */
  appleLogo: { width: 42, height: 42 },
});
