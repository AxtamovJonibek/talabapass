import { useEffect, useState, type ReactNode } from "react";
import { AppState, BackHandler, Linking, StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { appVersion, cachedAppConfig, loadAppConfig, mustUpdate, storeUrl, type AppConfig } from "@/lib/app-version";
import { fetchUpdateInBackground } from "@/lib/updates";
import { colors, em, font } from "@/theme";
import { Icon } from "./icons";
import { Grow, Lead, Logo, PrimaryButton, Screen, Title, Txt } from "./kit";

/** Ilova oldingi planga qaytganda konfiguratsiya qayta so'raladi (ko'pi bilan soatiga bir marta) */
const RECHECK_MS = 60 * 60_000;

/**
 * Ilova ustidagi darvoza: versiya `minVersion` dan past bo'lsa — butun ekranni egallaydigan "Ilovani yangilang"
 * (navigatsiya umuman chizilmaydi, Android "orqaga" ishlamaydi). Aks holda ilova o'zi; shu yerda OTA ham fonda yuklanadi.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    let last = 0;
    const check = () => {
      if (Date.now() - last < RECHECK_MS) return;
      last = Date.now();
      void loadAppConfig().then((c) => c && setConfig(c));
      void fetchUpdateInBackground();
    };
    // Avval saqlangani (internetsiz ochilganda ham chegara amal qiladi), keyin serverdan
    void cachedAppConfig().then((c) => c && setConfig((current) => current ?? c));
    check();
    const sub = AppState.addEventListener("change", (state) => state === "active" && check());
    return () => sub.remove();
  }, []);

  const blocked = config !== null && mustUpdate(config);

  useEffect(() => {
    if (!blocked) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [blocked]);

  if (!blocked) return <>{children}</>;
  return <ForceUpdate url={storeUrl(config)} min={config.minVersion} />;
}

function ForceUpdate({ url, min }: { url: string | null; min: AppConfig["minVersion"] }) {
  const u = copy.update;
  return (
    <Screen scroll={false}>
      <Logo size="lg" />
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Icon name="refresh" size={32} strokeWidth={2.6} color={colors.white} />
        </View>
        <Title text={u.title} size={44} style={styles.title} />
        <Lead text={u.lead} size={16} style={styles.lead} />
        <Txt style={[font(700), styles.version]}>{u.version(appVersion(), min)}</Txt>
      </View>
      <Grow />
      {url ? (
        <PrimaryButton onPress={() => void Linking.openURL(url)}>{u.cta}</PrimaryButton>
      ) : (
        <Txt style={styles.noStore}>{u.noStore}</Txt>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 48 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  title: { marginTop: 24 },
  lead: { marginTop: 14 },
  version: { marginTop: 16, fontSize: 13, letterSpacing: em(13, 0.04), color: colors.muted2 },
  noStore: { fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center" },
});
