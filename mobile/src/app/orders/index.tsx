import { router } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { appApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { OrderBadge, orderWhen, SubScreen } from "@/site/screen";
import { Button, mono } from "@/site/ui";
import { colors, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

/** "Mening buyurtmalarim" (saytdagi `/buyurtmalar`, `OrderList`) */
export default function Orders() {
  const o = copy.orders;
  const data = useLoad(useCallback(() => appApi.orders(), []), true, "orders");
  const orders = data.data?.orders ?? [];
  return (
    <SubScreen title={o.title} back={o.back} refreshing={data.refreshing} onRefresh={() => void data.reload()}>
      {data.loading ? (
        <Loading />
      ) : data.error && !data.data ? (
        <Failed error={data.error} onRetry={() => void data.reload()} />
      ) : orders.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="clock" size={32} color={colors.placeholder} />
          <Txt style={[font(700), { fontSize: 17 }]}>{o.empty}</Txt>
          <Txt style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>{o.emptyHint}</Txt>
          <Button variant="outline-soft" size="sm" onPress={() => router.replace("/deals")}>
            {o.browse}
          </Button>
        </View>
      ) : (
        <View style={styles.list}>
          {orders.map((x) => (
            <Press key={x.id} onPress={() => router.push(`/orders/${x.id}`)} accessibilityRole="link" scale={0.99} style={styles.row}>
              <View style={styles.flex1}>
                <Txt style={{ fontSize: 13, color: colors.muted }}>{x.businessName}</Txt>
                <Txt numberOfLines={1} style={[font(700), { fontSize: 16 }]}>
                  {x.title} × {x.quantity}
                </Txt>
                <Txt style={[mono(), { fontSize: 13 }]}>{orderWhen(x.slotStart, x.slotEnd, x.kind)}</Txt>
              </View>
              <OrderBadge status={x.status} />
            </Press>
          ))}
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0, gap: 2 },
  empty: { alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 24, paddingVertical: 40 },
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 14 },
});
