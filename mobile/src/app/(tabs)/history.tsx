import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appApi, type ReceiptData } from "@/api/endpoints";
import { API_URL } from "@/api/client";
import { copy } from "@/copy";
import { formatSom, MINUS, toTashkent } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { Receipt, ReceiptDivider, ReceiptRow } from "@/site/receipt";
import { colors, em, font } from "@/theme";
import { Failed, Loading, OptionRow, Sheet } from "@/ui/app";
import { Icon, isIconName } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

const DAY_MS = 86_400_000;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * T7 — tarix, saytning telefon ko'rinishi (`student/history/history-screen.tsx` `HistoryPhone`): sarlavha va oy tanlovi,
 * "Tejadingiz" (qora) va "Xaridlar" kartalari, tanlangan chek (arra chetli) va "PDF yuklab olish", "OLDINROQ" ro'yxati.
 */
export default function History() {
  const h = copy.history;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState<string | undefined>(undefined);
  // `?chek=<id>` — kupon sotilgach shu chek ochiladi (saytdagi `/tarix?chek=`)
  const params = useLocalSearchParams<{ chek?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(params.chek ?? null);
  const [shownParam, setShownParam] = useState(params.chek);
  if (params.chek !== shownParam) {
    setShownParam(params.chek);
    if (params.chek) setSelectedId(params.chek);
  }
  const [picking, setPicking] = useState(false);
  const data = useLoad(useCallback(() => appApi.history(month), [month]), true, `history.${month ?? "now"}`);
  const { refresh } = data;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const today = toTashkent(new Date()).date.getTime();
  const monthName = (key: string) => {
    const [y, m] = key.split("-");
    return `${cap(copy.months[Number(m) - 1]!)} ${y}`;
  };
  const shortDate = (iso: string) => {
    const at = toTashkent(new Date(iso));
    if (at.date.getTime() === today) return h.today;
    return h.dayShort(at.date.getUTCDate(), h.monthsShort[at.date.getUTCMonth()]!);
  };
  const sectionLabel = (iso: string) => {
    const at = toTashkent(new Date(iso));
    if (at.date.getTime() === today) return h.todayCaps;
    if (at.date.getTime() === today - DAY_MS) return h.yesterdayCaps;
    return h.dayLong(at.date.getUTCDate(), copy.months[at.date.getUTCMonth()]!).toUpperCase();
  };

  const hist = data.data;
  const selected: ReceiptData | null = hist ? (hist.receipts.find((r) => r.id === selectedId) ?? hist.receipts[0] ?? null) : null;
  const others = hist ? hist.receipts.filter((r) => r.id !== selected?.id) : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 58 }]}>
      <View style={styles.pad}>
        <View style={styles.head}>
          <Txt accessibilityRole="header" style={[font(900, 112), styles.title]}>
            {h.title}
          </Txt>
          {hist ? (
            <Press onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={h.month} scale={0.97} style={styles.month}>
              <Txt style={[font(600), { fontSize: 14 }]}>{monthName(hist.month)}</Txt>
              <Icon name="chevronDown" size={14} />
            </Press>
          ) : null}
        </View>
        {hist ? (
          <View style={styles.cards}>
            <View style={[styles.card, styles.cardInk]}>
              <Txt style={{ fontSize: 12, color: "#BDBAB2" }}>{h.saved}</Txt>
              <Txt style={[font(900, 90), styles.big, { color: colors.paper, letterSpacing: em(28, -0.02) }]}>
                {formatSom(hist.saved)} <Txt style={[font(700), { fontSize: 14, color: colors.paper }]}>{copy.currency}</Txt>
              </Txt>
            </View>
            <View style={[styles.card, styles.cardWhite]}>
              <Txt style={{ fontSize: 12, color: colors.muted }}>{h.purchases}</Txt>
              <Txt style={[font(900, 90), styles.big]}>{hist.count}</Txt>
            </View>
          </View>
        ) : null}
      </View>

      {data.loading ? (
        <Loading />
      ) : !hist ? (
        <Failed error={data.error ?? copy.unknownError} onRetry={() => void data.reload()} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {selected ? (
            <>
              <Txt style={[font(700), styles.section]}>{sectionLabel(selected.createdAt)}</Txt>
              <View style={styles.receipt}>
                <Receipt status={h.receipt.confirmed} number={h.receipt.number(selected.no)} width={width - 40}>
                  <ReceiptRow label={h.receipt.business} value={selected.business.name} />
                  <ReceiptRow label={h.receipt.product} value={selected.item} />
                  <ReceiptRow label={h.receipt.time} value={selected.time} />
                  <ReceiptRow label={h.receipt.cashier} value={selected.cashier} />
                  <ReceiptDivider />
                  <ReceiptRow label={h.receipt.originalPrice} value={formatSom(selected.originalPrice)} />
                  <ReceiptRow kind="discount" label={h.receipt.discount(selected.badge)} value={`${MINUS}${formatSom(selected.discountAmount)}`} />
                  <ReceiptRow kind="total" label={h.receipt.paid} value={`${formatSom(selected.paidAmount)} ${copy.currency}`} />
                </Receipt>
              </View>
              <Press onPress={() => void Linking.openURL(selected.pdfUrl.startsWith("http") ? selected.pdfUrl : `${API_URL}${selected.pdfUrl}`)} accessibilityRole="link" scale={0.98} style={styles.pdf}>
                <Txt style={[font(700), { fontSize: 13, color: colors.blue }]}>{h.pdf}</Txt>
              </Press>
            </>
          ) : (
            <View style={styles.empty}>
              <Txt style={{ fontSize: 14, color: colors.muted }}>{h.empty}</Txt>
            </View>
          )}
          {others.length ? (
            <>
              <Txt style={[font(700), styles.section, { marginTop: 20 }]}>{h.earlier}</Txt>
              <View style={styles.rows}>
                {others.map((r, i) => (
                  <Press key={r.id} onPress={() => setSelectedId(r.id)} accessibilityRole="button" scale={0.99} style={[styles.row, i < others.length - 1 ? styles.rowLine : null]}>
                    <View style={[styles.tile, { backgroundColor: r.category.tile }]}>
                      <Icon name={isIconName(r.category.icon) ? r.category.icon : "bowl"} size={22} color={r.category.ink} />
                    </View>
                    <View style={styles.flex1}>
                      <Txt style={[font(700), { fontSize: 14 }]}>{r.business.name}</Txt>
                      <Txt numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>
                        {r.item} · {shortDate(r.createdAt)}
                      </Txt>
                    </View>
                    <View style={styles.amounts}>
                      <Txt style={[font(700), { fontSize: 14 }]}>{formatSom(r.paidAmount)}</Txt>
                      <Txt style={[font(600), { fontSize: 12, color: colors.greenSite }]}>
                        {MINUS}
                        {formatSom(r.discountAmount)}
                      </Txt>
                    </View>
                  </Press>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}

      <Sheet visible={picking} onClose={() => setPicking(false)} title={h.month}>
        <ScrollView style={{ maxHeight: 360 }}>
          {(hist?.months ?? []).map((m) => (
            <OptionRow
              key={m}
              label={monthName(m)}
              selected={m === hist?.month}
              onPress={() => {
                setPicking(false);
                setSelectedId(null);
                setMonth(m);
              }}
            />
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  pad: { paddingHorizontal: 20 },
  flex1: { flex: 1, minWidth: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 30, letterSpacing: em(30, -0.03) },
  month: { height: 40, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 12 },
  cards: { marginTop: 16, flexDirection: "row", gap: 8 },
  card: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  cardInk: { flex: 1.4, backgroundColor: colors.ink },
  cardWhite: { flex: 1, backgroundColor: colors.white },
  big: { marginTop: 4, fontSize: 28 },
  list: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  section: { fontSize: 12, letterSpacing: em(12, 0.06), color: colors.muted },
  receipt: { marginTop: 8 },
  pdf: { marginTop: 8, height: 44, alignItems: "flex-end", justifyContent: "center" },
  empty: { borderRadius: 16, backgroundColor: colors.white, padding: 20 },
  rows: { marginTop: 8, borderRadius: 16, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  tile: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  amounts: { alignItems: "flex-end" },
});
