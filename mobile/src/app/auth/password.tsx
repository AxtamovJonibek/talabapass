import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { isValidPassword, passwordRules, passwordStrength, samePassword } from "@/lib/password";
import { resetTo, routeFor, useApp } from "@/state";
import { BackArrow, ErrorBox, Grow, IconTile, Label, Lead, PasswordBox, PrimaryButton, RoleChip, Screen, StepBars, StrengthBars, TickDot, TickRow, Title, TopBar } from "@/ui/kit";

/**
 * Parol / ParolBiznes: `new` — yangi raqam (keyin ro'yxat), `set` — parolsiz eski hisob, `reset` — "Parolni unutdim"
 * (Kirish ekranidagi SMS tasdig'i bilan; boshqa qurilmalardagi kirishlar yopiladi).
 */
export default function SetPassword() {
  const { mode = "new" } = useLocalSearchParams<{ mode?: "new" | "set" | "reset" }>();
  const { flow, setFlow, signIn } = useApp();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = copy.login;
  const role = flow.verify?.role ?? flow.intent;
  const rules = passwordRules(password);
  const score = passwordStrength(password);
  const matches = confirm.length > 0 && samePassword(password, confirm);

  const submit = async () => {
    if (busy) return;
    if (!flow.verify) return setError(l.stepExpired);
    if (!isValidPassword(password)) return setError(l.weakPassword);
    if (!matches) return setError(l.mismatch);
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.setPassword(flow.verify.ticket, password, confirm);
      if (result.next === "register") {
        setFlow({ registrationTicket: result.registrationTicket });
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
        <StepBars total={3} current={3} label={l.setSteps} />
        <RoleChip tone={role === "student" ? "student" : "business"}>{copy.role[role]}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <IconTile icon="lock" />
        <Title text={mode === "reset" ? l.resetTitle : l.setTitle} size={42} style={styles.title} />
        <Lead text={mode === "reset" ? l.resetLead : l.setLead} size={16} style={styles.lead} />
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
          toggle={{ show: l.showPassword, hide: l.hidePassword }}
          label={l.passwordLabel}
        />
        <StrengthBars score={score} label={l.strength[score]} />
        <View style={styles.rules}>
          <TickRow ok={rules.length}>{l.ruleLength}</TickRow>
          <TickRow ok={rules.mix}>{l.ruleMix}</TickRow>
        </View>
      </View>

      <View style={styles.repeat}>
        <Label>{l.repeatLabel}</Label>
        <PasswordBox
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setError(null);
          }}
          newPassword
          invalid={confirm.length >= password.length && confirm.length > 0 && !matches}
          trailing={matches ? <TickDot size={26} /> : null}
          onSubmit={() => void submit()}
          label={l.repeatLabel}
        />
        <ErrorBox>{error}</ErrorBox>
      </View>

      <Grow />

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {busy ? l.saving : mode === "new" ? copy.next : l.save}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 32 },
  title: { marginTop: 20 },
  lead: { marginTop: 12 },
  block: { marginTop: 24 },
  rules: { gap: 8, marginTop: 14 },
  repeat: { marginTop: 20 },
  cta: { marginTop: 24 },
});
