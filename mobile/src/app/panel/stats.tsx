import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/api/client";
import { bizApi, type Period } from "@/api/business";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { CashierBars, dateLine, Funnel, Heatmap, Kpis, OffersTable, PERIOD_OPTIONS, RecentSales, SalesChart, Segmented, Universities } from "@/site/stats";
import { Button } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

/**
 * B6 — biznes statistikasi, saytdagi `/biznes` ning telefon ko'rinishi (`StatsScreen` phone): sana, "Statistika", davr
 * tanlovi va Excel hisobot, KPI kartalar, grafik, voronka, issiqlik xaritasi, universitetlar, chegirmalar jadvali,
 * oxirgi sotuvlar, kassirlar. Ekranga qaytganda yangilanadi (saytdagi `LiveRefresh`).
 */
export default function Stats() {
  const t = copy.biz.stats;
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>(30);
  const stats = useLoad(useCallback(() => bizApi.stats(period), [period]), true, `biz.stats.${period}`);
  const { refresh } = stats;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const d = stats.data;
  const report = d?.reportUrl;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 56 }]}
      refreshControl={<RefreshControl refreshing={stats.refreshing} onRefresh={() => void stats.reload()} tintColor={colors.orange} />}
    >
      <View style={styles.header}>
        <View>
          <Txt style={{ fontSize: 13, color: colors.muted }}>{dateLine(new Date())}</Txt>
          <Txt accessibilityRole="header" style={[font(900, 112), styles.title]}>
            {t.title}
          </Txt>
        </View>
        <View style={styles.tools}>
          <Segmented options={PERIOD_OPTIONS.map((p) => ({ value: p, label: t.period[p] ?? "" }))} value={period} onChange={setPeriod} />
          <Button
            variant="outline"
            size="sm"
            icon="download"
            iconSize={16}
            disabled={!report}
            onPress={() => report && void Linking.openURL(report.startsWith("http") ? report : `${API_URL}${report}`)}
          >
            {t.excel}
          </Button>
        </View>
      </View>
      <StaleNote at={stats.staleAt} />

      {stats.loading && !d ? (
        <Loading />
      ) : !d ? (
        <Failed error={stats.error ?? copy.unknownError} onRetry={() => void stats.reload()} />
      ) : (
        <>
          <Kpis stats={d} />
          <View style={styles.stack}>
            <SalesChart stats={d} />
            <Funnel stats={d} />
          </View>
          <View style={styles.stack}>
            <Heatmap stats={d} />
            <Universities stats={d} />
          </View>
          <OffersTable stats={d} />
          <View style={styles.stack}>
            <RecentSales stats={d} />
            <CashierBars stats={d} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  // Saytda sarlavha va tugmalar `flex-wrap` — telefonda doim ikki qator
  header: { gap: 14 },
  title: { marginTop: 4, fontSize: 28, lineHeight: 28, letterSpacing: em(28, -0.035) },
  tools: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  stack: { gap: 10 },
});
