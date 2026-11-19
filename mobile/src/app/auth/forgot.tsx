import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSendCode } from "@/auth/use-send-code";
import { copy } from "@/copy";
import { BackArrow, ErrorBox, Grow, Label, Logo, PhoneBox, PrimaryButton, Screen, Title, TopBar } from "@/ui/kit";

/** "Parolni unutdim": telefon → SMS kod → yangi parol (boshqa qurilmalardagi kirishlar yopiladi). */
export default function Forgot() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const intent = params.intent === "business" ? "business" : "student";
  const [digits, setDigits] = useState("");
  const { send, busy, error } = useSendCode();
  const l = copy.login;

  const submit = async () => {
    if (await send(digits, intent)) router.push("/auth/code?mode=forgot");
  };

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/auth/signin?intent=${intent}`);
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={back} />
        <Logo />
      </TopBar>

      <View style={styles.hero}>
        <Title text={l.forgotTitle} size={46} />
      </View>

      <View style={styles.field}>
        <Label>{l.phoneLabel}</Label>
        <PhoneBox value={digits} onChange={setDigits} invalid={Boolean(error)} onSubmit={() => void submit()} autoFocus />
        <ErrorBox>{error}</ErrorBox>
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {copy.next}
      </PrimaryButton>

      <Grow />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  field: { marginTop: 32 },
  cta: { marginTop: 20 },
});
