import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSocialSignIn } from "@/auth/use-social";
import { copy } from "@/copy";
import { cachedAppConfig, loadAppConfig, type AppConfig } from "@/lib/app-version";
import { wasOnboarded } from "@/storage";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Consent } from "@/ui/legal";
import { SocialButtons } from "@/ui/social-buttons";
import { BackArrow, ErrorBox, FooterLink, Logo, Press, Screen, Title, TopBar, Txt } from "@/ui/kit";

type Methods = NonNullable<AppConfig["auth"]>;
/** Server javobi kelguncha (yoki eski server) — hammasi ko'rinadi */
const ALL: Methods = { phone: true, google: true, apple: true };

/**
 * Ro'yxat: usul tanlash — Google, Apple, telefon. Google/Apple akkaunt tanlanadi, keyin parol, keyin ma'lumotlar.
 * Hisobi borlar pastdagi "Kirish" havolasidan (`/auth/signin`).
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

  // Tarix bo'lmasa (karuseldan keyin): talaba — karuselga, biznes — talaba ro'yxatiga
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
        <Title text={a.registerTitle} size={46} />
      </View>

      <View style={styles.grow} />

      <View style={styles.buttons}>
        <SocialButtons methods={methods} busy={busy} onPick={(p) => void run(p)} />

        {methods.phone ? (
          <View style={styles.divider}>
            <View style={styles.dash} />
            <Txt style={[font(600), styles.or]}>{a.or}</Txt>
            <View style={styles.dash} />
          </View>
        ) : null}

        {methods.phone ? (
          <Press onPress={() => router.push(`/auth/phone?intent=${intent}`)} disabled={busy !== null} accessibilityRole="button" style={[styles.method, styles.phone]}>
            <Icon name="mobile" size={26} strokeWidth={2} color={colors.blue} />
            <Txt style={[font(800), styles.methodText]}>{a.phone}</Txt>
            <Icon name="chevronRight" size={20} strokeWidth={2.4} />
          </Press>
        ) : null}

        <ErrorBox>{error}</ErrorBox>
      </View>

      <FooterLink lead={copy.login.haveAccount} action={copy.login.signInAction} onPress={() => router.push(`/auth/signin?intent=${intent}`)} style={styles.footer} />
      <FooterLink lead={intent === "business" ? copy.login.studentQuestion : copy.login.businessQuestion} action={copy.login.here} onPress={() => void switchRole()} style={styles.footer} />
      <Consent />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  grow: { flex: 1, minHeight: 24 },
  buttons: { gap: 10 },
  method: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: 20, backgroundColor: colors.white, gap: 14 },
  phone: { paddingHorizontal: 20 },
  methodText: { flex: 1, fontSize: 17 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dash: { flex: 1, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.line },
  or: { fontSize: 13, color: colors.muted2 },
  footer: { marginTop: 14 },
});
