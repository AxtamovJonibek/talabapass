import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appApi, type CouponView } from "@/api/endpoints";
import { copy } from "@/copy";
import { cachedCoupons } from "@/lib/offline";
import { useLoad } from "@/lib/use-load";
import { colors } from "@/theme";
import { CouponPanel } from "@/student/coupon-panel";
import { Empty, Failed, Loading, RoundButton } from "@/ui/app";
import { Title } from "@/ui/kit";

/** Bitta kupon (kupon olingandan keyin shu ochiladi): avval qurilmadagi nusxa (internetsiz ham), bo'lmasa server. */
async function loadCoupon(id: string): Promise<CouponView | null> {
  const cached = (await cachedCoupons()).find((c) => c.id === id);
  if (cached) return cached;
  const state = await appApi.coupon(id);
  return state.status === "ACTIVE" ? state.coupon : null;
}

export default function CouponScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const coupon = useLoad(useCallback(() => loadCoupon(id), [id]));
  const c = copy.coupon;

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <View style={styles.top}>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/coupon"))} />
        <Title text={c.title} size={30} style={styles.title} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {coupon.loading ? (
          <Loading />
        ) : coupon.error ? (
          <Failed error={coupon.error} onRetry={() => void coupon.reload()} />
        ) : coupon.data ? (
          <CouponPanel coupon={coupon.data} />
        ) : (
          <Empty icon="ticket" title={c.expiredTitle} text={c.expiredText} action={{ label: c.toDeals, onPress: () => router.navigate("/deals") }} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  title: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 16 },
});
