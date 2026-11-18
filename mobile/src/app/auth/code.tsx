import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { authApi } from "@/api/endpoints";
import { useSendCode } from "@/auth/use-send-code";
import { copy } from "@/copy";
import { displayPhone, toE164 } from "@/lib/phone";
import { useApp } from "@/state";
import { colors, font } from "@/theme";
import { BackArrow, CodeBoxes, ErrorBox, Grow, IconTile, Lead, Logo, Note, PrimaryButton, Screen, TextAction, Title, TipCard, TopBar, Txt } from "@/ui/kit";

/**
 * Kod / KodBiznes: 6 xonali kod. Ro'yxat — SMS kod (raqamni tasdiqlash) → parol; "Parolni unutdim" (`flow.reset`) —
 * SMS yoki email kodi → yangi parol. 6-raqam kiritilishi bilan o'zi tekshiradi.
 */
export default function Code() {
  const { flow, setFlow } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const resend = useSendCode();
  const [resendError, setResendError] = useState<string | null>(null);
  const l = copy.login;
  const reset = flow.reset;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((flow.resendAt - now) / 1000));

  const verify = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (reset) {
        const result = await authApi.forgotVerify(reset.identifier, value);
        setFlow({ verify: { next: "setPassword", ticket: result.ticket, role: flow.intent, isNew: false } });
        router.push("/auth/password?mode=reset");
      } else {
        const result = await authApi.verify(toE164(flow.phone), value, flow.intent);
        setFlow({ verify: result });
        router.push(`/auth/password?mode=${result.isNew ? "new" : "set"}`);
      }
    } catch (e) {
      setError(errorText(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const again = async () => {
    setResendError(null);
    if (!reset) return void resend.send(flow.phone, flow.intent);
    try {
      const r = await authApi.forgot(reset.identifier);
      setFlow({ resendAt: Date.now() + r.resendInSeconds * 1000 });
    } catch (e) {
      setResendError(errorText(e));
    }
  };

  const onChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
    if (value.length === 6) void verify(value);
  };

  const email = reset?.channel === "email";
  const target = reset ? reset.identifier : displayPhone(flow.phone);

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={() => router.back()} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <IconTile icon="sms" />
        <Title text={l.codeTitle} size={42} style={styles.title} />
        <Lead text={email ? l.codeLeadEmail(target) : l.codeLead(target)} style={styles.lead} />
        {reset ? <Note style={styles.note}>{l.resetSent}</Note> : null}
      </View>

      <View style={styles.code}>
        <CodeBoxes value={code} onChange={onChange} invalid={Boolean(error)} disabled={busy} autoFocus label={email ? l.emailCodeLabel : l.codeLabel} />
        <View style={styles.row}>
          {left > 0 ? (
            <Txt style={[font(500), styles.timer]}>
              {l.resendIn}{" "}
              <Txt style={[font(700), { color: colors.ink }]}>
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
              </Txt>
            </Txt>
          ) : (
            <TextAction disabled={resend.busy} onPress={() => void again()}>
              {l.resend}
            </TextAction>
          )}
          <TextAction onPress={() => router.back()}>{l.changePhone}</TextAction>
        </View>
        <ErrorBox>{error ?? resend.error ?? resendError}</ErrorBox>
      </View>

      <Grow />

      {reset ? null : (
        <View style={styles.tip}>
          <TipCard icon="shieldCheck">
            {l.tipLead}
            <Txt style={[font(800), { color: colors.blue }]}>{l.tipAction}</Txt>
            {l.tipTail}
          </TipCard>
        </View>
      )}
      <PrimaryButton icon="tick" onPress={() => void verify(code)} loading={busy} disabled={code.length !== 6}>
        {busy ? l.checking : l.confirm}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  title: { marginTop: 22 },
  lead: { marginTop: 14 },
  note: { marginTop: 10 },
  code: { marginTop: 30 },
  row: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timer: { fontSize: 15, color: colors.muted2 },
  tip: { marginBottom: 16, marginTop: 24 },
});
