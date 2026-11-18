import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, errorText } from "@/api/client";
import { bizApi, type Period } from "@/api/business";
import { copy } from "@/copy";
import { formatSom } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { PERIOD_OPTIONS, SalesTable, Segmented } from "@/site/stats";
import { BackText } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Press, Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

/**
 * "Sotuvlar va cheklar" — saytdagi `/biznes/sotuvlar` telefon ko'rinishi: "← Orqaga", jami, davr, jadval (sana, vaqt,
 * chek, talaba, mahsulot, kassir, to'landi, PDF), sahifalar. PDF — chekning imzoli havolasi.
 */
export default function Sales() {
  const t = copy.biz.stats;
  const p = t.salesPage;
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>(30);
  const [page, setPage] = useState(1);
  const sales = useLoad(useCallback(() => bizApi.sales(period, page), [period, page]), true, `biz.sales.${period}.${page}`);
  const { refresh } = sales;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const openPdf = (id: string) =>
    void bizApi.receipt(id).then(
      ({ pdfUrl }) => Linking.openURL(pdfUrl.startsWith("http") ? pdfUrl : `${API_URL}${pdfUrl}`),
      (e: unknown) => Alert.alert(errorText(e)),
    );

  const d = sales.data;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 56 }]}
      refreshControl={<RefreshControl refreshing={sales.refreshing} onRefresh={() => void sales.reload()} tintColor={colors.orange} />}
    >
      <BackText label={copy.back} onPress={() => router.navigate("/panel/stats")} style={styles.back} />
      <View style={styles.header}>
        <View>
          <Txt testID="sales-summary" style={{ fontSize: 13, color: colors.muted }}>
            {p.summary(formatSom(d?.count ?? 0), formatSom(d?.sum ?? 0))}
          </Txt>
          <Txt accessibilityRole="header" style={[font(900, 112), styles.title]}>
            {p.title}
          </Txt>
        </View>
        <Segmented
          options={PERIOD_OPTIONS.map((x) => ({ value: x, label: t.period[x] ?? "" }))}
          value={period}
          onChange={(x) => {
            setPeriod(x);
            setPage(1);
          }}
        />
      </View>
      <StaleNote at={sales.staleAt} />
      <View style={styles.card}>
        {!d ? (
          sales.loading ? (
            <Loading />
          ) : (
            <Failed error={sales.error ?? copy.unknownError} onRetry={() => void sales.reload()} />
          )
        ) : d.rows.length === 0 ? (
          <Txt style={{ fontSize: 13, color: colors.muted }}>{t.noSales}</Txt>
        ) : (
          <SalesTable withDate pdf={openPdf} sales={d.rows} />
        )}
        {d && d.pages > 1 ? (
          <View style={styles.pager}>
            {d.page > 1 ? (
              <Press onPress={() => setPage(d.page - 1)} accessibilityRole="link" scale={0.96} style={[styles.pagerBtn, { borderColor: colors.line }]}>
                <Txt style={[font(700), { fontSize: 14 }]}>{p.prev}</Txt>
              </Press>
            ) : (
              <View />
            )}
            <Txt style={{ fontSize: 13, color: colors.muted }}>{p.page(d.page, d.pages)}</Txt>
            {d.page < d.pages ? (
              <Press onPress={() => setPage(d.page + 1)} accessibilityRole="link" scale={0.96} style={[styles.pagerBtn, { borderColor: colors.ink }]}>
                <Txt style={[font(700), { fontSize: 14 }]}>{p.next}</Txt>
              </Press>
            ) : (
              <View />
            )}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  // saytda `-mb-2 self-start`
  back: { alignSelf: "flex-start", marginBottom: -8 },
  header: { gap: 14 },
  title: { marginTop: 4, fontSize: 28, lineHeight: 28, letterSpacing: em(28, -0.035) },
  card: { minWidth: 0, borderRadius: 18, backgroundColor: colors.white, padding: 20 },
  pager: { marginTop: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pagerBtn: { height: 44, justifyContent: "center", borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16 },
});
