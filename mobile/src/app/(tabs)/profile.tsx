import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { appApi, studentApi } from "@/api/endpoints";
import { copy, langName } from "@/copy";
import { initials } from "@/lib/format";
import { contactLine } from "@/lib/phone";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Card, imageUrl, InfoRow, MenuRow, ScreenHeader, TabScreen } from "@/ui/app";
import { LEGAL, openSite } from "@/ui/legal";
import { Txt } from "@/ui/kit";

/** "2027-06-30" → "30.06.2027" */
const dateText = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/**
 * Profil (saytdagi T8 mazmuni): ism, telefon, universitet, kurs, fakultet, holat, ID, guvohnoma muddati; bildirishnomalar,
 * yordam, Maxfiylik siyosati va Foydalanish shartlari (saytdagi huquqiy sahifalar), chiqish va hisobni o'chirish
 * (do'kon talabi). "Ma'lumotlarni tahrirlash" — `/profile/edit` (rasm, ism, kurs, fakultet, tuman).
 */
export default function Profile() {
  const p = copy.profile;
  const { me, reloadMe, signOut } = useApp();
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reloadMe().catch(() => undefined);
      void studentApi
        .profile()
        .then((r) => setAvatar(r.profile.avatarUrl))
        .catch(() => undefined);
      void appApi
        .notifications()
        .then((r) => setUnread(r.unread))
        .catch(() => undefined);
    }, [reloadMe]),
  );

  if (!me) return null;
  const student = me.student;
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ");

  const logout = () =>
    Alert.alert(p.logout, undefined, [
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
      {
        text: p.logout,
        style: "destructive",
        onPress: () => {
          if (busy) return;
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        },
      },
    ]);

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={p.title} />
        <View style={styles.pad}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              {avatar ? (
                <Image source={{ uri: imageUrl(avatar) }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
              ) : (
                <Txt style={[font(900, 112), { fontSize: 28, color: colors.white }]}>{initials(me.firstName, me.lastName) || "T"}</Txt>
              )}
            </View>
            <View style={styles.flex1}>
              <Txt numberOfLines={2} style={[font(900, 112), styles.name]}>
                {name}
              </Txt>
              <Txt style={{ fontSize: 14, color: colors.muted2, marginTop: 4 }}>{contactLine(me)}</Txt>
            </View>
          </View>

          {student ? (
            <Card style={styles.card}>
              <InfoRow icon="student" label={p.university} value={student.university.shortName} />
              <InfoRow icon="book" label={p.course} value={copy.coupon.course(student.course)} />
              {student.faculty ? <InfoRow icon="doc" label={p.faculty} value={student.faculty} /> : null}
              <InfoRow icon="shieldCheck" label={p.status} value={p.statuses[student.status] ?? student.status} />
              <InfoRow icon="idCard" label={p.id} value={student.publicId} last={!student.cardExpiresAt} />
              {student.cardExpiresAt ? <InfoRow icon="clock" label={p.expires} value={dateText(student.cardExpiresAt)} last /> : null}
            </Card>
          ) : null}

          <Card style={styles.card}>
            {student ? <MenuRow icon="edit" label={p.edit} onPress={() => router.push("/profile/edit")} /> : null}
            <MenuRow icon="bell" label={p.notifications} value={unread > 0 ? String(unread) : undefined} onPress={() => router.push("/notifications")} />
            <MenuRow icon="globe" label={copy.language} value={langName()} onPress={() => router.push("/lang?from=profile")} />
            <MenuRow icon="lock" label={p.password} onPress={() => router.push("/auth/password?mode=change")} />
            <MenuRow icon="info" label={p.help} onPress={() => openSite("/#savollar")} />
            <MenuRow icon="lock" label={p.privacy} onPress={() => openSite(LEGAL.privacy)} />
            <MenuRow icon="doc" label={p.terms} onPress={() => openSite(LEGAL.terms)} last />
          </Card>

          <Card style={styles.card}>
            <MenuRow icon="logout" label={p.logout} onPress={logout} />
            <MenuRow icon="trash" label={p.deleteAccount} danger onPress={() => router.push("/account/delete")} last />
          </Card>

          <Txt style={[font(600), styles.version]}>{p.version(Constants.expoConfig?.version ?? "1.0.0")}</Txt>
        </View>
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  content: { paddingBottom: 28 },
  pad: { paddingHorizontal: 24 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 18 },
  avatar: { width: 72, height: 72, borderRadius: 24, overflow: "hidden", backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-4deg" }] },
  name: { fontSize: 24, lineHeight: 26, letterSpacing: em(24, -0.02) },
  card: { marginTop: 16 },
  version: { fontSize: 12, color: colors.muted2, textAlign: "center", marginTop: 20 },
});
