import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { appApi, type CouponView } from "@/api/endpoints";
import { copy } from "@/copy";
import { cachedCoupons } from "@/lib/offline";
import { useLoad } from "@/lib/use-load";
import { Button } from "@/site/ui";
import { colors, font } from "@/theme";
import { CouponScreen } from "@/student/coupon-panel";
import { Failed, Loading } from "@/ui/app";
import { Txt } from "@/ui/kit";

/** Bitta kupon (T6): avval qurilmadagi nusxa (internetsiz ham), bo'lmasa server; sotilgan bo'lsa — chekka. */
async function loadCoupon(id: string): Promise<CouponView | null> {
  const cached = (await cachedCoupons()).find((c) => c.id === id);
  if (cached) return cached;
  const state = await appApi.coupon(id);
  if (state.status === "REDEEMED") {
    router.replace(state.redemptionId ? `/history?chek=${state.redemptionId}` : "/history");
    return null;
  }
  return state.status === "ACTIVE" ? state.coupon : null;
}

export default function CouponPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const coupon = useLoad(useCallback(() => loadCoupon(id), [id]));
  const c = copy.coupon;
  if (coupon.data) return <CouponScreen key={coupon.data.id} coupon={coupon.data} />;
  return (
    <View style={styles.root}>
      {coupon.loading ? (
        <Loading />
      ) : coupon.error ? (
        <Failed error={coupon.error} onRetry={() => void coupon.reload()} />
      ) : (
        <View style={styles.gone}>
          <Txt style={[font(700), { fontSize: 18, color: colors.paper }]}>{c.expiredTitle}</Txt>
          <Txt style={{ fontSize: 14, lineHeight: 20, color: colors.fog0 }}>{c.expiredText}</Txt>
          <Button variant="blue" size="md" onPress={() => router.navigate("/deals")}>
            {c.toDeals}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, justifyContent: "center" },
  gone: { marginHorizontal: 20, gap: 12, borderRadius: 22, backgroundColor: colors.ink2, padding: 20 },
});
