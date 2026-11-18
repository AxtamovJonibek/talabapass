import { useKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Vibration, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { errorText, isNetworkError } from "@/api/client";
import { appApi, type CouponView } from "@/api/endpoints";
import { copy } from "@/copy";
import { clock } from "@/lib/format";
import { forgetCoupon, rememberCoupon } from "@/lib/offline";
import { formatTimer, fromBase64Url, qrToken, secondsLeftInWindow, totpCode, windowAt } from "@/lib/totp";
import { colors, em, font } from "@/theme";
import { Card, PctBadge, PriceLine, SecondaryButton } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { ErrorBox, PrimaryButton, Txt } from "@/ui/kit";

/** Kupon umri — muddat chizig'i uchun (server: 10 daqiqa) */
const COUPON_MS = 10 * 60_000;
/** Kassir tasdiqladimi — internet bo'lsa shuncha soniyada so'raladi (saytdagidek 4 s) */
const POLL_MS = 4_000;

/**
 * QR va 6 raqamli kod qurilmada, internetsiz (`src/lib/totp.ts` — saytdagi bilan bir xil): har soniya taymer,
 * oyna almashganda (60 s) yangi token. `null` — muddati tugagan.
 */
function useCouponToken(coupon: CouponView) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const slot = windowAt(now);
  const token = useMemo(() => {
    const secret = fromBase64Url(coupon.secret);
    return { qr: qrToken(coupon.code, secret, slot), totp: totpCode(secret, slot) };
  }, [coupon.code, coupon.secret, slot]);
  const msLeft = Math.max(0, Date.parse(coupon.expiresAt) - now);
  return { ...token, msLeft, expired: msLeft <= 0, refreshIn: secondsLeftInWindow(now) };
}

type Phase = { kind: "active" } | { kind: "redeemed"; receiptId: string | null } | { kind: "closed" } | { kind: "cancelled" };

/**
 * Kupon (saytdagi T6): chipta — biznes, nom, narx, QR (kassir skanerlaydi), qo'lda kiritish kodi, kupon kodi, taymer,
 * talaba. Ekran ochiq ekan yoqiq turadi; internet bo'lsa 4 s da holat so'raladi (sotildi / yopildi), internetsiz QR
 * baribir yangilanadi. Bekor qilish — tasdiq bilan, qoldiq qaytadi.
 */
export function CouponPanel({ coupon: initial }: { coupon: CouponView }) {
  const [coupon, setCoupon] = useState(initial);
  const [phase, setPhase] = useState<Phase>({ kind: "active" });
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useCouponToken(coupon);
  const c = copy.coupon;

  // Muddat qurilmada tugadi — qurilmadagi nusxa ham o'chadi
  const expired = phase.kind === "active" && token.expired;
  useEffect(() => {
    if (expired) void forgetCoupon(coupon.id);
  }, [expired, coupon.id]);

  useFocusEffect(
    useCallback(() => {
      if (phase.kind !== "active") return;
      let stopped = false;
      const poll = async () => {
        try {
          const state = await appApi.coupon(coupon.id);
          if (stopped) return;
          setOffline(false);
          if (state.status === "ACTIVE") {
            setCoupon(state.coupon);
            void rememberCoupon(state.coupon);
          } else {
            void forgetCoupon(coupon.id);
            if (state.status === "REDEEMED") Vibration.vibrate(200);
            setPhase(state.status === "REDEEMED" ? { kind: "redeemed", receiptId: state.redemptionId } : { kind: "closed" });
          }
        } catch (e) {
          if (!stopped) setOffline(isNetworkError(e));
        }
      };
      void poll();
      const id = setInterval(() => void poll(), POLL_MS);
      return () => {
        stopped = true;
        clearInterval(id);
      };
    }, [coupon.id, phase.kind]),
  );

  const cancel = () => {
    Alert.alert(c.cancelTitle, c.cancelConfirm, [
      { text: c.cancelNo, style: "cancel" },
      {
        text: c.cancelYes,
        style: "destructive",
        onPress: () => {
          setBusy(true);
          setError(null);
          appApi
            .cancelCoupon(coupon.id)
            .then(async () => {
              await forgetCoupon(coupon.id);
              setPhase({ kind: "cancelled" });
            })
            .catch((e: unknown) => setError(errorText(e)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  if (phase.kind !== "active" || expired) {
    const redeemed = phase.kind === "redeemed";
    const title = redeemed ? c.redeemedTitle : phase.kind === "cancelled" ? c.cancelled : c.expiredTitle;
    return (
      <Card style={styles.done}>
        <View style={[styles.doneIcon, { backgroundColor: redeemed ? colors.green : colors.track }]}>
          <Icon name={redeemed ? "tick" : "ticket"} size={34} strokeWidth={3} color={colors.ink} />
        </View>
        <Txt style={[font(900, 112), styles.doneTitle]}>{title}</Txt>
        <Txt style={styles.doneText}>{redeemed ? c.redeemedText : phase.kind === "cancelled" ? "" : c.expiredText}</Txt>
        {phase.kind === "redeemed" && phase.receiptId ? (
          <PrimaryButton icon={null} onPress={() => router.push(`/receipt/${phase.receiptId}`)} style={styles.doneCta}>
            {c.showReceipt}
          </PrimaryButton>
        ) : null}
        <PrimaryButton onPress={() => router.navigate(`/deal/${coupon.discountId}`)} style={styles.doneCta}>
          {c.backToDeal}
        </PrimaryButton>
        <View style={styles.cardEnd} />
      </Card>
    );
  }

  return (
    <View>
      <ActiveKeepAwake />
      <View style={styles.ticket}>
        <View style={styles.ticketTop}>
          <Txt numberOfLines={1} style={[font(700), { fontSize: 14, color: colors.muted, paddingRight: 90 }]}>
            {coupon.store}
          </Txt>
          <Txt style={[font(900, 112), styles.title]}>{coupon.title}</Txt>
          <View style={styles.price}>
            <PriceLine deal={coupon} />
          </View>
          <PctBadge size={34} style={styles.pct}>
            {coupon.badge}
          </PctBadge>
        </View>

        <Perforation />

        <View style={styles.qrBlock}>
          <View style={styles.qr} accessible accessibilityLabel={c.qrLabel}>
            <QRCode value={token.qr} size={216} ecl="M" color={colors.ink} backgroundColor={colors.white} quietZone={8} />
          </View>
          <Txt style={[font(700), styles.small]}>{c.manualCode.toUpperCase()}</Txt>
          <Txt style={[font(900, 62), styles.totp]} accessibilityLabel={`${c.manualCode}: ${token.totp.split("").join(" ")}`}>
            {`${token.totp.slice(0, 3)} ${token.totp.slice(3)}`}
          </Txt>
          <Txt style={[font(800), styles.code]}>{coupon.code}</Txt>
          <Txt style={styles.refresh}>{c.refreshIn(token.refreshIn)}</Txt>
        </View>

        <Perforation />

        <View style={styles.timerBlock}>
          <View style={styles.timerRow}>
            <Txt style={[font(700), { fontSize: 14, color: colors.muted2 }]}>{c.validFor}</Txt>
            <Txt style={[font(900), styles.timer]}>{formatTimer(token.msLeft)}</Txt>
          </View>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.min(100, (token.msLeft / COUPON_MS) * 100)}%` }]} />
          </View>
          <Txt style={styles.until}>{c.until(clock(coupon.expiresAt))}</Txt>
          <View style={styles.student}>
            <View style={styles.avatar}>
              <Txt style={[font(900), { fontSize: 16, color: colors.white }]}>{coupon.student.initials}</Txt>
            </View>
            <View style={styles.flex1}>
              <Txt numberOfLines={1} style={[font(800), { fontSize: 16 }]}>
                {coupon.student.name}
              </Txt>
              <Txt numberOfLines={1} style={{ fontSize: 13, color: colors.muted2 }}>
                {`${c.student} · ${coupon.student.university} · ${c.course(coupon.student.course)}`}
              </Txt>
            </View>
          </View>
        </View>
      </View>

      <Txt style={[styles.hint, offline ? { color: colors.greenOk } : null]}>{offline ? c.offline : c.hint}</Txt>
      <ErrorBox>{error}</ErrorBox>
      <SecondaryButton icon="close" danger disabled={busy} onPress={cancel} style={styles.cancel}>
        {c.cancel}
      </SecondaryButton>
    </View>
  );
}

/** Ekran yoqiq tursin — faqat faol kupon ko'rinib turganda */
function ActiveKeepAwake() {
  useKeepAwake("coupon");
  return null;
}

/** Chipta tishlari: chetlarda paper doiralar va uzuq chiziq */
function Perforation() {
  return (
    <View style={styles.perf} importantForAccessibility="no-hide-descendants">
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={styles.dash} />
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  ticket: { backgroundColor: colors.white, borderRadius: 24 },
  ticketTop: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  title: { fontSize: 24, lineHeight: 26, letterSpacing: em(24, -0.02), marginTop: 6, paddingRight: 70 },
  price: { marginTop: 10 },
  pct: { position: "absolute", top: 14, right: 14 },
  perf: { height: 24, justifyContent: "center" },
  notch: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: colors.paper },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  dash: { marginHorizontal: 20, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.line },
  qrBlock: { alignItems: "center", paddingVertical: 12 },
  qr: { padding: 6, borderRadius: 16, backgroundColor: colors.white },
  small: { fontSize: 11, letterSpacing: em(11, 0.1), color: colors.muted2, marginTop: 12 },
  totp: { fontSize: 52, lineHeight: 56, letterSpacing: em(52, 0.04), fontVariant: ["tabular-nums"] },
  code: { fontSize: 15, letterSpacing: em(15, 0.08), color: colors.ink5 },
  refresh: { fontSize: 12, color: colors.muted2, marginTop: 6 },
  timerBlock: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 4 },
  timerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  timer: { fontSize: 30, fontVariant: ["tabular-nums"], color: colors.blue },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, marginTop: 8, overflow: "hidden" },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.blue },
  until: { fontSize: 12, color: colors.muted2, marginTop: 6 },
  student: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 12, borderRadius: 18, backgroundColor: colors.paper },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 14, lineHeight: 20, color: colors.muted2, textAlign: "center", marginTop: 14 },
  cancel: { marginTop: 14 },
  done: { alignItems: "center", paddingTop: 28 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 28, lineHeight: 30, letterSpacing: em(28, -0.02), marginTop: 16, textAlign: "center" },
  doneText: { fontSize: 15, lineHeight: 21, color: colors.muted2, textAlign: "center", marginTop: 8 },
  doneCta: { alignSelf: "stretch", marginTop: 20 },
  cardEnd: { height: 18 },
});
