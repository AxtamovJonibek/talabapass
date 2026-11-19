import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, font } from "@/theme";
import { FooterLink, Grow, Lead, Note, PrimaryButton, RoleChip, Screen, Stamp, Title, TopBar, TopBarSpacer, Txt } from "@/ui/kit";

const POLL_MS = 20_000;

/**
 * Ariza yuborilgach: "Arizangiz qabul qilindi" va holat (kutilmoqda). Tasdiqlansa yoki rad etilsa ekran o'zi almashadi:
 * `me` push (`PushHandler`), fokus va har 20 soniyada yangilanadi — tasdiqlangan biznes ilovasi ochiladi, rad etilgan ariza formaga qaytadi.
 */
export default function BusinessReview() {
  const { me, reloadMe, signOut } = useApp();
  const b = copy.business;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    const route = routeFor(me);
    if (route !== "/business/review") resetTo(route);
  }, [me]);

  const check = useCallback(
    (manual: boolean) => {
      if (manual) setBusy(true);
      reloadMe()
        .then((fresh) => {
          if (manual && routeFor(fresh) === "/business/review") setNote(copy.biz.review.refreshed);
        })
        .catch(() => undefined)
        .finally(() => setBusy(false));
    },
    [reloadMe],
  );

  useFocusEffect(
    useCallback(() => {
      check(false);
      const timer = setInterval(() => check(false), POLL_MS);
      return () => clearInterval(timer);
    }, [check]),
  );

  return (
    <Screen>
      <TopBar>
        <TopBarSpacer />
        <RoleChip tone="business">{copy.role.business}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <Stamp>{b.stamp}</Stamp>
        <Title text={b.received} size={40} style={styles.title} />
        <Lead text={b.contact} size={16} style={styles.lead} />
      </View>

      <View style={styles.status}>
        <Txt style={[font(700), styles.statusLabel]}>{b.status}</Txt>
        <View style={styles.pill}>
          <Txt style={[font(800), styles.pillText]}>{b.pending}</Txt>
        </View>
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
  status: { marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderWidth: 2, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16 },
  statusLabel: { fontSize: 15, color: colors.muted },
  pill: { backgroundColor: colors.orange, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { fontSize: 14, color: colors.ink },
  cta: { marginTop: 24 },
  cabinet: { marginTop: 6 },
});
