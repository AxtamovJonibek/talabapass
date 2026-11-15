import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { errorText, hasSession, isNetworkError } from "@/api/client";
import type { Me } from "@/api/endpoints";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { getLastPhone, wasOnboarded } from "@/storage";
import { colors } from "@/theme";
import { ErrorBox, Logo, PrimaryButton, Screen } from "@/ui/kit";

/** Qayerdan boshlash: kirgan — o'z qadami; kirmagan — chiqqandan keyin Auth2, birinchi marta karusel, aks holda telefon. */
async function startRoute(reloadMe: () => Promise<Me>): Promise<Href> {
  if (await hasSession()) {
    try {
      return routeFor(await reloadMe());
    } catch (e) {
      // Internet yo'q — sessiya saqlanadi, qayta urinish; sessiya tugagan — kirishga
      if (isNetworkError(e)) throw e;
    }
  }
  if (await getLastPhone()) return "/auth/returning";
  return (await wasOnboarded("student")) ? "/auth/phone?intent=student" : "/intro";
}

/** Ishga tushish ekrani: logo va kutish; internet yo'q bo'lsa — "Qayta urinish". */
export default function Start() {
  const { reloadMe } = useApp();
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    () =>
      startRoute(reloadMe).then(
        (route) => resetTo(route),
        (e: unknown) => setError(errorText(e)),
      ),
    [reloadMe],
  );

  useEffect(() => {
    void start();
  }, [start]);

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <Logo size="lg" />
        {error ? null : <ActivityIndicator color={colors.blue} style={styles.spinner} />}
      </View>
      {error ? (
        <>
          <ErrorBox>{error}</ErrorBox>
          <PrimaryButton
            icon="refresh"
            onPress={() => {
              setError(null);
              void start();
            }}
            style={styles.retry}
          >
            {copy.retry}
          </PrimaryButton>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  spinner: { marginTop: 24 },
  retry: { marginTop: 16 },
});
