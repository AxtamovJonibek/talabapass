import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { BackArrow, ErrorBox, FooterLink, Grow, Label, Logo, PasswordBox, PrimaryButton, Screen, TextAction, Title, TopBar, Txt } from "@/ui/kit";

/** Kirish (12): hisob topildi — parol. "Parolni unutdim" — shu SMS tasdig'i bilan yangi parol. */
export default function Login() {
  const { flow, signIn } = useApp();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = copy.login;
  const verify = flow.verify?.next === "password" ? flow.verify : null;

  const submit = async () => {
    if (!verify || busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const me = await signIn(await authApi.login(verify.ticket, password));
      resetTo(routeFor(me));
    } catch (e) {
      const left = e instanceof ApiError && e.code === "wrong_password" ? e.details.left : undefined;
      setError(typeof left === "number" ? l.wrongPassword(left) : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={() => router.back()} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <View style={styles.account}>
          <View style={styles.avatar}>
            {verify?.initial ? <Txt style={[font(900), { fontSize: 24 }]}>{verify.initial}</Txt> : <Icon name="user" size={28} strokeWidth={2.4} />}
          </View>
          <View style={styles.accountText}>
            <Txt style={[font(600), { fontSize: 14, color: colors.muted }]}>{l.found}</Txt>
            <Txt style={[font(800), { fontSize: 20 }]}>{verify?.masked ?? ""}</Txt>
          </View>
        </View>
        <Title text={l.passwordTitle} size={42} style={styles.title} />
      </View>

      <View style={styles.field}>
        <Label>{l.passwordLabel}</Label>
        <PasswordBox
          height={64}
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          invalid={Boolean(error)}
          autoFocus
          toggle={{ show: l.showPassword, hide: l.hidePassword }}
          onSubmit={() => void submit()}
          label={l.passwordLabel}
        />
        <View style={styles.forgot}>
          <TextAction underline weight={800} onPress={() => router.push("/auth/password?mode=reset")}>
            {l.forgot}
          </TextAction>
        </View>
        <ErrorBox>{verify ? error : l.stepExpired}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} disabled={!verify || !password} style={styles.cta}>
        {busy ? l.signingIn : l.signIn}
      </PrimaryButton>

      <Grow />

      <FooterLink lead={l.otherNumber} onPress={() => resetTo("/auth/phone?intent=student")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  account: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  accountText: { gap: 2 },
  title: { marginTop: 24 },
  field: { marginTop: 28 },
  forgot: { marginTop: 6 },
  cta: { marginTop: 12 },
});
