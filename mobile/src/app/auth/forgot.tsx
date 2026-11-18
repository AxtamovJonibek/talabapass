import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { useApp } from "@/state";
import { BackArrow, ErrorBox, Field, FooterLink, Grow, IconTile, Label, Lead, Logo, PrimaryButton, Screen, Title, TopBar } from "@/ui/kit";

/**
 * "Parolni unutdim": raqam yoki email → SMS yoki email kodi → yangi parol (boshqa qurilmalar chiqariladi).
 * Javob hisob borligidan qat'i nazar bir xil — kod ekraniga doim o'tiladi.
 */
export default function Forgot() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const { setFlow } = useApp();
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = copy.login;

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim()) return setError(l.identifierInvalid);
    setBusy(true);
    setError(null);
    try {
      const r = await authApi.forgot(identifier.trim());
      setFlow({ intent, verify: null, reset: { identifier: identifier.trim(), channel: r.channel }, resendAt: Date.now() + r.resendInSeconds * 1000 });
      router.push("/auth/code");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/auth/login?intent=${intent}`))} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <IconTile icon="lock" />
        <Title text={l.forgotTitle} size={42} style={styles.title} />
        <Lead text={l.forgotLead} style={styles.lead} />
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
          keyboardType="email-address"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          accessibilityLabel={l.identifierLabel}
        />
        <ErrorBox>{error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {busy ? l.sending : l.sendResetCode}
      </PrimaryButton>

      <Grow />

      <FooterLink lead={l.rememberPassword} action={l.signInAction} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/auth/login?intent=${intent}`))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  title: { marginTop: 22 },
  lead: { marginTop: 14 },
  field: { marginTop: 30 },
  cta: { marginTop: 20 },
});
