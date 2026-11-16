import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { copy, copyFor, currentLang, deviceLang, LANGS, type Lang } from "@/copy";
import { changeLang } from "@/lang";
import { resetTo } from "@/state";
import { colors, em, font } from "@/theme";
import { BackArrow, Logo, Press, PrimaryButton, Screen, TopBar, Txt } from "@/ui/kit";

/**
 * Til (design/app-flow/Til.dc.html): birinchi ochilishda — keyin karusel. Ekran matni tanlanayotgan tilda ko'rinadi.
 * Profildan (`?from=profile`) ham ochiladi: ← bilan, tanlangach ilova bosh ekranidan yangi tilda qayta ochiladi.
 */
export default function LangScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromProfile = from === "profile";
  const [lang, setLang] = useState<Lang>(() => (fromProfile ? currentLang() : deviceLang()));
  const [busy, setBusy] = useState(false);
  const t = copyFor(lang);

  const submit = async () => {
    setBusy(true);
    await changeLang(lang);
    // Barcha ekranlar yangi tilda yaratilsin: bosh ekrandan (kirgan — o'z bo'limi, birinchi ochilish — karusel)
    resetTo(fromProfile ? "/" : "/intro");
  };

  return (
    <Screen>
      <TopBar style={fromProfile ? null : styles.logoOnly}>
        {fromProfile ? <BackArrow label={copy.back} onPress={() => router.back()} /> : null}
        <Logo size={fromProfile ? "md" : "lg"} />
      </TopBar>

      <View style={styles.stage}>
        <View style={styles.ring} />
        <View style={styles.card}>
          <View style={styles.blue}>
            <Txt style={[font(500), styles.cardTop]}>{t.langScreen.cardTop}</Txt>
            <Txt style={[font(900, 62), styles.big]}>−25%</Txt>
            <Txt style={[font(700), styles.cardBottom]}>{t.langScreen.cardBottom}</Txt>
          </View>
          <View style={styles.sticker}>
            <Txt style={[font(900, 62), styles.stickerText]}>1+1</Txt>
          </View>
        </View>
      </View>

      <Txt style={[font(900, 112), styles.title]} accessibilityRole="header">
        {t.langScreen.title}
      </Txt>
      <Txt style={styles.lead}>{t.langScreen.lead}</Txt>

      <View accessibilityRole="radiogroup" accessibilityLabel="Til · Язык · Language" style={styles.list}>
        {LANGS.map((l) => {
          const on = l.id === lang;
          return (
            <Press
              key={l.id}
              onPress={() => setLang(l.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.option, { borderColor: on ? colors.ink : colors.white }]}
              scale={0.98}
            >
              <View style={[styles.radio, { borderColor: on ? colors.blue : colors.dot }]}>
                <View style={[styles.dot, { backgroundColor: on ? colors.blue : "transparent" }]} />
              </View>
              <Txt style={[font(700), styles.name]}>{l.name}</Txt>
              <Txt style={[font(800), styles.code]}>{l.code}</Txt>
            </Press>
          );
        })}
      </View>

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {t.next}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoOnly: { justifyContent: "flex-start" },
  stage: { flex: 1, minHeight: 300, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 300, height: 300, borderRadius: 150, borderWidth: 2, borderStyle: "dashed", borderColor: colors.line },
  card: { width: 264, transform: [{ rotate: "-4deg" }] },
  blue: {
    backgroundColor: colors.blue,
    borderRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    boxShadow: "0 18px 32px rgba(36, 50, 214, 0.25)",
  },
  cardTop: { fontSize: 13, lineHeight: 18, color: colors.white, opacity: 0.85 },
  big: { fontSize: 76, lineHeight: 76, marginTop: 6, marginBottom: 2, letterSpacing: em(76, -0.01), color: colors.white },
  cardBottom: { fontSize: 17, color: colors.white },
  sticker: {
    position: "absolute",
    top: -24,
    right: -20,
    backgroundColor: colors.orange,
    borderRadius: 20,
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 8,
    transform: [{ rotate: "9deg" }],
    boxShadow: "0 10px 20px rgba(255, 90, 31, 0.3)",
  },
  stickerText: { fontSize: 46, lineHeight: 46 },
  title: { fontSize: 34, lineHeight: 36, letterSpacing: em(34, -0.02) },
  lead: { marginTop: 10, marginBottom: 18, fontSize: 16, lineHeight: 23, color: colors.ink5 },
  list: { gap: 8 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: colors.white,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 17 },
  code: { fontSize: 12, letterSpacing: em(12, 0.06), color: colors.muted2 },
  cta: { marginTop: 16 },
});
