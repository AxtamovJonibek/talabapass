import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { isValidPassword, passwordRules, passwordStrength, samePassword } from "@/lib/password";
import { resetTo, routeFor, useApp } from "@/state";
import { BackArrow, ErrorBox, Grow, IconTile, Label, Lead, PasswordBox, PrimaryButton, RoleChip, Screen, StepBars, StrengthBars, TickDot, TickRow, Title, TopBar, TopBarSpacer } from "@/ui/kit";

type Mode = "new" | "set" | "reset" | "required" | "change";

/**
 * Parol / ParolBiznes:
 * - `new` — yangi raqam yoki Google/Apple yangi foydalanuvchisi (keyin ro'yxat), `set` — parolsiz eski hisob (ro'yxat kodi bilan),
 *   `reset` — "Parolni unutdim" (boshqa qurilmalardagi kirishlar yopiladi) — qadam tokeni bilan;
 * - `required` — kirgan, lekin parolsiz yoki admin tiklagan hisob; `change` — profildan almashtirish (joriy parol bilan).
 */
export default function SetPassword() {
  const { mode: rawMode = "new" } = useLocalSearchParams<{ mode?: Mode }>();
  const mode: Mode = (["new", "set", "reset", "required", "change"] as const).includes(rawMode) ? rawMode : "new";
  const { flow, setFlow, signIn, me, reloadMe, signOut } = useApp();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const l = copy.login;
  const signedIn = mode === "required" || mode === "change";
  const role = signedIn ? (me?.role === "STUDENT" ? "student" : "business") : (flow.verify?.role ?? flow.intent);
  const rules = passwordRules(password);
  const score = passwordStrength(password);
  const matches = confirm.length > 0 && samePassword(password, confirm);

  const submit = async () => {
    if (busy) return;
    if (!signedIn && !flow.verify) return setError(l.stepExpired);
    if (mode === "change" && !current) return setError(copy.login.currentLabel);
    if (!isValidPassword(password)) return setError(l.weakPassword);
    if (!matches) return setError(l.mismatch);
    setBusy(true);
    setError(null);
    try {
      if (signedIn) {
        await authApi.mePassword(password, confirm, mode === "change" ? current : undefined);
        const user = await reloadMe();
        if (mode === "required") return resetTo(routeFor(user));
        setDone(true);
        setCurrent("");
        setPassword("");
        setConfirm("");
        return;
      }
      const result = await authApi.setPassword(flow.verify!.ticket, password, confirm);
      if (result.next === "register") {
        setFlow({ registrationTicket: result.registrationTicket, verify: null, reset: null });
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

  const title = mode === "reset" ? l.resetTitle : mode === "required" ? l.requiredTitle : mode === "change" ? l.changeTitle : l.setTitle;
  const lead =
    mode === "reset" ? l.resetLead : mode === "required" ? l.requiredLead : mode === "change" ? l.changeLead : flow.social && mode === "new" ? l.socialSetLead : l.setLead;

  return (
    <Screen>
      <TopBar>
        {mode === "required" ? <TopBarSpacer /> : <BackArrow label={copy.back} onPress={() => router.back()} />}
        {signedIn ? null : <StepBars total={3} current={3} label={l.setSteps} />}
        <RoleChip tone={role === "student" ? "student" : "business"}>{copy.role[role]}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <IconTile icon="lock" />
        <Title text={title} size={42} style={styles.title} />
        <Lead text={done ? l.changed : lead} size={16} style={styles.lead} />
      </View>

      {mode === "change" ? (
        <View style={styles.block}>
          <Label>{l.currentLabel}</Label>
          <PasswordBox
            value={current}
            onChange={(v) => {
              setCurrent(v);
              setError(null);
              setDone(false);
            }}
            autoFocus
            returnKeyType="next"
            toggle={{ show: l.showPassword, hide: l.hidePassword }}
            label={l.currentLabel}
          />
        </View>
      ) : null}

      <View style={styles.block}>
        <Label>{l.passwordLabel}</Label>
        <PasswordBox
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
            setDone(false);
          }}
          autoFocus={mode !== "change"}
          newPassword
          returnKeyType="next"
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
      {mode === "required" ? (
        <PrimaryButton tone="orange" icon={null} onPress={() => void signOut()} style={styles.secondary}>
          {copy.profile.logout}
        </PrimaryButton>
      ) : null}
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
  secondary: { marginTop: 10 },
});
