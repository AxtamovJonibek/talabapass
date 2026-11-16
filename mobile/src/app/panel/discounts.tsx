import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Image, RefreshControl, StyleSheet, Switch, View } from "react-native";
import { errorText } from "@/api/client";
import { bizApi, type OwnerDiscount } from "@/api/business";
import { StatusBadge } from "@/business/ui";
import { copy } from "@/copy";
import { discountBadge, discountPriceText } from "@/lib/discount";
import { formatMinute, formatWeekdays } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { colors, em, font } from "@/theme";
import { Empty, Failed, Loading, ScreenHeader, TabScreen, imageUrl } from "@/ui/app";
import { PrimaryButton, Press, Txt } from "@/ui/kit";

/** "2026-12-31" → "31.12.2026" */
const dateText = (iso: string) => iso.split("-").reverse().join(".");

/**
 * Chegirmalar (saytdagi B5 ro'yxati): holat, bugun sotilgani, kun/soat, muddat; faol ↔ to'xtatilgan kaliti (tekshiruvsiz).
 * Karta bosilsa — muharrir; "Yangi chegirma" — bo'sh muharrir.
 */
export default function Discounts() {
  const d = copy.biz.discounts;
  const list = useLoad(useCallback(() => bizApi.discounts(), []));
  const { refresh, setData } = list;
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const toggle = async (item: OwnerDiscount, active: boolean) => {
    if (busy) return;
    setBusy(item.id);
    setData((data) => data && { discounts: data.discounts.map((x) => (x.id === item.id ? { ...x, status: active ? "ACTIVE" : "PAUSED" } : x)) });
    try {
      await bizApi.setDiscountActive(item.id, active);
    } catch (e) {
      Alert.alert(d.toggleFailed, errorText(e));
      void refresh();
    } finally {
      setBusy(null);
    }
  };

  const items = list.data?.discounts ?? [];

  return (
    <TabScreen>
      <ScreenHeader title={d.title} />
      {list.loading ? (
        <Loading />
      ) : !list.data ? (
        <Failed error={list.error ?? copy.unknownError} onRetry={() => void list.reload()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.id}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={colors.orange} />}
          ListHeaderComponent={
            <PrimaryButton tone="orange" icon={null} onPress={() => router.push("/biz/discount/new")} style={styles.add}>
              {`+ ${d.add}`}
            </PrimaryButton>
          }
          ListEmptyComponent={<Empty icon="tag" title={d.empty} text={d.emptyText} />}
          renderItem={({ item }) => {
            const switchable = item.status === "ACTIVE" || item.status === "PAUSED";
            return (
              <Press onPress={() => router.push(`/biz/discount/${item.id}`)} accessibilityRole="button" scale={0.985} style={styles.card}>
                <View style={styles.top}>
                  {item.image ? (
                    <Image source={{ uri: imageUrl(item.image) }} style={styles.thumb} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.thumb, styles.thumbEmpty]}>
                      <Txt style={[font(900, 62), { fontSize: 22 }]}>{discountBadge(item)}</Txt>
                    </View>
                  )}
                  <View style={styles.flex1}>
                    <StatusBadge status={item.status} />
                    <Txt numberOfLines={2} style={[font(800), styles.title]}>
                      {item.title}
                    </Txt>
                    <Txt numberOfLines={1} style={styles.meta}>
                      {discountPriceText(item)}
                    </Txt>
                  </View>
                  {switchable ? (
                    <Switch
                      value={item.status === "ACTIVE"}
                      disabled={busy === item.id}
                      onValueChange={(v) => void toggle(item, v)}
                      trackColor={{ true: colors.green, false: colors.line }}
                      thumbColor={colors.white}
                      accessibilityLabel={item.status === "ACTIVE" ? d.pause : d.resume}
                    />
                  ) : null}
                </View>
                <Txt style={styles.meta}>
                  {`${formatWeekdays(item.weekdays)} · ${formatMinute(item.fromMinute)}–${formatMinute(item.toMinute)} · ${d.endsOn(dateText(item.endsOn))}`}
                </Txt>
                {item.status === "REJECTED" && item.rejectReason ? <Txt style={[font(700), styles.rejected]}>{d.rejected(item.rejectReason)}</Txt> : null}
                {item.status === "ACTIVE" ? <Txt style={[font(700), styles.sold]}>{d.soldToday(item.soldToday, item.dailyLimit)}</Txt> : null}
              </Press>
            );
          }}
        />
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, gap: 4 },
  content: { paddingHorizontal: 24, paddingBottom: 28, gap: 12 },
  add: { marginTop: 16, marginBottom: 4 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 8 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 16 },
  thumbEmpty: { backgroundColor: colors.peach, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, lineHeight: 21, letterSpacing: em(17, -0.01) },
  meta: { fontSize: 13, color: colors.muted2 },
  rejected: { fontSize: 13, color: colors.danger },
  sold: { fontSize: 13, color: colors.greenOk },
});
