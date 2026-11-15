import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { BusinessTop } from "@/business/header";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, font } from "@/theme";
import { openSite } from "@/ui/legal";
import { FooterLink, Grow, Lead, PrimaryButton, Screen, Stamp, Title, Txt } from "@/ui/kit";

/**
 * B9 · Tekshiruvda (4/4). Chegirma yaratish va kabinet hozircha saytda (ilovada biznes kabineti yo'q) — brauzerda ochiladi.
 * Ekran ochilganda holat qayta so'raladi: tasdiqlangan yoki rad etilgan bo'lsa — o'z ekraniga.
 */
export default function BusinessReview() {
  const { reloadMe } = useApp();
  const b = copy.business;

  useFocusEffect(
    useCallback(() => {
      reloadMe()
        .then((me) => {
          const route = routeFor(me);
          if (route !== "/business/review") resetTo(route);
        })
        .catch(() => undefined);
    }, [reloadMe]),
  );

  return (
    <Screen>
      <BusinessTop step={4} back={false} />

      <View style={styles.hero}>
        <Stamp>{b.stamp}</Stamp>
        <Title text={b.title4} size={44} style={styles.title} />
        <Lead text={b.lead4} size={16} style={styles.lead} />
      </View>

      <View style={styles.card}>
        <View style={styles.badge}>
          <Txt style={[font(900, 62), { fontSize: 26 }]}>{b.ctaBadge}</Txt>
        </View>
        <Txt style={[font(800), styles.cardTitle]}>{b.ctaTitle}</Txt>
        <Txt style={styles.cardLead}>{b.ctaLead}</Txt>
      </View>

      <Grow />

      <PrimaryButton tone="orange" onPress={() => openSite("/biznes/chegirma/yangi")} style={styles.cta}>
        {b.createDiscount}
      </PrimaryButton>
      <FooterLink lead={b.cabinet} onPress={() => openSite("/biznes")} style={styles.cabinet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  title: { marginTop: 20 },
  lead: { marginTop: 14 },
  card: { marginTop: 28, backgroundColor: colors.ink, borderRadius: 28, padding: 22, transform: [{ rotate: "-1deg" }], boxShadow: "0 18px 32px rgba(17, 17, 17, 0.2)" },
  badge: {
    position: "absolute",
    top: -18,
    right: 18,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }],
  },
  cardTitle: { fontSize: 20, lineHeight: 24, maxWidth: 220, color: colors.white },
  cardLead: { fontSize: 14, lineHeight: 20, color: colors.white, opacity: 0.8, marginTop: 8 },
  cta: { marginTop: 24 },
  cabinet: { marginTop: 6 },
});
