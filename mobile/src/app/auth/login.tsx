import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { getLastPhone } from "@/storage";
import { colors } from "@/theme";
import { Icon } from "@/ui/icons";
import { BackArrow, ErrorBox, Field, FooterLink, formatLocalPhone, Grow, Label, Lead, Logo, Note, PasswordBox, PrimaryButton, Screen, TextAction, Title, TopBar } from "@/ui/kit";

/**
 * Kirish (SMSsiz): telefon raqam yoki email + parol. Xato bo'lsa — bitta umumiy matn (hisob borligi bilinmaydi).
 * `returning` — Auth2 ("Qayta xush kelibsiz"): oxirgi raqam maydonda tayyor.
 */
export function LoginScreen({ returning = false }: { returning?: boolean }) {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const { signIn } = useApp();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = copy.login;

  useEffect(() => {
    if (returning) void getLastPhone().then((last) => last && setIdentifier(formatLocalPhone(last)));
  }, [returning]);

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim()) return setError(l.identifierInvalid);
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const me = await signIn(await authApi.login(identifier, password));
      resetTo(routeFor(me));
    } catch (e) {
      // Noto'g'ri raqam/email ham, parol ham — server bitta umumiy javob beradi
      setError(e instanceof ApiError && e.code === "invalid_request" ? l.identifierInvalid : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Tarix bo'lmasa — kirish usuli tanloviga
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/auth?intent=${intent}`);
  };

  return (
    <Screen>
      <TopBar style={returning ? styles.startBar : undefined}>
        {returning ? null : <BackArrow label={copy.back} onPress={back} />}
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        {returning ? (
          <View style={styles.badge}>
            <Icon name="homeIn" size={48} strokeWidth={2.4} />
          </View>
        ) : null}
        <Title text={returning ? l.returningTitle : l.loginTitle} size={returning ? 44 : 46} />
        <Lead text={returning ? l.returningLead : l.loginLead} style={styles.lead} />
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
          autoFocus={!returning}
          returnKeyType="next"
          accessibilityLabel={l.identifierLabel}
        />
        {returning ? <Note style={styles.note}>{l.returningNote}</Note> : null}
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
          autoFocus={returning}
          toggle={{ show: l.showPassword, hide: l.hidePassword }}
          onSubmit={() => void submit()}
          label={l.passwordLabel}
        />
        <View style={styles.forgot}>
          <TextAction underline weight={800} onPress={() => router.push(`/auth/forgot?intent=${intent}`)}>
            {l.forgot}
          </TextAction>
        </View>
        <ErrorBox>{error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} disabled={!password} style={styles.cta}>
        {busy ? l.signingIn : l.signIn}
      </PrimaryButton>

      <Grow />

      <FooterLink lead={l.noAccount} action={l.registerAction} onPress={() => router.push(`/auth/phone?intent=${intent}`)} />
      {returning ? <FooterLink lead={l.otherPhone} action={l.otherPhoneAction} onPress={() => router.push("/auth?intent=student")} style={styles.second} /> : null}
    </Screen>
  );
}

export default function Login() {
  return <LoginScreen />;
}

const styles = StyleSheet.create({
  startBar: { justifyContent: "flex-start" },
  hero: { marginTop: 36 },
  badge: {
    position: "absolute",
    right: 0,
    top: -6,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }],
  },
  lead: { marginTop: 16, maxWidth: 300 },
  field: { marginTop: 32 },
  note: { marginTop: 10 },
  password: { marginTop: 18 },
  forgot: { marginTop: 6 },
  cta: { marginTop: 12 },
  second: { marginTop: 10 },
});
