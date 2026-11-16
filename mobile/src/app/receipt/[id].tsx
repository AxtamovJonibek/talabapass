import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/api/client";
import { bizApi } from "@/api/business";
import { som } from "@/business/ui";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Failed, Loading, RoundButton, SecondaryButton } from "@/ui/app";
import { Txt } from "@/ui/kit";

/**
 * Chek (saytdagi B4 / T7 cheki): biznes, №, sana, talaba, kassir, mahsulot, chegirma, jami, to'lov turi; "PDF ochish" —
 * imzoli havola brauzerda. Talaba (o'ziniki), egasi va tasdiqlagan kassir ko'radi (`GET /receipts/<id>`).
 */
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = copy.biz.receipt;
  const insets = useSafeAreaInsets();
  const student = useApp().me?.role === "STUDENT";
  const data = useLoad(useCallback(() => bizApi.receipt(id), [id]), true, `receipt.${id}`);
  const rc = data.data?.receipt;
  const accent = student ? colors.blue : colors.orange;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.head}>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(student ? "/deals" : "/panel/sales"))} />
      </View>
      {data.loading ? (
        <Loading />
      ) : !rc ? (
        <Failed error={data.error ?? copy.unknownError} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.paper}>
            <Txt style={[font(900, 112), styles.business]}>{rc.business.name.toUpperCase()}</Txt>
            <Txt style={styles.center}>{[rc.business.address, rc.business.tin ? r.tin(rc.business.tin) : null].filter(Boolean).join(" · ")}</Txt>
            <View style={styles.dash} />
            <Row label={r.title(rc.no)} value={rc.time} />
            <Row label={r.student} value={rc.student} />
            <Row label={r.cashier} value={rc.cashier} />
            <View style={styles.dash} />
            <Row label={rc.item} value={som(rc.originalPrice)} strong />
            <Row label={`${r.discount} ${rc.badge}`} value={`−${som(rc.discountAmount)}`} tone={colors.greenOk} />
            <View style={styles.dash} />
            <View style={styles.total}>
              <Txt style={[font(900), { fontSize: 18 }]}>{r.total}</Txt>
              <Txt style={[font(900, 62), { fontSize: 34, color: colors.ink }]}>{som(rc.paidAmount)}</Txt>
            </View>
            <Row label={r.payment} value={copy.biz.paymentType[rc.paymentType] ?? rc.paymentType} />
            <View style={[styles.stamp, { backgroundColor: accent }]}>
              <Txt style={[font(900), { fontSize: 12, letterSpacing: em(12, 0.1), color: student ? colors.white : colors.ink }]}>TALABAPASS</Txt>
            </View>
          </View>
          {data.data?.pdfUrl ? (
            <SecondaryButton icon="doc" onPress={() => void Linking.openURL(`${API_URL}${data.data!.pdfUrl}`)} style={styles.pdf}>
              {r.pdf}
            </SecondaryButton>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, strong = false, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <View style={styles.row}>
      <Txt style={[strong ? font(800) : null, styles.label]}>{label}</Txt>
      <Txt style={[font(strong ? 800 : 700), { fontSize: 14, color: tone ?? colors.ink }]}>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { paddingHorizontal: 24 },
  content: { padding: 24 },
  paper: { backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 8 },
  business: { fontSize: 20, textAlign: "center", letterSpacing: em(20, -0.01) },
  center: { fontSize: 12, color: colors.muted2, textAlign: "center" },
  dash: { borderBottomWidth: 1.5, borderStyle: "dashed", borderColor: colors.line, marginVertical: 6 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  label: { flex: 1, fontSize: 14, color: colors.muted },
  total: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stamp: { alignSelf: "center", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 10, transform: [{ rotate: "-3deg" }] },
  pdf: { marginTop: 16 },
});
