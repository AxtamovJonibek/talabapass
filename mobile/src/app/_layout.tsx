import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocationProvider } from "@/lib/location";
import { AppStateProvider } from "@/state";
import { UpdateGate } from "@/ui/update-gate";
import { colors, fontFiles } from "@/theme";

// Shriftlar yuklanguncha splash turadi (aks holda matn tizim shriftida "sakraydi")
void SplashScreen.preventAutoHideAsync();

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
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: "slide_from_right" }}>
              {/* Talaba ilovasi tablarida "orqaga" kirish ekranlariga qaytmaydi */}
              <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: "fade" }} />
            </Stack>
          </LocationProvider>
        </AppStateProvider>
      </UpdateGate>
    </SafeAreaProvider>
  );
}
