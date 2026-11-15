import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { errorText, isNetworkError } from "@/api/client";
import { appApi, type CouponView } from "@/api/endpoints";
import { copy } from "@/copy";
import { clock } from "@/lib/format";
import { cachedCoupons, onCouponsChange, replaceCoupons } from "@/lib/offline";
import { colors, font } from "@/theme";
import { CouponPanel } from "@/student/coupon-panel";
import { Empty, Loading, PctBadge, ScreenHeader, TabScreen } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { ErrorBox, Press, Txt } from "@/ui/kit";

/**
 * Kupon: faol kuponlar — qurilmadagi nusxadan darhol (internetsiz ham), so'ng `GET /coupons` bilan almashtiriladi.
 * Bitta bo'lsa — chipta shu yerda (saytdagi `/kuponlar` → bitta faol bo'lsa o'shanga), bir nechta — ro'yxat.
 */
export default function CouponTab() {
  const c = copy.coupon;
  const [list, setList] = useState<CouponView[] | null>(null);
  // Ko'rsatilayotgan yagona kupon: sotilgach/eskirgach nusxadan o'chadi, lekin yakuniy holati (sotildi) ko'rinib tursin
  const [last, setLast] = useState<CouponView | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apply = (next: CouponView[]) => {
      setList(next);
      if (next.length === 1) setLast(next[0]!);
    };
    void cachedCoupons().then(apply);
    return onCouponsChange(apply);
  }, []);

  const sync = useCallback(async () => {
    try {
      const { coupons } = await appApi.coupons();
      await replaceCoupons(coupons);
      setError(null);
    } catch (e) {
      // Internet yo'q — qurilmadagi nusxa ko'rinib turadi, xato emas
      setError(isNetworkError(e) ? null : errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void sync();
      return () => setLast(null);
    }, [sync]),
  );

  const single = list?.length === 1 ? list[0]! : list?.length === 0 ? last : null;

  const reload = async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  };

  return (
    <TabScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      >
        <ScreenHeader title={list && list.length > 1 ? c.listTitle : c.title} style={styles.header} />
        <View style={styles.pad}>
          <ErrorBox>{error}</ErrorBox>
          {list === null ? (
            <Loading />
          ) : single ? (
            <CouponPanel key={single.id} coupon={single} />
          ) : list.length === 0 ? (
            <Empty icon="ticket" title={c.emptyTitle} text={c.emptyText} action={{ label: c.toDeals, onPress: () => router.navigate("/deals") }} />
          ) : (
            list.map((coupon) => (
              <Press key={coupon.id} onPress={() => router.push(`/coupon/${coupon.id}`)} accessibilityRole="button" scale={0.98} style={styles.row}>
                <View style={styles.flex1}>
                  <Txt numberOfLines={1} style={[font(700), { fontSize: 13, color: colors.muted }]}>
                    {coupon.store}
                  </Txt>
                  <Txt numberOfLines={1} style={[font(800), { fontSize: 18, marginTop: 2 }]}>
                    {coupon.title}
                  </Txt>
                  <Txt style={[font(700), { fontSize: 13, color: colors.blue, marginTop: 4 }]}>{c.until(clock(coupon.expiresAt))}</Txt>
                </View>
                <PctBadge size={28}>{coupon.badge}</PctBadge>
                <Icon name="chevronRight" size={20} color={colors.muted2} strokeWidth={2.4} />
              </Press>
            ))
          )}
        </View>
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  content: { paddingBottom: 28 },
  header: { marginBottom: 14 },
  pad: { paddingHorizontal: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 10 },
});
