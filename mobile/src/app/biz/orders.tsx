import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { bizApi, type BusinessOrder, type OrderFilter } from "@/api/business";
import { useOrdersWatch } from "@/business/orders-watch";
import { som, Tag } from "@/business/ui";
import { copy } from "@/copy";
import { clock, formatWhen, toTashkent } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { colors, font } from "@/theme";
import { Card, Chip, Empty, Failed, Loading, RoundButton, SecondaryButton, Sheet } from "@/ui/app";
import { openSite } from "@/ui/legal";
import { ErrorBox, Field, PrimaryButton, Title, Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

const FILTERS: OrderFilter[] = ["new", "preparing", "ready", "done"];
const POLL_MS = 10_000;

/** Toshkent sanasi "20.11" */
const dayMonth = (at: Date) => {
  const d = toTashkent(at).date;
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** "4:05" — qolgan vaqt (daqiqa:soniya) */
const countdown = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

/**
 * Buyurtmalar (saytdagi `/biznes/buyurtmalar`, faqat egasi): Yangi / Tayyorlanmoqda / Tayyor / Yakunlangan, bugungi hisobot.
 * Yangi (to'langan) buyurtma — "Qabul qilish" yoki "Rad etish" (sabab talabaga ko'rinadi), javob muddati taymeri
 * (`confirmBy`, o'tsa server avtomatik bekor qiladi va pul qaytadi); tasdiqlangan — "Tayyor"; berish — kassada skaner.
 * Ekran ochiq paytda 10 soniyada yangilanadi; yangi buyurtma signali — `OrdersWatch`.
 */
export default function Orders() {
  const o = copy.biz.orders;
  const insets = useSafeAreaInsets();
  const watch = useOrdersWatch();
  const [filter, setFilter] = useState<OrderFilter>("new");
  const orders = useLoad(useCallback(() => bizApi.orders(filter), [filter]), true, `biz.orders.${filter}`);
  const { refresh } = orders;
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<BusinessOrder | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const poll = setInterval(() => void refresh(), POLL_MS);
      const tick = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        clearInterval(poll);
        clearInterval(tick);
      };
    }, [refresh]),
  );

  const act = async (order: BusinessOrder, action: "accept" | "ready" | "reject", reason?: string) => {
    if (busy) return false;
    setBusy(order.id);
    try {
      await bizApi.decideOrder(order.id, action, reason);
      await refresh();
      watch.refresh();
      return true;
    } catch (e) {
      Alert.alert(errorText(e));
      void refresh();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const d = orders.data;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.head}>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => router.back()} />
        <Title text={o.title} size={30} style={styles.flex1} />
      </View>
      {d ? (
        <Txt style={styles.report}>
          <Txt style={font(800)}>{`${o.report}: `}</Txt>
          {o.reportLine(d.report.orders, som(d.report.revenue), d.report.cancelled, d.report.noShow)}
        </Txt>
      ) : null}
      <StaleNote at={orders.staleAt} style={styles.stale} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onPress={() => setFilter(f)}>
            {d && d.counts[f] > 0 && f !== "done" ? `${o.filters[f]} · ${d.counts[f]}` : (o.filters[f] ?? f)}
          </Chip>
        ))}
      </ScrollView>

      {orders.loading ? (
        <Loading />
      ) : !d ? (
        <Failed error={orders.error ?? copy.unknownError} onRetry={() => void orders.reload()} />
      ) : (
        <FlatList
          data={d.orders}
          keyExtractor={(x) => x.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={() => void orders.reload()} tintColor={colors.orange} />}
          ListHeaderComponent={
            !d.enabled ? (
              <Card style={styles.off}>
                <Txt style={styles.offText}>{o.off}</Txt>
                <SecondaryButton onPress={() => openSite("/biznes/sozlamalar")} style={styles.offBtn}>
                  {o.settings}
                </SecondaryButton>
              </Card>
            ) : undefined
          }
          ListEmptyComponent={<Empty icon="bag" title={o.empty[filter] ?? ""} />}
          renderItem={({ item }) => <OrderCard order={item} now={now} busy={busy === item.id} onAct={(a) => void act(item, a)} onReject={() => setRejecting(item)} />}
        />
      )}

      <RejectSheet
        key={rejecting?.id ?? "none"}
        order={rejecting}
        onClose={() => setRejecting(null)}
        onSend={async (reason) => {
          if (rejecting && (await act(rejecting, "reject", reason))) setRejecting(null);
        }}
      />
    </View>
  );
}

function OrderCard({ order, now, busy, onAct, onReject }: { order: BusinessOrder; now: number; busy: boolean; onAct: (a: "accept" | "ready") => void; onReject: () => void }) {
  const o = copy.biz.orders;
  const left = order.confirmBy ? new Date(order.confirmBy).getTime() - now : null;
  const when =
    order.kind === "PREPAID_PICKUP"
      ? o.until(dayMonth(new Date(new Date(order.slotEnd).getTime() - 1)))
      : `${formatWhen(order.slotStart)}–${clock(order.slotEnd)}`;
  const money = order.prepay === "NONE" ? o.noPrepay : order.prepayAmount < order.totalFinal ? `${o.prepaid(som(order.prepayAmount))} · ${o.dueAtCounter(som(order.totalFinal - order.prepayAmount))}` : o.prepaid(som(order.prepayAmount));
  const tone = order.status === "PAID" ? "orange" : order.status === "CONFIRMED" || order.status === "READY" || order.status === "COMPLETED" ? "green" : "muted";

  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Tag tone={tone}>{o.status[order.status] ?? order.status}</Tag>
        <Txt style={[font(700), styles.code]}>{order.code}</Txt>
      </View>
      <Txt style={[font(800), { fontSize: 17 }]}>{`${order.title} × ${order.quantity}`}</Txt>
      <Txt style={styles.muted}>{when}</Txt>
      <Txt style={styles.muted}>{`${order.student} · ${order.phone}`}</Txt>
      {order.note ? <Txt style={styles.note}>{`“${order.note}”`}</Txt> : null}
      <Txt style={[font(700), { fontSize: 14 }]}>{money}</Txt>
      {order.rejectReason ? <Txt style={styles.reject}>{order.rejectReason}</Txt> : null}

      {order.status === "PAID" ? (
        <>
          {left !== null ? (
            <View style={[styles.timer, left <= 120_000 ? styles.timerHot : null]}>
              <Txt style={[font(800), { fontSize: 14, color: left <= 120_000 ? colors.white : colors.ink }]}>{left > 0 ? o.respondIn(countdown(left)) : o.respondLate}</Txt>
            </View>
          ) : null}
          <View style={styles.actions}>
            <PrimaryButton tone="orange" icon="tick" loading={busy} onPress={() => onAct("accept")} style={styles.flex1}>
              {o.accept}
            </PrimaryButton>
          </View>
          <SecondaryButton danger onPress={onReject} disabled={busy}>
            {o.reject}
          </SecondaryButton>
        </>
      ) : null}
      {order.status === "CONFIRMED" ? (
        <PrimaryButton tone="orange" icon="tick" loading={busy} onPress={() => onAct("ready")} style={styles.actions}>
          {o.ready}
        </PrimaryButton>
      ) : null}
    </Card>
  );
}

function RejectSheet({ order, onClose, onSend }: { order: BusinessOrder | null; onClose: () => void; onSend: (reason: string) => Promise<void> }) {
  const o = copy.biz.orders;
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={order !== null} onClose={onClose} title={o.rejectReason} scroll>
      <View style={styles.sheet}>
        {order ? <Txt style={styles.muted}>{`${order.title} · ${order.student}`}</Txt> : null}
        <Field value={reason} onChangeText={setReason} placeholder={o.rejectPlaceholder} maxLength={150} text={17} autoFocus boxStyle={styles.sheetField} />
        <ErrorBox>{error}</ErrorBox>
        <PrimaryButton
          tone="orange"
          loading={busy}
          onPress={() => {
            if (!reason.trim()) return setError(o.reasonRequired);
            setBusy(true);
            void onSend(reason.trim()).finally(() => setBusy(false));
          }}
          style={styles.actions}
        >
          {o.reject}
        </PrimaryButton>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex1: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  report: { fontSize: 13, color: colors.muted, paddingHorizontal: 24, marginTop: 10 },
  stale: { marginLeft: 24, marginTop: 8 },
  chips: { gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
  list: { paddingHorizontal: 24, gap: 12 },
  off: { padding: 16, gap: 12 },
  offText: { fontSize: 14, lineHeight: 20, color: colors.ink5 },
  offBtn: { alignSelf: "stretch" },
  card: { padding: 16, gap: 6 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { fontSize: 13, color: colors.muted2 },
  muted: { fontSize: 14, color: colors.muted2 },
  note: { fontSize: 14, color: colors.ink5, fontStyle: "italic" },
  reject: { fontSize: 14, color: colors.danger },
  timer: { alignSelf: "flex-start", backgroundColor: colors.peach, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 6 },
  timerHot: { backgroundColor: colors.danger },
  actions: { marginTop: 10, flexDirection: "row" },
  sheet: { paddingHorizontal: 24, gap: 12, paddingBottom: 8 },
  sheetField: { marginTop: 4 },
});
