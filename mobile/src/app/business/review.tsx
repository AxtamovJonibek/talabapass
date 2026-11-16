import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BusinessTop } from "@/business/header";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, font } from "@/theme";
import { FooterLink, Grow, Lead, Note, PrimaryButton, Screen, Stamp, Title, Txt } from "@/ui/kit";

/**
 * B9 · Tekshiruvda (4/4) — kutish ekrani. Biznes bo'limlari (chegirmalar, skaner, statistika) faqat tasdiqdan keyin.
 * Ekran ochilganda va "Holatni yangilash"da holat qayta so'raladi: tasdiqlangan — biznes ilovasi, rad etilgan — ariza
 * (sababi bilan, tuzatib qayta yuboriladi).
 */
export default function BusinessReview() {
  const { reloadMe, signOut } = useApp();
  const b = copy.business;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const check = useCallback(
    (manual: boolean) => {
      if (manual) setBusy(true);
      reloadMe()
        .then((me) => {
          const route = routeFor(me);
          if (route !== "/business/review") resetTo(route);
          else if (manual) setNote(copy.biz.review.refreshed);
        })
        .catch(() => undefined)
        .finally(() => setBusy(false));
    },
    [reloadMe],
  );

  useFocusEffect(
    useCallback(() => {
      check(false);
    }, [check]),
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
        <Txt style={[font(800), styles.cardTitle]}>{copy.biz.review.ctaTitle}</Txt>
        <Txt style={styles.cardLead}>{copy.biz.review.ctaLead}</Txt>
      </View>

      <Grow />

      {note ? <Note>{note}</Note> : null}
      <PrimaryButton tone="orange" icon="refresh" loading={busy} onPress={() => check(true)} style={styles.cta}>
        {copy.biz.review.refresh}
      </PrimaryButton>
      <FooterLink lead={copy.profile.logout} onPress={() => void signOut()} style={styles.cabinet} />
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
