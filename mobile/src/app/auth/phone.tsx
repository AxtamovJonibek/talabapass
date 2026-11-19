import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSendCode } from "@/auth/use-send-code";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { Consent } from "@/ui/legal";
import { BackArrow, ErrorBox, Grow, Label, Logo, PhoneBox, PrimaryButton, Screen, Title, TopBar, Txt } from "@/ui/kit";

/** AuthTelefon (talaba) / AuthBiznes: telefon raqam → SMS kod. Ro'yxat ham, kirish ham shu yerdan; usul tanlovi — `/auth`. */
export default function Phone() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const [digits, setDigits] = useState("");
  const { send, busy, error } = useSendCode();
  const l = copy.login;

  const submit = async () => {
    if (await send(digits, intent)) router.push("/auth/code");
  };

  // Tarix bo'lmasa — kirish usuli tanloviga
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/auth?intent=${intent}`);
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
      </View>

      <View style={styles.field}>
        <Label>{l.phoneLabel}</Label>
        <PhoneBox value={digits} onChange={setDigits} invalid={Boolean(error)} onSubmit={() => void submit()} />
        <ErrorBox>{error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {copy.next}
      </PrimaryButton>

      <Grow />

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
