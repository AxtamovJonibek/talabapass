import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { authApi, type SocialProvider } from "@/api/endpoints";
import { providerToken, socialErrorText } from "@/auth/use-social";
import { copy } from "@/copy";
import { resetTo, useApp } from "@/state";
import { colors } from "@/theme";
import { SecondaryButton } from "@/ui/app";
import { BackArrow, ErrorBox, Grow, Label, Lead, Note, PasswordBox, Screen, TextAction, Title, TopBar } from "@/ui/kit";
import { LEGAL, openSite } from "@/ui/legal";

/**
 * Hisobni o'chirish (App Store / Google Play talabi): parol bilan tasdiq → `DELETE /me`; parolsiz (Google/Apple bilan
 * ochilgan) hisob — o'sha provayder oynasidan yangi token bilan (server shu hisobning identifikatori ekanini tekshiradi).
 * Server shaxsiy ma'lumotni tozalaydi, sessiyalarni yopadi; qurilmada tokenlar, kupon nusxalari va oxirgi raqam o'chiriladi.
 * Xatolar: noto'g'ri parol (qolgan urinish), qulf (5 xato → 15 daq), hal bo'lmagan buyurtma.
 */
export default function DeleteAccount() {
  const t = copy.deleteAccount;
  const { me, forget } = useApp();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const social = me !== null && !me.hasPassword;

  const remove = async (provider?: SocialProvider) => {
    setBusy(true);
    setError(null);
    try {
      if (provider) {
        const token = await providerToken(provider);
        if (!token) return;
        await authApi.deleteMe({ provider, idToken: token.idToken, ticket: token.ticket, verifier: token.verifier });
      } else {
        await authApi.deleteMe({ password });
      }
      await forget();
      Alert.alert(t.done);
      resetTo("/auth");
    } catch (e) {
      if (e instanceof ApiError && e.code === "wrong_password") setError(copy.login.wrongPassword(Number(e.details.left ?? 0)));
      else if (e instanceof ApiError && e.code === "password_locked") setError(t.locked(Math.ceil(Number(e.details.retryInSeconds ?? 900) / 60)));
      else if (e instanceof ApiError && e.code === "open_orders") setError(t.openOrders);
      else setError(provider ? socialErrorText(e, provider) : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = (provider?: SocialProvider) => {
    if (!provider && !password.trim()) {
      setError(t.needPassword);
      return;
    }
    Alert.alert(t.confirmTitle, t.confirmText, [
      { text: t.confirmNo, style: "cancel" },
      { text: t.confirmYes, style: "destructive", onPress: () => void remove(provider) },
    ]);
  };

  return (
    <Screen>
      <TopBar>
        <BackArrow label={copy.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(me?.role === "STUDENT" ? "/profile" : "/panel/profile"))} />
      </TopBar>
      <Title text={t.title} size={40} tone="orange" style={styles.title} />
      <Lead text={t.lead} size={16} style={styles.lead} />
      <Note style={styles.keep}>{t.keep}</Note>
      <View style={styles.more}>
        <TextAction onPress={() => openSite(LEGAL.deleteAccount)}>{t.details}</TextAction>
      </View>

      {social ? (
        <Note style={styles.field}>{t.socialLead("Google / Apple")}</Note>
      ) : (
        <View style={styles.field}>
          <Label>{t.passwordLabel}</Label>
          <PasswordBox
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError(null);
            }}
            invalid={!!error}
            toggle={{ show: copy.login.showPassword, hide: copy.login.hidePassword }}
            onSubmit={() => confirm()}
            label={t.passwordLabel}
          />
        </View>
      )}
      <ErrorBox>{error}</ErrorBox>

      <Grow />
      {social ? (
        <>
          <SecondaryButton icon="trash" danger disabled={busy} onPress={() => confirm("GOOGLE")} style={styles.cta}>
            {t.confirmWith("Google")}
          </SecondaryButton>
          <SecondaryButton icon="trash" danger disabled={busy} onPress={() => confirm("APPLE")} style={styles.next}>
            {t.confirmWith("Apple")}
          </SecondaryButton>
        </>
      ) : (
        <SecondaryButton icon="trash" danger disabled={busy} onPress={() => confirm()} style={styles.cta}>
          {t.submit}
        </SecondaryButton>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 24 },
  lead: { marginTop: 14 },
  keep: { color: colors.muted2 },
  more: { alignItems: "flex-start", marginTop: 4 },
  field: { marginTop: 24 },
  cta: { marginTop: 24 },
  next: { marginTop: 10 },
});
