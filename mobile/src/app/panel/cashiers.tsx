import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { bizApi } from "@/api/business";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { CashierList } from "@/site/business";
import { BackText, Button, SiteInput } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { KEYBOARD_GAP, Txt } from "@/ui/kit";

/**
 * Kassirlar — saytdagi `/biznes/kassirlar` telefon ko'rinishi ("← Orqaga" + B5 bloki): ro'yxat (bugungi skanlar, smena,
 * o'chirish), ochiq takliflar. Saytda taklif — bir martalik havola; ilovada — kassir telefon raqami (kassir shu raqam
 * bilan ilovaga kirib qabul qiladi, 48 soat), maydon saytdagi havola bloki uslubida "+ Taklif qilish" bosilganda ochiladi.
 */
export default function Cashiers() {
  const k = copy.biz.cashiers;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ invite?: string }>();
  const list = useLoad(useCallback(() => bizApi.cashiers(), []), true, "biz.cashiers");
  const [open, setOpen] = useState(params.invite === "1");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const digits = phone.replace(/\D/g, "").replace(/^998/, "");
  const { refresh } = list;

  // Tab ekrani joyida qoladi: har kirishda ro'yxat yangilanadi, profildagi "+ Taklif qilish" maydonni ochadi
  useFocusEffect(
    useCallback(() => {
      void refresh();
      if (params.invite === "1") setOpen(true);
    }, [refresh, params.invite]),
  );

  const invite = async () => {
    if (busy) return;
    if (digits.length !== 9) return setError(copy.login.phoneInvalid);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await bizApi.inviteCashier(`+998${digits}`);
      setPhone("");
      setNotice(k.invited);
      await list.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const box = open ? (
    <View testID="invite-box" style={styles.box}>
      <Txt style={[font(700), styles.boxTitle]}>{k.phone.toUpperCase()}</Txt>
      <SiteInput mono value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+998 90 123 45 67" autoFocus invalid={Boolean(error)} returnKeyType="send" onSubmitEditing={() => void invite()} />
      {error ? <Txt style={[font(600), { fontSize: 13, color: colors.danger }]}>{error}</Txt> : null}
      <View style={styles.boxRow}>
        <Button variant="ink" size="sm" busy={busy} disabled={busy} onPress={() => void invite()}>
          {k.invite}
        </Button>
        <Txt style={styles.hint}>{notice ?? k.lead}</Txt>
      </View>
    </View>
  ) : null;

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 56, paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
      bottomOffset={KEYBOARD_GAP}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={colors.orange} />}
    >
      <BackText label={copy.back} onPress={() => router.navigate("/panel/profile")} style={{ marginBottom: 4 }} />
      {list.data ? (
        <CashierList data={list.data} onChanged={() => void list.refresh()} onInvite={() => setOpen((v) => !v)} extra={box} />
      ) : list.loading ? (
        <Loading />
      ) : (
        <Failed error={list.error ?? copy.unknownError} onRetry={() => void list.reload()} />
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  // Saytdagi taklif havolasi bloki: uzuq chegara, 16 radius, 12 ichki
  box: { marginBottom: 8, gap: 8, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong, padding: 12 },
  boxTitle: { fontSize: 12, letterSpacing: em(12, 0.05), color: colors.muted },
  boxRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  hint: { flex: 1, minWidth: 160, fontSize: 12, color: colors.muted },
});
