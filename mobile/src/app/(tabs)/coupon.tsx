import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText, isNetworkError } from "@/api/client";
import { appApi, type CouponView } from "@/api/endpoints";
import { copy } from "@/copy";
import { clock } from "@/lib/format";
import { cachedCoupons, onCouponsChange, replaceCoupons } from "@/lib/offline";
import { Button, mono } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Loading } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { ErrorBox, Press, Txt } from "@/ui/kit";

/**
 * "Kuponlar" — saytdagi `/kuponlar` (`CouponList`): bitta faol kupon bo'lsa — darhol uning QR ekrani (T6, `/coupon/<id>`),
 * bir nechta — ro'yxat, yo'q — bo'sh chipta. Faol kuponlar avval qurilmadagi nusxadan (internetsiz ham), so'ng
 * `GET /coupons` bilan almashtiriladi.
 */
export default function CouponTab() {
  const c = copy.coupon;
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<CouponView[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  // Avtomatik ochilgan kupon: undan "orqaga" qaytilsa tab ro'yxat/bo'sh holatda qoladi (qayta ochilmaydi)
  const opened = useRef<string | null>(null);

  useEffect(() => {
    void cachedCoupons().then(setList);
    return onCouponsChange(setList);
  }, []);

  const sync = useCallback(async () => {
    try {
      const { coupons } = await appApi.coupons();
      await replaceCoupons(coupons);
      setError(null);
      return coupons;
    } catch (e) {
      // Internet yo'q — qurilmadagi nusxa ko'rinib turadi, xato emas
      setError(isNetworkError(e) ? null : errorText(e));
      return null;
    }
  }, []);

  // Saytdagidek: bitta faol kupon — shu kuponning QR ekraniga
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void sync().then(async (fresh) => {
        const coupons = fresh ?? (await cachedCoupons());
        const only = coupons.length === 1 ? coupons[0]! : null;
        if (focused.current && only && opened.current !== only.id) {
          opened.current = only.id;
          router.push(`/coupon/${only.id}`);
        }
      });
      return () => {
        focused.current = false;
      };
    }, [sync]),
  );

  const reload = async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 58 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.blue} colors={[colors.blue]} />}
    >
      <Txt accessibilityRole="header" style={[font(900, 112), styles.title]}>
        {c.listTitle}
      </Txt>
      <ErrorBox>{error}</ErrorBox>
      {list === null ? (
        <Loading />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyTop}>
            <Txt style={[font(800, 108), styles.emptyTitle]}>{c.emptyTitle}</Txt>
            <Txt style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>{c.emptyText}</Txt>
          </View>
          <View importantForAccessibility="no-hide-descendants">
            <View style={styles.dash} />
            <View style={[styles.notch, { left: -11 }]} />
            <View style={[styles.notch, { right: -11 }]} />
          </View>
          <View style={styles.emptyBottom}>
            <Button variant="blue" size="md" block icon="arrowRight" iconSize={20} onPress={() => router.navigate("/deals")} style={styles.cta}>
              {c.toDeals}
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((coupon) => (
            <Press key={coupon.id} onPress={() => router.push(`/coupon/${coupon.id}`)} accessibilityRole="link" scale={0.98} style={styles.row}>
              <View style={styles.badge}>
                <Txt style={[font(900, 70), { fontSize: 17, lineHeight: 17 }]}>{coupon.badge}</Txt>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt numberOfLines={1} style={[font(700), { fontSize: 14 }]}>
                  {coupon.title}
                </Txt>
                <Txt style={{ fontSize: 12, color: colors.muted }}>{coupon.store}</Txt>
              </View>
              <Txt style={[mono(), { fontSize: 12, color: colors.muted }]}>{c.until(clock(coupon.expiresAt))}</Txt>
              <Icon name="chevronRight" size={16} />
            </Press>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 30, letterSpacing: em(30, -0.03) },
  empty: { marginTop: 24, borderRadius: 22, backgroundColor: colors.white },
  emptyTop: { gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  emptyTitle: { fontSize: 22, lineHeight: 23, letterSpacing: em(22, -0.02) },
  dash: { marginHorizontal: 18, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.dash },
  notch: { position: "absolute", top: -10, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper },
  emptyBottom: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  // Saytdagi `size="card" spread`: matn chapda, o'q o'ngda
  cta: { justifyContent: "space-between", flexDirection: "row-reverse" },
  list: { marginTop: 16, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  badge: { borderRadius: 6, backgroundColor: colors.orange, paddingHorizontal: 7, paddingVertical: 4, transform: [{ rotate: "-6deg" }] },
});
