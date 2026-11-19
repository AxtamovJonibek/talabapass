import Constants from "expo-constants";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { bizApi, type BusinessProfile as ProfileData } from "@/api/business";
import { copy, langName } from "@/copy";
import { initials } from "@/lib/format";
import { contactLine, displayPhone, localDigits } from "@/lib/phone";
import { pickImage } from "@/lib/pick";
import { useLoad } from "@/lib/use-load";
import { BlockHead, CashierList, DiscountList, ProfileHeader } from "@/site/business";
import { useApp } from "@/state";
import { colors, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { LEGAL, openSite } from "@/ui/legal";
import { Press, Txt } from "@/ui/kit";

/** Saytdagi telefon profili oxiridagi qator (`tp-row`, 50px, markazda) */
function Row({ label, onPress, danger = false, value }: { label: string; onPress: () => void; danger?: boolean; value?: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" scale={0.98} style={styles.row}>
      <Txt style={[font(700), { fontSize: 15, color: danger ? colors.danger : colors.ink }]}>
        {label}
        {value ? <Txt style={[font(700), { fontSize: 15, color: colors.blue }]}>{` · ${value}`}</Txt> : null}
      </Txt>
    </Press>
  );
}

/** Ariza ma'lumotlari (nom/manzil/STIR/aloqa/joylashuv/ish vaqti) — admin to'ldirgani ham shu yerda ko'rinadi */
function Details({ b }: { b: ProfileData }) {
  const d = copy.biz.profile.details;
  const rows: [string, string | null][] = [
    [d.address, b.address],
    [d.tin, b.tin],
    [d.phone, b.publicPhone ? displayPhone(localDigits(b.publicPhone)) : null],
    [d.telegram, b.telegram ? `@${b.telegram}` : null],
    [d.hours, b.workingHours || null],
    [d.location, b.lat !== null && b.lng !== null ? `${b.lat.toFixed(5)}, ${b.lng.toFixed(5)}` : null],
  ];
  return (
    <View style={styles.details}>
      <BlockHead title={d.title} />
      {rows.map(([label, value]) => (
        <View key={label} style={styles.detailRow}>
          <Txt style={{ fontSize: 13, color: colors.muted }}>{label}</Txt>
          <Txt style={[font(700), styles.detailValue]}>{value ?? d.none}</Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * B5 — biznes profili, saytdagi `/biznes/profil` ning telefon ko'rinishi: qora sarlavha (logotip, nom, holat, bugungi
 * ko'rsatkichlar, tahrirlash), chegirmalar (kalit bilan), kassirlar, "Parolni o'zgartirish", "Hisobdan chiqish".
 * Saytda yo'q, ilovaga kerak (do'kon talabi): til, bildirishnomalar, huquqiy havolalar, hisobni o'chirish, versiya —
 * shu qator uslubida pastda. Kassir — ism, raqam, biznes va shu qatorlar.
 */
export default function BusinessProfile() {
  const p = copy.biz.profile;
  const insets = useSafeAreaInsets();
  const { me, signOut } = useApp();
  const owner = me?.role === "BUSINESS_OWNER";
  const profile = useLoad(useCallback(() => bizApi.profile(), []), owner, "biz.profile");
  const discounts = useLoad(useCallback(() => bizApi.discounts(), []), owner, "biz.discounts");
  const cashiers = useLoad(useCallback(() => bizApi.cashiers(), []), owner, "biz.cashiers");
  const [busy, setBusy] = useState(false);
  const { refresh: refreshProfile } = profile;
  const { refresh: refreshDiscounts } = discounts;
  const { refresh: refreshCashiers } = cashiers;
  const refreshAll = useCallback(() => {
    void refreshProfile();
    void refreshDiscounts();
    void refreshCashiers();
  }, [refreshProfile, refreshDiscounts, refreshCashiers]);

  useFocusEffect(
    useCallback(() => {
      if (owner) refreshAll();
    }, [owner, refreshAll]),
  );

  if (!me) return null;
  const b = profile.data?.profile;

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
        await profile.refresh();
      } catch (e) {
        Alert.alert(errorText(e));
      }
    };
    if (!b?.logoUrl) return void pick();
    Alert.alert(p.logo, undefined, [
      { text: p.logo, onPress: () => void pick() },
      { text: p.logoRemove, style: "destructive", onPress: () => void bizApi.removeLogo().then(profile.refresh, (e: unknown) => Alert.alert(errorText(e))) },
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
    ]);
  };

  const rows = (
    <>
      <Row label={copy.profile.logout} danger onPress={logout} />
      <View style={styles.extra}>
        <Row label={copy.language} value={langName()} onPress={() => router.push("/lang?from=profile")} />
        {owner ? <Row label={p.notifications} onPress={() => router.push("/notifications")} /> : null}
        <Row label={copy.profile.privacy} onPress={() => openSite(LEGAL.privacy)} />
        <Row label={copy.profile.terms} onPress={() => openSite(LEGAL.terms)} />
        {owner ? <Row label={p.partnerTerms} onPress={() => openSite(LEGAL.partnerTerms)} /> : null}
        {owner ? <Row label={copy.profile.deleteAccount} danger onPress={() => router.push("/account/delete")} /> : null}
      </View>
      <Txt style={[font(600), styles.version]}>{copy.profile.version(Constants.expoConfig?.version ?? "1.0.0")}</Txt>
    </>
  );

  if (!owner) {
    const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
    return (
      <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={[styles.cashierHead, { paddingTop: insets.top + 56 }]}>
          <View style={styles.cashierAvatar}>
            <Txt style={[font(900, 125), { fontSize: 22, color: colors.ink }]}>{initials(me.firstName, me.lastName) || "K"}</Txt>
          </View>
          <View style={styles.flex1}>
            <Txt style={[font(800), { fontSize: 20, color: colors.paper }]}>{name}</Txt>
            <Txt style={{ fontSize: 13, color: colors.fog2 }}>{contactLine(me)}</Txt>
            <Txt style={[font(700), { fontSize: 12, color: colors.mint }]}>{p.cashierOf(me.business?.name ?? "")}</Txt>
          </View>
        </View>
        <View style={styles.body}>{rows}</View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 20 }}
      refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={refreshAll} tintColor={colors.orange} />}
    >
      {b ? (
        <ProfileHeader p={b} top={insets.top + 56} onLogo={changeLogo} />
      ) : (
        <View style={[styles.headPlaceholder, { paddingTop: insets.top + 56 }]}>{profile.error ? <Failed error={profile.error} onRetry={() => void profile.reload()} /> : <Loading />}</View>
      )}
      <View style={styles.body}>
        {b ? <Details b={b} /> : null}
        <BlockHead title={copy.biz.discounts.title} action={copy.biz.discounts.addShort} onAction={() => router.push("/biz/discount/new")} />
        {discounts.data ? (
          <DiscountList discounts={discounts.data.discounts} onChange={(next) => discounts.setData(() => ({ discounts: next }))} />
        ) : discounts.error ? (
          <Failed error={discounts.error} onRetry={() => void discounts.reload()} />
        ) : (
          <Loading />
        )}
        <View style={styles.cashiers}>
          {cashiers.data ? (
            <CashierList data={cashiers.data} onChanged={() => void cashiers.refresh()} />
          ) : cashiers.error ? (
            <Failed error={cashiers.error} onRetry={() => void cashiers.reload()} />
          ) : null}
        </View>
        {rows}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0, gap: 3 },
  root: { flex: 1, backgroundColor: colors.paper },
  body: { paddingHorizontal: 16, paddingTop: 18 },
  cashiers: { paddingTop: 18 },
  details: { paddingBottom: 18 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 6 },
  detailValue: { flex: 1, fontSize: 14, textAlign: "right", color: colors.ink },
  row: { marginTop: 12, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  extra: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  version: { fontSize: 12, color: colors.muted2, textAlign: "center", marginTop: 16 },
  headPlaceholder: { backgroundColor: colors.ink, minHeight: 180, paddingBottom: 20 },
  cashierHead: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.ink, paddingHorizontal: 20, paddingBottom: 20 },
  cashierAvatar: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
});
