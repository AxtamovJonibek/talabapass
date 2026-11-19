import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { useSocialSignIn } from "@/auth/use-social";
import { copy } from "@/copy";
import { cachedAppConfig, loadAppConfig, type AppConfig } from "@/lib/app-version";
import { resetTo, routeFor, useApp } from "@/state";
import { getLastPhone } from "@/storage";
import { colors, font } from "@/theme";
import { SocialButtons } from "@/ui/social-buttons";
import { BackArrow, ErrorBox, Field, FooterLink, formatLocalPhone, Label, Logo, PasswordBox, PrimaryButton, Screen, TextAction, Title, TopBar, Txt } from "@/ui/kit";

type Methods = NonNullable<AppConfig["auth"]>;

/** Telefon (9 raqam) bo'lsa +998…, aks holda email — serverga shunday ketadi */
const identifierOf = (raw: string) => {
  const v = raw.trim();
  if (v.includes("@")) return v;
  const digits = v.replace(/\D/g, "").replace(/^998(?=\d{9}$)/, "");
  return digits.length === 9 ? `+998${digits}` : v;
};

/** Kirish (SMSsiz): telefon yoki email + parol; yoki Google/Apple tanlanadi, so'ng o'sha akkauntning paroli. */
export default function SignIn() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const { signIn } = useApp();
  const social = useSocialSignIn(intent);
  const [methods, setMethods] = useState<Methods>({ phone: true, google: true, apple: true });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = copy.login;

  useEffect(() => {
    void getLastPhone().then((last) => last && setIdentifier((v) => v || formatLocalPhone(last)));
    void cachedAppConfig().then((c) => c?.auth && setMethods(c.auth));
    void loadAppConfig().then((c) => c?.auth && setMethods(c.auth));
  }, []);

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim() || !password) return setError(l.wrongPasswordShort);
    setBusy(true);
    setError(null);
    try {
      resetTo(routeFor(await signIn(await authApi.signIn(identifierOf(identifier), password))));
    } catch (e) {
      setError(e instanceof ApiError && e.code === "invalid_request" ? l.wrongPasswordShort : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Tarix bo'lmasa (chiqib ketgandan keyin) — ro'yxat usullariga
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/auth?intent=${intent}`);
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={back} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <Title text={l.signInAction} size={46} />
      </View>

      <View style={styles.field}>
        <Label>{l.identifierLabel}</Label>
        <Field
          height={64}
          text={18}
          value={identifier}
          onChangeText={(v) => {
            setIdentifier(v);
            setError(null);
          }}
          invalid={Boolean(error)}
          placeholder={l.identifierPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          accessibilityLabel={l.identifierLabel}
        />
      </View>

      <View style={styles.password}>
        <Label>{l.passwordLabel}</Label>
        <PasswordBox
          height={64}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          invalid={Boolean(error)}
          toggle={{ show: l.showPassword, hide: l.hidePassword }}
          onSubmit={() => void submit()}
          label={l.passwordLabel}
        />
        <View style={styles.forgot}>
          <TextAction underline weight={800} onPress={() => router.push(`/auth/forgot?intent=${intent}`)}>
            {l.forgot}
          </TextAction>
        </View>
        <ErrorBox>{error ?? social.error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} disabled={!password} style={styles.cta}>
        {l.signInAction}
      </PrimaryButton>

      {methods.google || methods.apple ? (
        <>
          <View style={styles.divider}>
            <View style={styles.dash} />
            <Txt style={[font(600), styles.or]}>{copy.auth.or}</Txt>
            <View style={styles.dash} />
          </View>
          <SocialButtons methods={methods} busy={social.busy} onPick={(p) => void social.run(p)} />
        </>
      ) : null}

      <View style={styles.grow} />
      <FooterLink lead={l.noAccount} action={l.registerAction} onPress={() => router.push(`/auth?intent=${intent}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  field: { marginTop: 28 },
  password: { marginTop: 18 },
  forgot: { marginTop: 6 },
  cta: { marginTop: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14 },
  dash: { flex: 1, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.line },
  or: { fontSize: 13, color: colors.muted2 },
  grow: { flex: 1, minHeight: 20 },
});
