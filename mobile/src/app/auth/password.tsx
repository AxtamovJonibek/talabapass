import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { isValidPassword, passwordChecks } from "@/lib/password";
import { resetTo, routeFor, useApp } from "@/state";
import { BackArrow, ErrorBox, Grow, Label, Logo, PasswordBox, PasswordRule, PrimaryButton, Screen, Title, TopBar } from "@/ui/kit";

type Mode = "new" | "set" | "reset" | "social";

/**
 * Parol, ma'lumotlardan OLDIN:
 * - `new` — yangi telefon raqam (SMS tasdig'idan keyin), `social` — Google/Apple yangi foydalanuvchisi (o'tkazib yuborib bo'lmaydi);
 *   ikkalasidan keyin ma'lumotlar (ism, familiya, universitet, kurs);
 * - `set` — parolsiz eski hisob, `reset` — "Parolni unutdim" (boshqa qurilmalardagi kirishlar yopiladi): parol saqlanib, kiriladi.
 * Qoidalar yozilmaguncha kulrang, bajarilganda yashil; qizil — faqat "Davom etish" bosilgandan keyin.
 */
export default function SetPassword() {
  const { mode: rawMode = "new" } = useLocalSearchParams<{ mode?: Mode }>();
  const mode: Mode = (["new", "set", "reset", "social"] as const).includes(rawMode) ? rawMode : "new";
  const { flow, setFlow, signIn } = useApp();
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = copy.login;
  const checks = passwordChecks(password);
  const stateOf = (ok: boolean) => (ok ? "ok" : tried ? "bad" : "idle");
  const registering = mode === "new" || mode === "social";

  const submit = async () => {
    if (busy) return;
    const ticket = mode === "social" ? flow.registrationTicket : flow.verify?.ticket;
    if (!ticket) return setError(l.stepExpired);
    setTried(true);
    if (!isValidPassword(password)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.setPassword(ticket, password, password);
      if (result.next === "register") {
        setFlow({ registrationTicket: result.registrationTicket, verify: null });
        resetTo(result.role === "cashier" ? "/cashier/register" : result.role === "business" ? "/business/info" : "/student/register");
      } else {
        resetTo(routeFor(await signIn(result)));
      }
    } catch (e) {
      setError(errorText(e));
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
        <Title text={mode === "reset" ? l.resetTitle : l.setTitle} size={46} />
      </View>

      <View style={styles.block}>
        <Label>{l.passwordLabel}</Label>
        <PasswordBox
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          autoFocus
          newPassword
          invalid={tried && !isValidPassword(password)}
          toggle={{ show: l.showPassword, hide: l.hidePassword }}
          onSubmit={() => void submit()}
          label={l.passwordLabel}
        />
        <View style={styles.rules}>
          <PasswordRule state={stateOf(checks.length)}>{l.ruleLength}</PasswordRule>
          <PasswordRule state={stateOf(checks.digit)}>{l.ruleDigit}</PasswordRule>
          <PasswordRule state={stateOf(checks.letter)}>{l.ruleLetter}</PasswordRule>
        </View>
        <ErrorBox>{error}</ErrorBox>
      </View>

      <Grow />

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {registering ? copy.next : l.save}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  block: { marginTop: 28 },
  rules: { gap: 8, marginTop: 14 },
  cta: { marginTop: 24 },
});
