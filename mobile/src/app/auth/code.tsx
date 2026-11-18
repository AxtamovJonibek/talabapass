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
import { BackArrow, CodeBoxes, ErrorBox, Grow, IconTile, Lead, Logo, PrimaryButton, Screen, TextAction, Title, TipCard, TopBar, Txt } from "@/ui/kit";

/** Kod / KodBiznes: 6 xonali SMS kod. 6-raqam kiritilishi bilan o'zi tekshiradi. */
export default function Code() {
  const { flow, setFlow } = useApp();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const resend = useSendCode();
  const l = copy.login;

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
      const result = await authApi.verify(toE164(flow.phone), value, flow.intent);
      setFlow({ verify: result });
      if (result.next === "password") router.push("/auth/login");
      else router.push(`/auth/password?mode=${result.isNew ? "new" : "set"}`);
    } catch (e) {
      setError(errorText(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const onChange = (value: string) => {
    setCode(value);
    if (error) setError(null);
    if (value.length === 6) void verify(value);
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={() => router.back()} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <IconTile icon="message" />
        <Title text={l.codeTitle} size={42} style={styles.title} />
        <Lead text={l.codeLead(displayPhone(flow.phone))} style={styles.lead} />
      </View>

      <View style={styles.code}>
        <CodeBoxes value={code} onChange={onChange} invalid={Boolean(error)} disabled={busy} autoFocus label={l.codeLabel} />
        <View style={styles.row}>
          {left > 0 ? (
            <Txt style={[font(500), styles.timer]}>
              {l.resendIn}{" "}
              <Txt style={[font(700), { color: colors.ink }]}>
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
              </Txt>
            </Txt>
          ) : (
            <TextAction disabled={resend.busy} onPress={() => void resend.send(flow.phone, flow.intent)}>
              {l.resend}
            </TextAction>
          )}
          <TextAction onPress={() => router.back()}>{l.changePhone}</TextAction>
        </View>
        <ErrorBox>{error ?? resend.error}</ErrorBox>
      </View>

      <Grow />

      <View style={styles.tip}>
        <TipCard icon="shieldCheck">
          {l.tipLead}
          <Txt style={[font(800), { color: colors.blue }]}>{l.tipAction}</Txt>
          {l.tipTail}
        </TipCard>
      </View>
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
  code: { marginTop: 30 },
  row: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  timer: { fontSize: 15, color: colors.muted2 },
  tip: { marginBottom: 16, marginTop: 24 },
});
