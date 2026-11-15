import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSendCode } from "@/auth/use-send-code";
import { copy } from "@/copy";
import { getLastPhone } from "@/storage";
import { colors } from "@/theme";
import { Icon } from "@/ui/icons";
import { ErrorBox, FooterLink, Grow, Label, Lead, Logo, Note, PhoneBox, PrimaryButton, Screen, Title, TopBar } from "@/ui/kit";

/** Auth2 — chiqqandan keyin: oxirgi raqam tayyor, kod → parol. */
export default function Returning() {
  const [digits, setDigits] = useState("");
  const { send, busy, error } = useSendCode();
  const l = copy.login;

  useEffect(() => {
    void getLastPhone().then((last) => last && setDigits(last));
  }, []);

  const submit = async () => {
    if (await send(digits, "student")) router.push("/auth/code");
  };

  return (
    <Screen>
      <TopBar style={styles.top}>
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <View style={styles.badge}>
          <Icon name="homeIn" size={48} strokeWidth={2.4} />
        </View>
        <Title text={l.returningTitle} size={44} />
        <Lead text={l.returningLead} style={styles.lead} />
      </View>

      <View style={styles.field}>
        <Label>{l.phoneLabel}</Label>
        <PhoneBox value={digits} onChange={setDigits} invalid={Boolean(error)} onSubmit={() => void submit()} />
        <Note style={styles.note}>{l.returningNote}</Note>
        <ErrorBox>{error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {busy ? l.sending : l.sendCode}
      </PrimaryButton>

      <Grow />

      <FooterLink lead={l.otherPhone} action={l.otherPhoneAction} onPress={() => router.push("/auth/phone?intent=student")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { justifyContent: "flex-start" },
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
  cta: { marginTop: 20 },
});
