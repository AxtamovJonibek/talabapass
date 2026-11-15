import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSendCode } from "@/auth/use-send-code";
import { copy } from "@/copy";
import { wasOnboarded } from "@/storage";
import { colors, font } from "@/theme";
import { Consent } from "@/ui/legal";
import { BackArrow, ErrorBox, FooterLink, Grow, Label, Lead, Logo, PhoneBox, PrimaryButton, Screen, Title, TopBar, Txt } from "@/ui/kit";

/** Auth (talaba) / AuthBiznes: telefon raqam → SMS kod. Ro'yxat ham, kirish ham shu yerdan. */
export default function Phone() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const [digits, setDigits] = useState("");
  const { send, busy, error } = useSendCode();
  const l = copy.login;

  const submit = async () => {
    if (await send(digits, intent)) router.push("/auth/code");
  };

  const switchRole = async () => {
    if (intent === "student" && !(await wasOnboarded("business"))) router.push("/biz-intro");
    else router.push(`/auth/phone?intent=${intent === "student" ? "business" : "student"}`);
  };

  // Tarix bo'lmasa (karuseldan keyin): talaba — karuselga, biznes — talaba kirishiga
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(intent === "business" ? "/auth/phone?intent=student" : "/intro");
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={back} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <View style={styles.badge}>
          <Txt style={[font(900, 62), styles.badgeText]}>{l.badge}</Txt>
        </View>
        <Title text={l.title} size={46} />
        <Lead text={intent === "business" ? l.businessLead : l.lead} style={styles.lead} />
      </View>

      <View style={styles.field}>
        <Label>{l.phoneLabel}</Label>
        <PhoneBox value={digits} onChange={setDigits} invalid={Boolean(error)} onSubmit={() => void submit()} />
        <ErrorBox>{error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {busy ? l.sending : l.sendCode}
      </PrimaryButton>

      <Grow />

      <FooterLink lead={intent === "business" ? l.studentQuestion : l.businessQuestion} action={l.here} onPress={() => void switchRole()} />
      <Consent />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  badge: {
    position: "absolute",
    right: 0,
    top: -6,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }],
  },
  badgeText: { fontSize: 40, lineHeight: 40 },
  lead: { marginTop: 16, maxWidth: 300 },
  field: { marginTop: 32 },
  cta: { marginTop: 20 },
});
