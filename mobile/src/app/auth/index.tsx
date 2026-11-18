import * as AppleAuthentication from "expo-apple-authentication";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, StyleSheet, View } from "react-native";
import { useSocialSignIn } from "@/auth/use-social";
import { copy } from "@/copy";
import { cachedAppConfig, loadAppConfig, type AppConfig } from "@/lib/app-version";
import { wasOnboarded } from "@/storage";
import { colors, font } from "@/theme";
import { BRAND_LOGOS } from "@/ui/brands";
import { GoogleG, Icon } from "@/ui/icons";
import { Consent } from "@/ui/legal";
import { BackArrow, ErrorBox, FooterLink, Lead, Logo, Press, Screen, Title, TopBar, Txt } from "@/ui/kit";

type Methods = NonNullable<AppConfig["auth"]>;
/** Server javobi kelguncha (yoki eski server) — hammasi ko'rinadi */
const ALL: Methods = { phone: true, google: true, apple: true };

/**
 * Auth (design/app-flow/Auth.dc.html): Google, Apple, "yoki", telefon raqam yoki email → Kirish (parol); "Ro'yxatdan o'tish" — telefon → SMS kod → parol. Apple tugmasi DOIM ko'rinadi:
 * iOS — rasmiy `AppleAuthenticationButton`, Android — Apple'ning rasmiy belgisi bilan qora tugma (web oqimi). Serverda
 * sozlanmagan bo'lsa bosilganda "Apple orqali kirib bo'lmadi…" chiqadi. Google va telefon — `GET /app-config` `auth` bo'yicha.
 */
export default function Auth() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const { run, busy, error } = useSocialSignIn(intent);
  const [methods, setMethods] = useState<Methods>(ALL);
  const a = copy.auth;

  useEffect(() => {
    void cachedAppConfig().then((c) => c?.auth && setMethods(c.auth));
    void loadAppConfig().then((c) => c?.auth && setMethods(c.auth));
  }, []);

  const switchRole = async () => {
    if (intent === "student" && !(await wasOnboarded("business"))) router.push("/biz-intro");
    else router.push(`/auth?intent=${intent === "student" ? "business" : "student"}`);
  };

  // Tarix bo'lmasa (karuseldan keyin): talaba — karuselga, biznes — talaba kirishiga
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(intent === "business" ? "/auth?intent=student" : "/intro");
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={back} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <View style={styles.badge}>
          <Txt style={[font(900, 62), styles.badgeText]}>{copy.login.badge}</Txt>
        </View>
        <Title text={a.title} size={46} />
        <Lead text={intent === "business" ? a.businessLead : a.lead} style={styles.lead} />
      </View>

      <View style={styles.grow} />

      <View style={styles.buttons}>
        {methods.google ? (
          <Press
            onPress={() => void run("GOOGLE")}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityState={{ busy: busy === "GOOGLE" }}
            style={[styles.method, styles.google]}
          >
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
            onPress={() => void run("APPLE")}
          />
        ) : (
          <Press
            onPress={() => void run("APPLE")}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityState={{ busy: busy === "APPLE" }}
            style={[styles.method, styles.appleCustom]}
          >
            <Image source={BRAND_LOGOS.appleButton} style={styles.appleLogo} accessibilityIgnoresInvertColors />
            <Txt style={[font(800), styles.methodText, { color: colors.white }]}>{a.apple}</Txt>
            {busy === "APPLE" ? <ActivityIndicator color={colors.white} /> : <Icon name="chevronRight" size={20} strokeWidth={2.4} color={colors.white} />}
          </Press>
        )}

        {methods.phone ? (
          <View style={styles.divider}>
            <View style={styles.dash} />
            <Txt style={[font(600), styles.or]}>{a.or}</Txt>
            <View style={styles.dash} />
          </View>
        ) : null}

        {methods.phone ? (
          <Press onPress={() => router.push(`/auth/login?intent=${intent}`)} disabled={busy !== null} accessibilityRole="button" style={[styles.method, styles.phone]}>
            <Icon name="mobile" size={26} strokeWidth={2} color={colors.blue} />
            <Txt style={[font(800), styles.methodText]}>{a.phone}</Txt>
            <Icon name="chevronRight" size={20} strokeWidth={2.4} />
          </Press>
        ) : null}

        <ErrorBox>{error}</ErrorBox>
      </View>

      {methods.phone ? (
        <FooterLink lead={copy.login.noAccount} action={copy.login.registerAction} onPress={() => router.push(`/auth/phone?intent=${intent}`)} style={styles.footer} />
      ) : null}
      <FooterLink lead={intent === "business" ? copy.login.studentQuestion : copy.login.businessQuestion} action={copy.login.here} onPress={() => void switchRole()} style={methods.phone ? styles.second : styles.footer} />
      <Consent />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  badge: {
    position: "absolute",
    right: 0,
    top: -6,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }],
  },
  badgeText: { fontSize: 40, lineHeight: 40 },
  lead: { marginTop: 16, maxWidth: 300 },
  grow: { flex: 1, minHeight: 24 },
  buttons: { gap: 10 },
  method: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: 20, backgroundColor: colors.white, gap: 14 },
  google: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 18 },
  phone: { paddingHorizontal: 20 },
  mark: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  methodText: { flex: 1, fontSize: 17 },
  apple: { height: 58, width: "100%" },
  appleCustom: { backgroundColor: colors.ink, paddingLeft: 8, paddingRight: 18, gap: 8 },
  /** Apple'ning rasmiy logo-tugmasi (qora kvadrat, oq belgi) — qora tugma ichida */
  appleLogo: { width: 42, height: 42 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dash: { flex: 1, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.line },
  or: { fontSize: 13, color: colors.muted2 },
  footer: { marginTop: 18 },
  second: { marginTop: 8 },
});
