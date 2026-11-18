import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Switch, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appApi, studentApi, type StudentHistory, type StudentProfile } from "@/api/endpoints";
import { copy, langName } from "@/copy";
import { formatSom, initials } from "@/lib/format";
import { useApp } from "@/state";
import { mono, Wordmark } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { imageUrl } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

/** "2027-06-30" → "30.06.2027" */
const dateText = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

function Row({ label, sub, onPress, right, last = false }: { label: string; sub?: string | null; onPress?: () => void; right?: ReactNode; last?: boolean }) {
  const body = (
    <>
      <View style={styles.flex1}>
        <Txt style={[font(600), { fontSize: 15 }]}>{label}</Txt>
        {sub ? <Txt style={{ fontSize: 12, color: colors.muted }}>{sub}</Txt> : null}
      </View>
      {right ?? <Icon name="chevronRight" size={16} color={colors.placeholder} />}
    </>
  );
  return onPress ? (
    <Press onPress={onPress} accessibilityRole="button" scale={0.99} style={[styles.row, last ? null : styles.sep]}>
      {body}
    </Press>
  ) : (
    <View style={[styles.row, last ? null : styles.sep]}>{body}</View>
  );
}

/**
 * T8 — profil, saytning telefon ko'rinishi (`student/profile/profile-screen.tsx` `ProfilePhone`): sarlavha va sozlamalar
 * tugmasi, ko'k talaba kartasi (`StudentIdCard`), "Jami tejaldi" / "Xaridlar", menyu (buyurtmalar, shaxsiy ma'lumotlar,
 * guvohnoma, xabar kaliti, til, parol, yordam) va "Hisobdan chiqish". Ilovada qo'shimcha: tilni tanlash (saytda faqat
 * o'zbekcha) va "Hisobni o'chirish" (do'kon talabi).
 */
export default function Profile() {
  const p = copy.profile;
  const insets = useSafeAreaInsets();
  const { me, reloadMe, signOut } = useApp();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [totals, setTotals] = useState<Pick<StudentHistory, "totalSaved" | "totalCount" | "places"> | null>(null);
  const [notify, setNotify] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  useFocusEffect(
    useCallback(() => {
      void reloadMe().catch(() => undefined);
      void studentApi
        .profile()
        .then((r) => {
          setProfile(r.profile);
          setNotify(r.profile.notify);
        })
        .catch(() => undefined);
      void appApi
        .history()
        .then((h) => setTotals(h))
        .catch(() => undefined);
    }, [reloadMe]),
  );

  if (!me) return null;
  const student = me.student;
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
  const meta = student ? [student.university.shortName, student.faculty, copy.coupon.course(student.course)].filter(Boolean).join(" · ") : "";
  const expires = student?.cardExpiresAt ? new Date(student.cardExpiresAt) : null;

  const toggleNotify = async (on: boolean) => {
    setNotify(on);
    try {
      await studentApi.setNotify(on);
    } catch {
      setNotify(!on);
    }
  };

  const logout = () => {
    if (busy) return;
    setBusy(true);
    void signOut().finally(() => setBusy(false));
  };

  return (
    <ScrollView ref={scroll} style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 58 }]}>
      <View style={styles.head}>
        <Txt accessibilityRole="header" style={[font(900, 112), styles.title]}>
          {p.title}
        </Txt>
        <Press onPress={() => scroll.current?.scrollToEnd({ animated: true })} accessibilityRole="button" accessibilityLabel={p.settings} scale={0.94} style={styles.gear}>
          <Icon name="gear" size={20} />
        </Press>
      </View>

      <View style={styles.idCard}>
        <View style={styles.ring} />
        <View style={styles.cardTop}>
          <Wordmark size={14} white />
          <View style={styles.verified}>
            <Icon name="check" size={12} color={colors.greenSite} />
            <Txt style={[font(700), { fontSize: 12, color: colors.greenSite }]}>{p.verified}</Txt>
          </View>
        </View>
        <View style={styles.cardMid}>
          <View style={styles.avatar}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: imageUrl(profile.avatarUrl) }} style={StyleSheet.absoluteFill} />
            ) : (
              <Txt style={[font(900, 110), { fontSize: 24, color: colors.blue }]}>{initials(me.firstName, me.lastName)}</Txt>
            )}
          </View>
          <View style={[styles.flex1, { gap: 3 }]}>
            <Txt style={[font(800), styles.name]}>{name}</Txt>
            <Txt style={{ fontSize: 13, color: "#DCE0FF" }}>{meta}</Txt>
          </View>
        </View>
        <View style={styles.cardFoot}>
          <Txt style={[mono(), styles.cardFootText]}>ID {student?.publicId ?? ""}</Txt>
          {expires ? <Txt style={[mono(), styles.cardFootText]}>{p.validUntil(dateText(student!.cardExpiresAt!))}</Txt> : null}
        </View>
      </View>

      <View style={styles.totals}>
        <View style={styles.total}>
          <Txt style={{ fontSize: 12, color: colors.muted }}>{p.totalSaved}</Txt>
          <Txt style={[font(900, 90), styles.totalNum]}>
            {formatSom(totals?.totalSaved ?? 0)} <Txt style={[font(700), { fontSize: 12 }]}>{copy.currency}</Txt>
          </Txt>
        </View>
        <View style={styles.total}>
          <Txt style={{ fontSize: 12, color: colors.muted }}>{p.purchases}</Txt>
          <Txt style={[font(900, 90), styles.totalNum]}>
            {totals?.totalCount ?? 0} <Txt style={[font(700), { fontSize: 12 }]}>{p.countPlaces(totals?.places ?? 0)}</Txt>
          </Txt>
        </View>
      </View>

      <View style={styles.menu}>
        <Row label={p.orders} onPress={() => router.push("/orders")} />
        <Row label={p.personal} onPress={() => router.push("/profile-edit")} />
        <Row label={p.card} sub={expires ? p.nextCheck(expires.getUTCFullYear(), copy.months[expires.getUTCMonth()]!) : null} onPress={() => router.push("/profile-card")} />
        <Row
          label={p.notify}
          right={
            <Switch
              value={Boolean(notify)}
              onValueChange={(on) => void toggleNotify(on)}
              disabled={notify === null}
              trackColor={{ false: colors.line, true: colors.ink }}
              thumbColor={colors.white}
              accessibilityLabel={p.notify}
            />
          }
        />
        <Row label={copy.language} onPress={() => router.push("/lang?from=profile")} right={<Txt style={{ fontSize: 14, color: colors.muted }}>{langName()}</Txt>} />
        <Row label={p.help} onPress={() => router.push("/help")} last />
      </View>

      <Press onPress={logout} accessibilityRole="button" scale={0.98} style={styles.logout}>
        <Txt style={[font(700), { fontSize: 15, color: colors.danger }]}>{p.logout}</Txt>
      </Press>
      <Press onPress={() => router.push("/account/delete")} accessibilityRole="button" scale={0.98} style={styles.delete}>
        <Txt style={[font(600), { fontSize: 13, color: colors.muted }]}>{p.deleteAccount}</Txt>
      </Press>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  flex1: { flex: 1, minWidth: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 30, letterSpacing: em(30, -0.03) },
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  idCard: { marginTop: 18, overflow: "hidden", borderRadius: 20, backgroundColor: colors.blue, padding: 18 },
  ring: { position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: 70, borderWidth: 22, borderColor: colors.blue2 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  verified: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, backgroundColor: colors.white, paddingHorizontal: 9, paddingVertical: 5 },
  cardMid: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  name: { fontSize: 22, lineHeight: 23, letterSpacing: em(22, -0.02), color: colors.white },
  cardFoot: { marginTop: 18, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderStyle: "dashed", borderColor: "#6A75F0", paddingTop: 12 },
  cardFootText: { fontSize: 12, color: "#DCE0FF" },
  totals: { marginTop: 10, flexDirection: "row", gap: 8 },
  total: { flex: 1, borderRadius: 16, backgroundColor: colors.white, padding: 14 },
  totalNum: { marginTop: 4, fontSize: 22 },
  menu: { marginTop: 16, borderRadius: 16, backgroundColor: colors.white },
  row: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  logout: { marginTop: 12, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  delete: { height: 44, alignItems: "center", justifyContent: "center" },
});
