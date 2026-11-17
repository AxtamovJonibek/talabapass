import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { bizApi } from "@/api/business";
import { Tag } from "@/business/ui";
import { copy } from "@/copy";
import { formatWhen } from "@/lib/format";
import { displayPhone, localDigits } from "@/lib/phone";
import { useLoad } from "@/lib/use-load";
import { colors, font } from "@/theme";
import { Card, Empty, Failed, Loading, RoundButton } from "@/ui/app";
import { ErrorBox, KEYBOARD_GAP, Label, Note, PhoneBox, PrimaryButton, Press, Title, Txt } from "@/ui/kit";

/**
 * Kassirlar (saytdagi B5 bloki, faqat egasi): faollari (bugungi skanlar, "Smenada"), faolsizlantirish (a'zolik yopiladi,
 * kassir telefonidagi skaner darhol chiqadi), telefon raqami bilan qo'shish (taklif 48 soat, kassir shu raqam bilan
 * ilovaga "Biznes" orqali kirib qabul qiladi) va kutilayotgan takliflar.
 */
export default function Cashiers() {
  const k = copy.biz.cashiers;
  const insets = useSafeAreaInsets();
  const list = useLoad(useCallback(() => bizApi.cashiers(), []), true, "biz.cashiers");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const invite = async () => {
    if (busy || phone.length !== 9) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await bizApi.inviteCashier(`+998${phone}`);
      setPhone("");
      setNotice(k.invited);
      await list.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (memberId: string, name: string) =>
    Alert.alert(k.remove, k.confirmRemove(name), [
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
      {
        text: k.remove,
        style: "destructive",
        onPress: () => void bizApi.removeCashier(memberId).then(() => list.refresh(), (e: unknown) => Alert.alert(errorText(e))),
      },
    ]);

  const revoke = (inviteId: string) => void bizApi.revokeInvite(inviteId).then(() => list.refresh(), (e: unknown) => Alert.alert(errorText(e)));
  const d = list.data;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        bottomOffset={KEYBOARD_GAP}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={colors.orange} />}
      >
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => router.back()} />
        <Title text={k.title} size={36} style={styles.title} />
        <Txt style={styles.lead}>{k.lead}</Txt>

        <Label style={styles.label}>{k.phone}</Label>
        <PhoneBox value={phone} onChange={setPhone} onSubmit={() => void invite()} />
        <ErrorBox>{error}</ErrorBox>
        {notice ? <Note>{notice}</Note> : null}
        <PrimaryButton tone="orange" icon="arrow" onPress={() => void invite()} loading={busy} disabled={phone.length !== 9} style={styles.cta}>
          {k.invite}
        </PrimaryButton>

        {list.loading ? (
          <Loading />
        ) : !d ? (
          <Failed error={list.error ?? copy.unknownError} onRetry={() => void list.reload()} />
        ) : (
          <>
            {d.cashiers.length === 0 ? (
              <Empty icon="users" title={k.empty} style={styles.empty} />
            ) : (
              <Card style={styles.card}>
                {d.cashiers.map((c, i) => {
                  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || displayPhone(localDigits(c.phone));
                  return (
                    <View key={c.memberId} style={[styles.row, i < d.cashiers.length - 1 ? styles.rowLine : null]}>
                      <View style={styles.flex1}>
                        <Txt style={[font(800), { fontSize: 16 }]}>{name}</Txt>
                        <Txt style={styles.muted}>{`${displayPhone(localDigits(c.phone))} · ${k.scansToday(c.scansToday)}`}</Txt>
                        {c.shift !== "none" ? <Tag tone={c.shift === "on" ? "green" : "muted"}>{c.shift === "on" ? k.onShift : k.shiftEnded}</Tag> : null}
                      </View>
                      <Press onPress={() => remove(c.memberId, name)} accessibilityRole="button" accessibilityLabel={`${k.remove}: ${name}`} hitSlop={8}>
                        <Txt style={[font(800), styles.danger]}>{k.remove}</Txt>
                      </Press>
                    </View>
                  );
                })}
              </Card>
            )}

            {d.invites.length > 0 ? (
              <>
                <Txt style={[font(900, 112), styles.section]}>{k.invites}</Txt>
                <Card style={styles.card}>
                  {d.invites.map((inv, i) => (
                      <View key={inv.id} style={[styles.row, i < d.invites.length - 1 ? styles.rowLine : null]}>
                        <View style={styles.flex1}>
                          <Txt style={[font(800), { fontSize: 16 }]}>{inv.phone ? displayPhone(localDigits(inv.phone)) : k.linkInvite}</Txt>
                          <Txt style={styles.muted}>{k.inviteUntil(formatWhen(inv.expiresAt))}</Txt>
                        </View>
                        <Press onPress={() => revoke(inv.id)} accessibilityRole="button" hitSlop={8}>
                          <Txt style={[font(800), styles.danger]}>{k.revoke}</Txt>
                        </Press>
                      </View>
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 24 },
  flex1: { flex: 1, gap: 4 },
  title: { marginTop: 18 },
  lead: { fontSize: 15, lineHeight: 21, color: colors.ink5, marginTop: 10 },
  label: { marginTop: 20 },
  cta: { marginTop: 14 },
  empty: { marginTop: 20 },
  card: { marginTop: 18, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowLine: { borderBottomWidth: 1.5, borderBottomColor: colors.lineSoft },
  muted: { fontSize: 13, color: colors.muted2 },
  danger: { fontSize: 14, color: colors.danger },
  section: { fontSize: 22, marginTop: 24 },
});
