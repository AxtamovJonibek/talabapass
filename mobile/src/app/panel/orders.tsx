import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, errorText } from "@/api/client";
import { bizApi, type BusinessOrder, type OrderFilter } from "@/api/business";
import { useOrdersWatch } from "@/business/orders-watch";
import { copy } from "@/copy";
import { formatSom } from "@/lib/format";
import { displayPhone, localDigits } from "@/lib/phone";
import { useLoad } from "@/lib/use-load";
import { SiteSwitch } from "@/site/business";
import { OrderBadge, orderWhen } from "@/site/screen";
import { Segmented } from "@/site/stats";
import { Button, mono, SiteField, SiteInput } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { KEYBOARD_GAP, Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

const FILTERS: OrderFilter[] = ["new", "preparing", "ready", "done"];
/** Saytdagidek: ochiq panel 5 soniyada yangilanadi */
const POLL_MS = 5_000;

/**
 * Buyurtmalar — saytdagi `/biznes/buyurtmalar` (`OrdersBoard`) telefon ko'rinishi: sarlavha va "Sozlamalar", bugungi
 * hisobot (4 karta), filtrlar (sonlari bilan), "Ovozli signal", jonli ro'yxat; kartada vaqt, nima × nechta, tur · talaba ·
 * telefon, izoh, to'lov, javob muddati, Qabul / Rad etish (sabab) / Tayyor. Yangi buyurtma signali — `OrdersWatch`.
 */
export default function Orders() {
  const o = copy.biz.orders;
  const insets = useSafeAreaInsets();
  const watch = useOrdersWatch();
  const [filter, setFilter] = useState<OrderFilter>("new");
  const orders = useLoad(useCallback(() => bizApi.orders(filter), [filter]), true, `biz.orders.${filter}`);
  const { refresh } = orders;

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const poll = setInterval(() => void refresh(), POLL_MS);
      return () => clearInterval(poll);
    }, [refresh]),
  );

  const d = orders.data;
  const r = d?.report;
  const report = r
    ? ([
        ["orders", String(r.orders)],
        ["revenue", formatSom(r.revenue)],
        ["cancelled", String(r.cancelled)],
        ["noShow", String(r.noShow)],
      ] as const)
    : [];

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28 }]}
      bottomOffset={KEYBOARD_GAP}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={() => void orders.reload()} tintColor={colors.orange} />}
    >
      <View style={styles.head}>
        <Txt accessibilityRole="header" style={[font(900, 110), styles.title]}>
          {o.title}
        </Txt>
        <Button variant="outline-soft" size="sm" onPress={() => router.push("/panel/settings")}>
          {o.settingsShort}
        </Button>
      </View>
      <StaleNote at={orders.staleAt} />

      {!d ? (
        orders.loading ? (
          <Loading />
        ) : (
          <Failed error={orders.error ?? copy.unknownError} onRetry={() => void orders.reload()} />
        )
      ) : (
        <View style={styles.board}>
          <View testID="orders-report" style={styles.report}>
            {report.map(([key, value]) => (
              <View key={key} style={styles.reportCard}>
                <Txt style={{ fontSize: 12, color: colors.muted }}>{`${o.report} · ${o.reportKeys[key]}`}</Txt>
                <Txt style={[mono(600), { fontSize: 22 }]}>{value}</Txt>
              </View>
            ))}
          </View>

          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
              <Segmented
                value={filter}
                onChange={setFilter}
                options={FILTERS.map((f) => ({
                  value: f,
                  label: o.filters[f] ?? f,
                  badge:
                    f !== "done" && d.counts[f] > 0 ? (
                      <View testID={`count-${f}`} style={[styles.count, { backgroundColor: f === "new" ? colors.orange : colors.ink }]}>
                        <Txt style={[mono(), { fontSize: 11, lineHeight: 20, color: f === "new" ? colors.ink : colors.white }]}>{d.counts[f]}</Txt>
                      </View>
                    ) : undefined,
                }))}
              />
            </ScrollView>
            <View style={styles.sound}>
              <SiteSwitch small checked={watch.sound} onChange={watch.setSound} label={o.sound} />
              <Txt style={[font(600), { fontSize: 13, color: colors.muted }]}>{o.sound}</Txt>
            </View>
          </View>
          <Txt style={[mono(), styles.live]}>{o.live.toUpperCase()}</Txt>

          {d.orders.length === 0 ? (
            <View style={styles.empty}>
              <Txt style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>{o.empty[filter]}</Txt>
            </View>
          ) : (
            <View testID="orders-list" style={{ gap: 12 }}>
              {d.orders.map((x) => (
                <OrderCard
                  key={`${filter}:${x.id}`}
                  order={x}
                  now={d.now}
                  onChanged={() => {
                    void refresh();
                    watch.refresh();
                  }}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

function OrderCard({ order: x, now, onChanged }: { order: BusinessOrder; now: number; onChanged: () => void }) {
  const o = copy.biz.orders;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const decide = async (decision: "accept" | "reject" | "ready") => {
    if (busy) return;
    setError(null);
    if (decision === "reject" && !reason.trim()) return setError(o.reasonRequired);
    setBusy(true);
    try {
      await bizApi.decideOrder(x.id, decision, decision === "reject" ? reason.trim() : undefined);
      setRejecting(false);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError && e.fields.includes("reason") ? o.reasonRequired : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const minutesLeft = x.confirmBy ? Math.max(0, Math.ceil((Date.parse(x.confirmBy) - now) / 60_000)) : null;
  const pair = (action: "accept" | "ready") => (
    <View style={styles.pair}>
      <Button variant="outline-soft" size="sm" onPress={() => setRejecting(true)}>
        {o.reject}
      </Button>
      <Button variant={action === "accept" ? "orange" : "ink"} size="sm" busy={busy} disabled={busy} block onPress={() => void decide(action)} style={styles.flex1}>
        {action === "accept" ? o.accept : o.ready}
      </Button>
    </View>
  );

  return (
    <View testID="order-card" style={styles.card}>
      <View style={[styles.row, { alignItems: "flex-start", justifyContent: "space-between", gap: 12 }]}>
        <View style={[styles.flex1, { gap: 2 }]}>
          <Txt style={[mono(600), { fontSize: 14 }]}>{orderWhen(x.slotStart, x.slotEnd, x.kind)}</Txt>
          <Txt style={[font(800), { fontSize: 18 }]}>{`${x.title} × ${x.quantity}`}</Txt>
          <Txt style={{ fontSize: 13, color: colors.muted }}>
            {`${x.mode ? o.modes[x.mode] : o.kindShort[x.kind]} · ${x.student} · `}
            <Txt onPress={() => void Linking.openURL(`tel:${x.phone}`)} style={[mono(), { fontSize: 13, color: colors.muted }]}>
              {displayPhone(localDigits(x.phone))}
            </Txt>
          </Txt>
        </View>
        <OrderBadge status={x.status} />
      </View>
      {x.note ? <Txt style={styles.note}>{x.note}</Txt> : null}
      <View style={[styles.row, { flexWrap: "wrap", columnGap: 12 }]}>
        {x.prepay === "NONE" ? (
          <Txt style={[mono(), { fontSize: 13 }]}>{o.noPrepay}</Txt>
        ) : (
          <Txt style={[mono(), { fontSize: 13, color: colors.greenSite }]}>{o.prepaidSom(formatSom(x.prepayAmount))}</Txt>
        )}
        {x.totalFinal > x.prepayAmount ? <Txt style={[mono(), { fontSize: 13 }]}>{o.dueSom(formatSom(x.totalFinal - x.prepayAmount))}</Txt> : null}
      </View>
      {x.status === "PAID" && minutesLeft !== null ? <Txt style={[font(700), { fontSize: 13, color: colors.warn }]}>{o.respondMin(minutesLeft)}</Txt> : null}
      {x.rejectReason ? <Txt style={{ fontSize: 13, color: colors.muted }}>{x.rejectReason}</Txt> : null}

      {rejecting ? (
        <View style={{ gap: 8 }}>
          <SiteField label={o.rejectReason}>
            <SiteInput multiline numberOfLines={2} maxLength={150} placeholder={o.rejectPlaceholder} value={reason} onChangeText={setReason} style={styles.textarea} autoFocus />
          </SiteField>
          <View style={styles.pair}>
            <Button variant="outline-soft" size="sm" block onPress={() => setRejecting(false)} style={styles.flex1}>
              {o.cancelReject}
            </Button>
            <Button variant="danger-outline" size="sm" block busy={busy} disabled={busy} onPress={() => void decide("reject")} style={styles.flex1}>
              {o.reject}
            </Button>
          </View>
        </View>
      ) : x.status === "PAID" ? (
        pair("accept")
      ) : x.status === "CONFIRMED" ? (
        pair("ready")
      ) : null}
      {error ? (
        <Txt accessibilityRole="alert" style={[font(600), { fontSize: 13, color: colors.danger }]}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row" },
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 30, lineHeight: 30, letterSpacing: em(30, -0.03) },
  board: { gap: 16 },
  report: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reportCard: { flexGrow: 1, flexBasis: 140, gap: 4, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 12 },
  filters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  // Saytdagidek: filtrlar ekran chetigacha suriladi (-mx-4 px-4)
  filterScroll: { marginHorizontal: -16, flexGrow: 0, maxWidth: "110%" },
  count: { minWidth: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center" },
  sound: { flexDirection: "row", alignItems: "center", gap: 8 },
  live: { marginTop: -8, fontSize: 11, letterSpacing: em(11, 0.08), color: colors.muted },
  empty: { borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 20, paddingVertical: 40 },
  card: { gap: 12, borderRadius: 18, backgroundColor: colors.white, padding: 16 },
  note: { borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  pair: { flexDirection: "row", gap: 8 },
  textarea: { height: 64, paddingTop: 10, textAlignVertical: "top" },
});
