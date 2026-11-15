import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { errorText, hasSession, isNetworkError } from "@/api/client";
import type { Me } from "@/api/endpoints";
import { copy } from "@/copy";
import { cachedCoupons, cachedMe } from "@/lib/offline";
import { resetTo, routeFor, useApp } from "@/state";
import { getLastPhone, wasOnboarded } from "@/storage";
import { colors } from "@/theme";
import { ErrorBox, Logo, PrimaryButton, Screen } from "@/ui/kit";

/**
 * Qayerdan boshlash: kirgan — o'z qadami; kirmagan — chiqqandan keyin Auth2, birinchi marta karusel, aks holda telefon.
 * Internet yo'q, lekin oldin kirgan bo'lsa — oxirgi saqlangan `me` bilan ilovaga (faol kupon bo'lsa — kupon ekrani:
 * QR internetsiz ishlaydi); saqlangani yo'q bo'lsa — "Qayta urinish".
 */
async function startRoute(reloadMe: () => Promise<Me>, restoreMe: (me: Me) => void): Promise<Href> {
  if (await hasSession()) {
    try {
      return routeFor(await reloadMe());
    } catch (e) {
      // Sessiya tugagan — kirishga
      if (isNetworkError(e)) {
        const me = await cachedMe();
        if (!me) throw e;
        restoreMe(me);
        return me.student?.status === "APPROVED" && (await cachedCoupons()).length > 0 ? "/coupon" : routeFor(me);
      }
    }
  }
  if (await getLastPhone()) return "/auth/returning";
  return (await wasOnboarded("student")) ? "/auth/phone?intent=student" : "/intro";
}

/** Ishga tushish ekrani: logo va kutish; internet yo'q bo'lsa — "Qayta urinish". */
export default function Start() {
  const { reloadMe, restoreMe } = useApp();
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    () =>
      startRoute(reloadMe, restoreMe).then(
        (route) => resetTo(route),
        (e: unknown) => setError(errorText(e)),
      ),
    [reloadMe, restoreMe],
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
