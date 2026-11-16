import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { bizApi, type Period } from "@/api/business";
import { Banner, Bars, HBar, Kpi, PeriodChips, SaleItem, Section, som } from "@/business/ui";
import { useOrdersWatch } from "@/business/orders-watch";
import { copy } from "@/copy";
import { formatSom } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { colors, font } from "@/theme";
import { Card, Empty, Failed, Loading, RoundButton, ScreenHeader, TabScreen } from "@/ui/app";
import { Rich, Txt } from "@/ui/kit";

/**
 * Statistika (saytdagi B6 mazmuni): davr (bugun / 7 / 30 kun), sotuvlar (+ oldingi davrga), tushum va o'rtacha chek,
 * berilgan chegirma, yangi va qayta kelgan mijozlar, grafik (bugun — soatlar, aks holda kunlar), voronka, eng gavjum
 * vaqt, universitetlar, chegirmalar samaradorligi, oxirgi sotuvlar. Oldindan buyurtma yoqilgan bo'lsa — buyurtmalar banneri.
 */
export default function Stats() {
  const s = copy.biz.stats;
  const [period, setPeriod] = useState<Period>(7);
  const stats = useLoad(useCallback(() => bizApi.stats(period), [period]));
  const orders = useOrdersWatch();
  const { refresh } = stats;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const d = stats.data;
  const barLabel = (key: string) => (d?.chart.hourly ? `${key}:00` : `${key.slice(8, 10)}.${key.slice(5, 7)}`);
  const delta = d?.kpi.delta;
  const deltaText = delta ? (delta.kind === "abs" ? s.deltaDay(delta.value) : s.deltaPct(delta.value)) : null;

  return (
    <TabScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={stats.refreshing} onRefresh={() => void stats.reload()} tintColor={colors.orange} />}
      >
        <ScreenHeader title={s.title} right={<RoundButton icon="bell" label={copy.biz.profile.notifications} onPress={() => router.push("/notifications")} />} />
        <Txt numberOfLines={1} style={styles.business}>
          {d?.business.name ?? ""}
        </Txt>
        <PeriodChips value={period} onChange={setPeriod} style={styles.chips} />

        <View style={styles.pad}>
          {orders.enabled || orders.waiting > 0 ? (
            <View style={styles.banner}>
              <Banner icon="bag" hot={orders.waiting > 0} title={s.orders} text={s.ordersNew(orders.waiting)} onPress={() => router.push("/biz/orders")} />
            </View>
          ) : null}

          {stats.loading ? (
            <Loading />
          ) : !d ? (
            <Failed error={stats.error ?? copy.unknownError} onRetry={() => void stats.reload()} />
          ) : (
            <>
              <View style={styles.grid}>
                <Kpi dark label={s.sold} value={String(d.kpi.sold)} note={deltaText} tone={delta ? (delta.value >= 0 ? "up" : "down") : undefined} />
                <Kpi label={s.revenue} value={formatSom(d.kpi.revenue)} note={d.kpi.sold > 0 ? s.average(som(d.kpi.average)) : copy.currency} />
                <Kpi label={s.given} value={formatSom(d.kpi.discount)} note={copy.currency} />
                <Kpi label={s.fresh} value={String(d.kpi.fresh)} note={s.freshNote} />
                <Kpi label={s.returning} value={`${d.kpi.returningPercent}%`} />
              </View>

              <Section title={s.chart[period] ?? ""}>
                <Card style={styles.cardPad}>
                  <Bars bars={d.chart.bars} label={barLabel} />
                </Card>
              </Section>

              <Section title={s.funnel}>
                <Card style={[styles.cardPad, styles.gap14]}>
                  <HBar label={s.views} count={d.funnel.views} max={d.funnel.views} />
                  <HBar label={s.qr} count={d.funnel.qr} max={d.funnel.views} />
                  <HBar label={s.bought} count={d.funnel.sold} max={d.funnel.views} accent />
                  {d.funnel.qr > d.funnel.sold ? <Txt style={styles.note}>{s.lost(d.funnel.qr - d.funnel.sold)}</Txt> : null}
                  {d.heat.busiest ? <Rich style={styles.note} text={s.busiest(copy.weekdays[d.heat.busiest.weekday] ?? "", d.heat.busiest.from, d.heat.busiest.to)} /> : null}
                  {d.heat.quietest !== null ? <Txt style={styles.note}>{s.quietest(copy.weekdays[d.heat.quietest] ?? "")}</Txt> : null}
                </Card>
              </Section>

              {d.universities.length > 0 ? (
                <Section title={s.universities}>
                  <Card style={[styles.cardPad, styles.gap14]}>
                    {d.universities.map((u) => (
                      <HBar key={u.name || "rest"} label={u.name || s.others} count={u.count} max={d.universities[0]?.count ?? 1} />
                    ))}
                  </Card>
                </Section>
              ) : null}

              {d.offers.length > 0 ? (
                <Section title={s.offers}>
                  <Card style={styles.cardPad}>
                    {d.offers.map((o, i) => (
                      <View key={o.id} style={[styles.offer, i < d.offers.length - 1 ? styles.rowLine : null]}>
                        <Txt numberOfLines={1} style={[font(800), styles.offerTitle]}>
                          {o.title}
                        </Txt>
                        <Txt style={styles.offerLine}>
                          {s.offerLine(o.views, o.qr, o.sold)}
                          {o.revenue > 0 ? ` · ${som(o.revenue)}` : ""}
                        </Txt>
                      </View>
                    ))}
                  </Card>
                </Section>
              ) : null}

              <Section title={s.recent} action={d.sales.length > 0 ? { label: s.allSales, onPress: () => router.navigate("/panel/sales") } : undefined}>
                {d.sales.length === 0 ? (
                  <Empty icon="receipt" title={s.empty} text={s.emptyText} style={styles.empty} />
                ) : (
                  <Card style={styles.listPad}>
                    {d.sales.map((sale, i) => (
                      <SaleItem key={sale.id} sale={sale} last={i === d.sales.length - 1} onPress={() => router.push(`/receipt/${sale.id}`)} />
                    ))}
                  </Card>
                )}
              </Section>

              {d.cashiers.rows.length > 0 || d.cashiers.rejected > 0 ? (
                <Section title={s.cashiers}>
                  <Card style={[styles.cardPad, styles.gap14]}>
                    {d.cashiers.rows.map((c) => (
                      <HBar key={c.name} label={c.name} count={c.count} max={d.cashiers.rows[0]?.count ?? 1} />
                    ))}
                    {d.cashiers.rejected > 0 ? <Txt style={styles.note}>{s.rejected(d.cashiers.rejected)}</Txt> : null}
                  </Card>
                </Section>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  pad: { paddingHorizontal: 24 },
  business: { fontSize: 14, color: colors.muted2, paddingHorizontal: 24, marginTop: 2 },
  chips: { marginTop: 14 },
  banner: { marginTop: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  cardPad: { padding: 16 },
  listPad: { paddingHorizontal: 16, paddingVertical: 4 },
  gap14: { gap: 14 },
  note: { fontSize: 13, lineHeight: 19, color: colors.muted },
  offer: { paddingVertical: 10, gap: 2 },
  offerTitle: { fontSize: 15 },
  offerLine: { fontSize: 13, color: colors.muted2 },
  rowLine: { borderBottomWidth: 1.5, borderBottomColor: colors.lineSoft },
  empty: { marginTop: 0 },
});
