import { useFonts } from "expo-font";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { copy } from "@/copy";
import { LocationProvider } from "@/lib/location";
import { AppStateProvider } from "@/state";
import { colors, fontFiles } from "@/theme";
import { Grow, Lead, Logo, PrimaryButton, Screen, Title } from "@/ui/kit";
import { OfflineBanner } from "@/ui/offline";
import { PushHandler } from "@/ui/push-handler";
import { UpdateGate } from "@/ui/update-gate";

// Shriftlar (Archivo) yuklanguncha splash turadi — aks holda matn tizim shriftida "sakraydi"
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  const [loaded, error] = useFonts(fontFiles);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <UpdateGate>
        <AppStateProvider>
          <LocationProvider>
            <StatusBar style="dark" />
            <PushHandler />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: "slide_from_right" }}>
              {/* Talaba ilovasi tablarida "orqaga" kirish ekranlariga qaytmaydi */}
              <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: "fade" }} />
            </Stack>
            <OfflineBanner />
          </LocationProvider>
        </AppStateProvider>
      </UpdateGate>
    </SafeAreaProvider>
  );
}

/**
 * Global ErrorBoundary (expo-router: ildiz layout'dan eksport — ichidagi har qanday ekran xatosi shu yerga tushadi).
 * "Qayta urinish" ekranni qayta chizadi; xato console'ga (Expo/adb log).
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error("[app] ekran xatosi:", error);
    void SplashScreen.hideAsync();
  }, [error]);
  return (
    <SafeAreaProvider>
      <Screen scroll={false}>
        <Logo />
        <View style={styles.hero}>
          <Title text={copy.crashTitle} size={42} />
          <Lead text={copy.crashLead} size={16} style={styles.lead} />
        </View>
        <Grow />
        <PrimaryButton icon="refresh" onPress={() => void retry()}>
          {copy.retry}
        </PrimaryButton>
      </Screen>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 40 },
  lead: { marginTop: 14 },
});
