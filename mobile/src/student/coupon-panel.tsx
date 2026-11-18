import { useKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Vibration, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { appApi, type CouponView } from "@/api/endpoints";
import { copy } from "@/copy";
import { formatSom } from "@/lib/format";
import { forgetCoupon, rememberCoupon } from "@/lib/offline";
import { formatTimer, fromBase64Url, qrToken, totpCode, windowAt } from "@/lib/totp";
import { Button, mono } from "@/site/ui";
import { colors, em, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

/** Kupon umri — muddat chizig'i uchun (server: 10 daqiqa) */
const COUPON_MS = 10 * 60_000;
/** Kassir tasdiqladimi — internet bo'lsa shuncha soniyada so'raladi (saytdagidek 4 s) */
const POLL_MS = 4_000;

/**
 * QR va 6 raqamli kod qurilmada, internetsiz (`src/lib/totp.ts` — saytdagi bilan bir xil): har soniya taymer,
 * oyna almashganda (60 s) yangi token.
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
  return { ...token, msLeft, expired: msLeft <= 0 };
}

/** Ekran yoqiq tursin — faqat faol kupon ko'rinib turganda */
function ActiveKeepAwake() {
  useKeepAwake("coupon");
  return null;
}

/**
 * T6 — kupon QR ekrani, saytdagi `/kuponlar/<id>` (`CouponScreen` + `CouponTicket`): qora fon, yopish (chegirmaga),
 * "Yorqinlik maksimal", oq chipta (biznes, nom, narx, yorliq, uzuq chiziq, QR, kupon kodi, 6 raqamli kod, talaba),
 * taymer va chiziq, izoh ("Tarix" havolasi), pastda "Kuponni bekor qilish". Internet bo'lsa 4 s da holat so'raladi:
 * sotilsa — tebranish va chek (Tarix); QR internetsiz ham yangilanadi; ekran yoqiq turadi.
 */
export function CouponScreen({ coupon: initial }: { coupon: CouponView }) {
  const insets = useSafeAreaInsets();
  const [coupon, setCoupon] = useState(initial);
  const [cancelling, setCancelling] = useState(false);
  const token = useCouponToken(coupon);
  const c = copy.coupon;
  const back = () => router.navigate(`/deal/${coupon.discountId}`);

  // Muddat qurilmada tugadi — qurilmadagi nusxa ham o'chadi
  useEffect(() => {
    if (token.expired) void forgetCoupon(coupon.id);
  }, [token.expired, coupon.id]);

  useFocusEffect(
    useCallback(() => {
      if (token.expired) return;
      let stopped = false;
      const poll = async () => {
        try {
          const state = await appApi.coupon(coupon.id);
          if (stopped) return;
          if (state.status === "ACTIVE") {
            setCoupon(state.coupon);
            void rememberCoupon(state.coupon);
          } else {
            void forgetCoupon(coupon.id);
            if (state.status === "REDEEMED") {
              Vibration.vibrate([0, 30, 60, 30]);
              router.replace(state.redemptionId ? `/history?chek=${state.redemptionId}` : "/history");
            }
          }
        } catch {
          // Internet yo'q — QR baribir qurilmada yangilanadi
        }
      };
      void poll();
      const id = setInterval(() => void poll(), POLL_MS);
      return () => {
        stopped = true;
        clearInterval(id);
      };
    }, [coupon.id, token.expired]),
  );

  // Pastdagi tugma bosh barmoq ostida — tasodifiy bosishdan tasdiq so'raladi
  const cancel = () =>
    Alert.alert(c.cancelTitle, c.cancelConfirm, [
      { text: c.cancelNo, style: "cancel" },
      {
        text: c.cancelYes,
        style: "destructive",
        onPress: () => {
          setCancelling(true);
          appApi
            .cancelCoupon(coupon.id)
            .then(async () => {
              await forgetCoupon(coupon.id);
              back();
            })
            .catch((e: unknown) => Alert.alert(errorText(e)))
            .finally(() => setCancelling(false));
        },
      },
    ]);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 54 }]}>
        <View style={styles.top}>
          <Press onPress={back} accessibilityRole="link" accessibilityLabel={c.close} scale={0.94} style={styles.close}>
            <Icon name="close" size={20} color={colors.paper} />
          </Press>
          <View style={styles.brightness}>
            <Icon name="sun" size={16} color={colors.fog2} />
            <Txt style={{ fontSize: 12, color: colors.fog2 }}>{c.brightness}</Txt>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {token.expired ? (
          <View style={styles.expired}>
            <Txt style={[font(700), { fontSize: 18, color: colors.paper }]}>{c.expiredTitle}</Txt>
            <Txt style={{ fontSize: 14, lineHeight: 20, color: colors.fog0 }}>{c.expiredText}</Txt>
            <Button variant="blue" size="md" onPress={back}>
              {c.backToDeal}
            </Button>
          </View>
        ) : (
          <>
            <ActiveKeepAwake />
            <View style={styles.ticket}>
              <View style={styles.ticketTop}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt style={{ fontSize: 12, color: colors.muted }}>{coupon.store}</Txt>
                  <Txt style={[font(800), { fontSize: 18, lineHeight: 21 }]}>{coupon.title}</Txt>
                  <Txt style={{ fontSize: 14, marginTop: 2 }}>
                    {coupon.price ? (
                      <>
                        <Txt style={[font(700), { fontSize: 14 }]}>{`${formatSom(coupon.price.now)} ${copy.currency}`}</Txt>
                        {coupon.price.old ? <Txt style={[mono(), styles.old]}>{` ${formatSom(coupon.price.old)}`}</Txt> : null}
                      </>
                    ) : (
                      <Txt style={[font(700), { fontSize: 14 }]}>{coupon.note ?? coupon.badge}</Txt>
                    )}
                  </Txt>
                </View>
                <View style={styles.badge}>
                  <Txt style={[font(900, 62), { fontSize: 30, lineHeight: 30 }]}>{coupon.badge}</Txt>
                </View>
              </View>
              <View style={styles.dash} />
              <View style={[styles.notch, { left: -11 }]} />
              <View style={[styles.notch, { right: -11 }]} />

              <View style={styles.qrBlock}>
                <View style={styles.qr} accessible accessibilityRole="image" accessibilityLabel={c.qrLabel}>
                  <QRCode value={token.qr} size={203} ecl="M" color={colors.ink} backgroundColor={colors.white} quietZone={0} />
                </View>
                <Txt testID="coupon-code" style={[mono(600), { fontSize: 17, letterSpacing: em(17, 0.12) }]}>
                  {coupon.code}
                </Txt>
                <View style={styles.manual}>
                  <Txt style={{ fontSize: 12, color: colors.muted }}>{c.manualCode}</Txt>
                  <Txt testID="coupon-totp" style={[mono(700), { fontSize: 15, letterSpacing: em(15, 0.08) }]}>
                    {`${token.totp.slice(0, 3)} ${token.totp.slice(3)}`}
                  </Txt>
                </View>
              </View>

              <View style={styles.student}>
                <View style={styles.avatar}>
                  <Txt style={[font(800), { fontSize: 14, color: colors.white }]}>{coupon.student.initials}</Txt>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt style={[font(700), { fontSize: 14 }]}>{coupon.student.name}</Txt>
                  <Txt style={{ fontSize: 12, color: colors.muted }}>{`${coupon.student.university} · ${c.course(coupon.student.course)}`}</Txt>
                </View>
                <View style={styles.verified}>
                  <Icon name="check" size={14} color={colors.greenSite} strokeWidth={3} />
                  <Txt style={[font(700), { fontSize: 12, color: colors.greenSite }]}>{c.student}</Txt>
                </View>
              </View>
            </View>

            <View style={styles.timerRow}>
              <View style={{ gap: 2 }}>
                <Txt style={{ fontSize: 13, color: colors.fog2 }}>{c.validFor}</Txt>
                <Txt testID="coupon-timer" style={[mono(600), { fontSize: 30, color: colors.white }]}>
                  {formatTimer(token.msLeft)}
                </Txt>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${Math.max(token.msLeft / COUPON_MS, 0) * 100}%` }]} />
              </View>
            </View>
            <Txt style={styles.hint}>
              {c.hintParts[0]}
              <Txt onPress={() => router.navigate("/history")} style={[font(700), styles.hintLink]}>
                {c.hintParts[1]}
              </Txt>
              {c.hintParts[2]}
            </Txt>
          </>
        )}
      </ScrollView>

      <View style={styles.bottom}>
        {!token.expired ? (
          <Press onPress={cancel} disabled={cancelling} accessibilityRole="button" accessibilityState={{ busy: cancelling }} scale={0.97} style={[styles.cancel, cancelling ? { opacity: 0.5 } : null]}>
            <Txt style={[font(600), { fontSize: 15, color: colors.paper }]}>{c.cancel}</Txt>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { flexGrow: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink3, alignItems: "center", justifyContent: "center" },
  brightness: { flexDirection: "row", alignItems: "center", gap: 6 },
  expired: { marginHorizontal: 20, marginTop: 18, gap: 12, borderRadius: 22, backgroundColor: colors.ink2, padding: 20 },
  ticket: { marginHorizontal: 20, marginTop: 18, borderRadius: 22, backgroundColor: colors.white },
  ticketTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  old: { fontSize: 12, color: colors.muted2, textDecorationLine: "line-through" },
  badge: { borderRadius: 8, backgroundColor: colors.orange, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4, transform: [{ rotate: "-5deg" }] },
  dash: { marginHorizontal: 18, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.dash },
  notch: { position: "absolute", top: 107, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink },
  qrBlock: { alignItems: "center", gap: 12, paddingTop: 22, paddingBottom: 10 },
  qr: { backgroundColor: colors.white, padding: 6 },
  manual: { flexDirection: "row", alignItems: "center", gap: 8 },
  student: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 6, marginBottom: 16, borderRadius: 14, backgroundColor: colors.paper, paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 20, marginTop: 18 },
  track: { width: 150, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.ink4 },
  bar: { height: 6, backgroundColor: colors.orange },
  hint: { marginHorizontal: 20, marginTop: 16, fontSize: 14, lineHeight: 20, color: colors.fog0 },
  hintLink: { fontSize: 14, color: colors.white, textDecorationLine: "underline" },
  bottom: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34 },
  cancel: { height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.ink7, alignItems: "center", justifyContent: "center" },
});
