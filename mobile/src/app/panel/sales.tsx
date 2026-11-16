import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { bizApi, type Period, type Sales as SalesData } from "@/api/business";
import { PeriodChips, SaleItem, som } from "@/business/ui";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { useApp } from "@/state";
import { colors, font } from "@/theme";
import { Card, Chip, Empty, Failed, Loading, ScreenHeader, SecondaryButton, TabScreen } from "@/ui/app";
import { Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

/**
 * Sotuvlar (saytdagi `/biznes/sotuvlar`): davr, jami, chek bilan ro'yxat (25 tadan, "Yana yuklash"). Egasi — hammasi yoki
 * xodim bo'yicha filtr; kassir — faqat o'zi tasdiqlaganlari (server cheklaydi).
 */
export default function Sales() {
  const sl = copy.biz.sales;
  const { me } = useApp();
  const owner = me?.role === "BUSINESS_OWNER";
  const [period, setPeriod] = useState<Period>(1);
  const [cashier, setCashier] = useState<string | null>(null);
  const [extra, setExtra] = useState<SalesData["rows"]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const sales = useLoad(
    useCallback(() => {
      setExtra([]);
      setPage(1);
      return bizApi.sales(period, 1, cashier);
    }, [period, cashier]),
    true,
    `biz.sales.${period}.${cashier ?? "all"}`,
  );
  const { refresh } = sales;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const loadMore = async () => {
    if (more || !sales.data || page >= sales.data.pages) return;
    setMore(true);
    try {
      const next = await bizApi.sales(period, page + 1, cashier);
      setExtra((rows) => [...rows, ...next.rows]);
      setPage(next.page);
    } catch {
      // Keyingi bosishda qayta uriniladi
    } finally {
      setMore(false);
    }
  };

  const d = sales.data;
  const rows = d ? [...d.rows, ...extra] : [];

  return (
    <TabScreen>
      <ScreenHeader title={sl.title} />
      <PeriodChips value={period} onChange={setPeriod} style={styles.chips} />
      {owner && d?.staff && d.staff.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, styles.staff]}>
          <Chip selected={cashier === null} onPress={() => setCashier(null)}>
            {sl.everyone}
          </Chip>
          {d.staff.map((s) => (
            <Chip key={s.id} selected={cashier === s.id} onPress={() => setCashier(s.id)}>
              {s.id === me?.id ? sl.me : s.name}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      {sales.loading ? (
        <Loading />
      ) : !d ? (
        <Failed error={sales.error ?? copy.unknownError} onRetry={() => void sales.reload()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={sales.refreshing} onRefresh={() => void sales.reload()} tintColor={colors.orange} />}
          ListHeaderComponent={
            <Card style={styles.summary}>
              <Txt style={[font(900, 62), { fontSize: 34 }]}>{som(d.sum)}</Txt>
              <Txt style={styles.muted}>{owner ? sl.summary(d.count, som(d.sum)) : `${sl.cashierOnly} · ${sl.summary(d.count, som(d.sum))}`}</Txt>
              <StaleNote at={sales.staleAt} />
            </Card>
          }
          ListEmptyComponent={<Empty icon="receipt" title={sl.empty} text={sl.emptyText} />}
          renderItem={({ item, index }) => (
            <View style={[styles.row, index === 0 ? styles.first : null, index === rows.length - 1 ? styles.last : null]}>
              <SaleItem sale={item} showCashier={owner} last={index === rows.length - 1} onPress={() => router.push(`/receipt/${item.id}`)} />
            </View>
          )}
          ListFooterComponent={
            page < d.pages ? (
              <SecondaryButton onPress={() => void loadMore()} disabled={more} style={styles.more}>
                {sl.more}
              </SecondaryButton>
            ) : undefined
          }
        />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  chips: { marginTop: 14 },
  staff: { marginTop: 8 },
  content: { paddingHorizontal: 24, paddingBottom: 28, paddingTop: 16 },
  summary: { padding: 18, marginBottom: 12, gap: 2 },
  muted: { fontSize: 13, color: colors.muted2 },
  row: { backgroundColor: colors.white, paddingHorizontal: 16 },
  first: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 4 },
  last: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 4 },
  more: { marginTop: 14 },
});
