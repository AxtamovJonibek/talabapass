import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { bizApi } from "@/api/business";
import { useOrdersWatch } from "@/business/orders-watch";
import { som } from "@/business/ui";
import { copy, langName } from "@/copy";
import { initials } from "@/lib/format";
import { contactLine, displayPhone, localDigits } from "@/lib/phone";
import { pickImage } from "@/lib/pick";
import { useLoad } from "@/lib/use-load";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Card, imageUrl, InfoRow, MenuRow, ScreenHeader, TabScreen } from "@/ui/app";
import { LEGAL, openSite } from "@/ui/legal";
import { Press, Txt } from "@/ui/kit";

/**
 * Profil (saytdagi B5): egasi — biznes kartasi (logotip, holat, bugungi ko'rsatkichlar), aloqa, tahrirlash, kassirlar,
 * buyurtmalar (oldindan buyurtma yoqilgan bo'lsa), bildirishnomalar; kassir — ism, telefon, biznes. Hammaga: Maxfiylik,
 * Shartlar, chiqish; hisobni o'chirish — faqat egasi (kassir hisobini egasi faolsizlantiradi).
 */
export default function BusinessProfile() {
  const p = copy.biz.profile;
  const { me, signOut } = useApp();
  const owner = me?.role === "BUSINESS_OWNER";
  const profile = useLoad(useCallback(() => bizApi.profile(), []), owner, "biz.profile");
  const orders = useOrdersWatch();
  const { refresh } = profile;
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (owner) void refresh();
    }, [owner, refresh]),
  );

  if (!me) return null;
  const b = profile.data?.profile;
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ");

  const logout = () =>
    Alert.alert(copy.profile.logout, undefined, [
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
      {
        text: copy.profile.logout,
        style: "destructive",
        onPress: () => {
          if (busy) return;
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        },
      },
    ]);

  const changeLogo = () => {
    const pick = async () => {
      try {
        const file = await pickImage("logo.jpg");
        if (!file) return;
        await bizApi.uploadLogo(file);
        await refresh();
      } catch (e) {
        Alert.alert(errorText(e));
      }
    };
    if (!b?.logoUrl) return void pick();
    Alert.alert(p.logo, undefined, [
      { text: p.logo, onPress: () => void pick() },
      { text: p.logoRemove, style: "destructive", onPress: () => void bizApi.removeLogo().then(refresh, (e: unknown) => Alert.alert(errorText(e))) },
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
    ]);
  };

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title={p.title} />
        <View style={styles.pad}>
          {owner ? (
            <>
              <View style={styles.hero}>
                <Press onPress={changeLogo} accessibilityRole="button" accessibilityLabel={p.logo} style={styles.logo}>
                  {b?.logoUrl ? (
                    <Image source={{ uri: imageUrl(b.logoUrl) }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
                  ) : (
                    <Txt style={[font(900, 112), { fontSize: 28 }]}>{(b?.name ?? me.business?.name ?? "B").charAt(0).toUpperCase()}</Txt>
                  )}
                </Press>
                <View style={styles.flex1}>
                  <Txt numberOfLines={2} style={[font(900, 112), styles.name]}>
                    {b?.name ?? me.business?.name ?? ""}
                  </Txt>
                  <Txt style={styles.muted}>{p.statuses[b?.status ?? me.business?.status ?? ""] ?? ""}</Txt>
                </View>
              </View>

              {b ? (
                <View style={styles.kpis}>
                  <Kpi value={String(b.salesToday)} label={p.salesToday} />
                  <Kpi value={som(b.revenueToday)} label={p.revenueToday} />
                  <Kpi value={String(b.activeDiscounts)} label={p.activeDiscounts} />
                </View>
              ) : null}

              {b ? (
                <Card style={styles.card}>
                  <InfoRow icon="pin" label={copy.biz.edit.address} value={[b.address, b.district].filter(Boolean).join(", ")} />
                  <InfoRow icon="clock" label={copy.biz.edit.hours} value={b.workingHours} />
                  <InfoRow icon="phone" label={copy.biz.edit.phone} value={b.publicPhone ? displayPhone(localDigits(b.publicPhone)) : "—"} />
                  <InfoRow icon="send" label={copy.biz.edit.telegram} value={b.telegram ? `@${b.telegram}` : "—"} />
                  <InfoRow icon="camera" label={copy.biz.edit.instagram} value={b.instagram ? `@${b.instagram}` : "—"} last />
                </Card>
              ) : null}

              <Card style={styles.card}>
                <MenuRow icon="edit" label={p.edit} onPress={() => router.push("/biz/edit")} />
                <MenuRow icon="users" label={p.cashiers} onPress={() => router.push("/biz/cashiers")} />
                {orders.enabled || orders.waiting > 0 || b?.preorderEnabled ? (
                  <MenuRow icon="bag" label={p.orders} value={orders.waiting > 0 ? String(orders.waiting) : undefined} onPress={() => router.push("/biz/orders")} />
                ) : null}
                <MenuRow icon="bell" label={p.notifications} onPress={() => router.push("/notifications")} last />
              </Card>
            </>
          ) : (
            <View style={styles.hero}>
              <View style={[styles.logo, styles.cashierAvatar]}>
                <Txt style={[font(900, 112), { fontSize: 28, color: colors.white }]}>{initials(me.firstName, me.lastName) || "K"}</Txt>
              </View>
              <View style={styles.flex1}>
                <Txt numberOfLines={2} style={[font(900, 112), styles.name]}>
                  {name}
                </Txt>
                <Txt style={styles.muted}>{contactLine(me)}</Txt>
                <Txt style={[font(700), styles.muted]}>{p.cashierOf(me.business?.name ?? "")}</Txt>
              </View>
            </View>
          )}

          <Card style={styles.card}>
            <MenuRow icon="globe" label={copy.language} value={langName()} onPress={() => router.push("/lang?from=profile")} />
            <MenuRow icon="lock" label={copy.profile.privacy} onPress={() => openSite(LEGAL.privacy)} />
            <MenuRow icon="doc" label={copy.profile.terms} onPress={() => openSite(LEGAL.terms)} last={!owner} />
            {owner ? <MenuRow icon="doc" label={copy.biz.profile.partnerTerms} onPress={() => openSite(LEGAL.partnerTerms)} last /> : null}
          </Card>

          <Card style={styles.card}>
            <MenuRow icon="logout" label={copy.profile.logout} onPress={logout} last={!owner} />
            {owner ? <MenuRow icon="trash" label={copy.profile.deleteAccount} danger onPress={() => router.push("/account/delete")} last /> : null}
          </Card>

          <Txt style={[font(600), styles.version]}>{copy.profile.version(Constants.expoConfig?.version ?? "1.0.0")}</Txt>
        </View>
      </ScrollView>
    </TabScreen>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.kpi}>
      <Txt numberOfLines={1} adjustsFontSizeToFit style={[font(900, 62), { fontSize: 28 }]}>
        {value}
      </Txt>
      <Txt style={styles.kpiLabel}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  content: { paddingBottom: 28 },
  pad: { paddingHorizontal: 24 },
  hero: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 18 },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", overflow: "hidden", transform: [{ rotate: "-4deg" }] },
  cashierAvatar: { backgroundColor: colors.ink },
  name: { fontSize: 24, lineHeight: 26, letterSpacing: em(24, -0.02) },
  muted: { fontSize: 14, color: colors.muted2, marginTop: 4 },
  kpis: { flexDirection: "row", gap: 10, marginTop: 16 },
  kpi: { flex: 1, backgroundColor: colors.white, borderRadius: 20, padding: 12, gap: 2 },
  kpiLabel: { fontSize: 12, color: colors.muted2 },
  card: { marginTop: 16 },
  version: { fontSize: 12, color: colors.muted2, textAlign: "center", marginTop: 20 },
});
