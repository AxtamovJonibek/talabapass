import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { errorText } from "@/api/client";
import { appApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { clock, formatSom, toTashkent } from "@/lib/format";
import { fromBase64Url, qrToken, secondsLeftInWindow, totpCode, windowAt } from "@/lib/totp";
import { useLoad } from "@/lib/use-load";
import { OrderBadge, orderWhen, SubScreen } from "@/site/screen";
import { Button, mono } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Txt } from "@/ui/kit";

/** Saytdagidek: holat 5 soniyada yangilanadi */
const POLL_MS = 5_000;

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Txt style={[strong ? font(700) : null, { fontSize: 14, color: strong ? colors.ink : colors.muted }]}>{label}</Txt>
      <Txt style={[font(strong ? 700 : 400), { fontSize: 14, textAlign: "right", flexShrink: 1 }]}>{value}</Txt>
    </View>
  );
}

/**
 * Buyurtma (saytdagi `/buyurtmalar/<id>`): holat, QR va 6 raqamli kod (tasdiqlangan/tayyor — kupon kabi TOTP, `TB-` kodi),
 * vaqt, soni, manzil, jami, vaqt chizig'i, bekor qilish (qaytadigan summa oldindan aytiladi).
 */
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const o = copy.orders;
  const data = useLoad(useCallback(() => appApi.order(id), [id]), true, `order.${id}`);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const { refresh } = data;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => void refresh(), POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [refresh]);

  const order = data.data?.order;
  if (!order) {
    return <SubScreen title={o.title}>{data.error ? <Failed error={data.error} onRetry={() => void data.reload()} /> : <Loading />}</SubScreen>;
  }

  const secret = order.secret ? fromBase64Url(order.secret) : null;
  const slot = windowAt(now);
  const cancel = () => {
    if (!order.cancel) return;
    Alert.alert(o.cancel, o.cancelConfirm(formatSom(order.cancel.refund)), [
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
      {
        text: o.cancel,
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await appApi.cancelOrder(order.id);
            await data.reload();
          } catch (e) {
            Alert.alert(o.cancelFailed, errorText(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SubScreen title={order.title} back={o.title}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Txt style={{ fontSize: 13, color: colors.muted }}>{order.businessName}</Txt>
          <OrderBadge status={order.status} />
        </View>
        {secret ? (
          <View style={styles.qr}>
            <QRCode value={qrToken(order.code, secret, slot)} size={216} ecl="M" color={colors.ink} backgroundColor={colors.white} quietZone={8} />
            <Txt style={[mono(700), styles.totp]}>{totpCode(secret, slot).replace(/(\d{3})(\d{3})/, "$1 $2")}</Txt>
            <Txt style={{ fontSize: 12, color: colors.muted }}>{o.refreshIn(secondsLeftInWindow(now))}</Txt>
            <Txt style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>{o.qrHint}</Txt>
          </View>
        ) : null}
        <Row label={o.code} value={order.code} />
        <Row label={o.when} value={orderWhen(order.slotStart, order.slotEnd, order.kind)} />
        <Row label={o.quantity} value={String(order.quantity)} />
        <Row label={o.address} value={order.address} />
        <Row label={o.total} value={`${formatSom(order.totalFinal)} ${copy.currency}`} strong />
        {order.prepayAmount > 0 ? <Row label={o.prepaid} value={`${formatSom(order.prepayAmount)} ${copy.currency}`} /> : null}
        {order.rejectReason ? <Txt style={{ fontSize: 13, color: colors.danger }}>{o.rejectReason(order.rejectReason)}</Txt> : null}
      </View>

      <Txt style={[font(700), styles.section]}>{o.timeline.toUpperCase()}</Txt>
      <View style={styles.card}>
        {order.events.map((e, i) => {
          const at = toTashkent(new Date(e.at));
          return (
            <View key={`${e.to}-${i}`} style={styles.row}>
              <Txt style={[font(600), { fontSize: 14 }]}>{o.status[e.to] ?? e.to}</Txt>
              <Txt style={[mono(), { fontSize: 13, color: colors.muted }]}>{`${at.date.getUTCDate()}-${copy.months[at.date.getUTCMonth()]}, ${clock(e.at)}`}</Txt>
            </View>
          );
        })}
      </View>

      {order.cancel ? (
        <Button variant="danger-outline" size="md" block busy={busy} disabled={busy} onPress={cancel} style={styles.cancel}>
          {o.cancel}
        </Button>
      ) : null}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderRadius: 16, backgroundColor: colors.white, padding: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  qr: { alignItems: "center", gap: 6, paddingVertical: 8 },
  totp: { fontSize: 26, letterSpacing: em(26, 0.08) },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  section: { marginTop: 20, marginBottom: 8, fontSize: 12, letterSpacing: em(12, 0.06), color: colors.muted },
  cancel: { marginTop: 16 },
});
