import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, ApiError, errorText } from "@/api/client";
import { bizApi, type OrderScan, type PaymentType, type Receipt, type ScanPreview } from "@/api/business";
import { som } from "@/business/ui";
import { copy } from "@/copy";
import { parseAmount, priceAfterPercent } from "@/lib/discount";
import { signal } from "@/lib/sound";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Card, Chip, RoundButton, SecondaryButton, Sheet } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { ErrorBox, Field, Label, Note, PrimaryButton, Press, Txt } from "@/ui/kit";

type State =
  | { kind: "camera" }
  | { kind: "busy" }
  | { kind: "coupon"; preview: ScanPreview }
  | { kind: "order"; order: OrderScan }
  | { kind: "done"; receipt: Receipt | null; pdfUrl: string | null; title: string }
  | { kind: "error"; message: string };

/** Bir xil QR'ni kamera ketma-ket bir necha marta o'qiydi — shu vaqt ichida qayta yuborilmaydi */
const SAME_QR_MS = 4000;

/**
 * Skaner (saytdagi B3/B4, egasi va kassir): kamera QR'ni o'qiydi (expo-camera, faqat QR) yoki kupon kodi + 6 raqam
 * qo'lda. Server tekshiradi (`POST /business/scan`): kupon — talaba, narx, to'lov turi (narxsiz chegirmada summa) →
 * "Sotuvni tasdiqlash" → chek; `TB-` buyurtma — tafsilot → "Berildi". Natija tovush va tebranish bilan; xato — sababi
 * (muddati o'tgan, boshqa biznes, ishlatilgan…). Tab ko'rinmayotganda kamera o'chadi.
 */
export default function Scan() {
  const sc = copy.biz.scan;
  const insets = useSafeAreaInsets();
  const { me } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<State>({ kind: "camera" });
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [today, setToday] = useState<{ count: number; sum: number } | null>(null);
  const last = useRef<{ text: string; at: number } | null>(null);
  const locked = useRef(false);

  const loadToday = useCallback(() => {
    // Kassir — o'z sotuvlari, egasi — hammasi (server o'zi cheklaydi)
    void bizApi
      .sales(1, 1, me?.role === "BUSINESS_OWNER" ? me.id : null)
      .then((s) => setToday({ count: s.count, sum: s.sum }))
      .catch(() => undefined);
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      loadToday();
      return () => setFocused(false);
    }, [loadToday]),
  );

  const reset = () => {
    locked.current = false;
    setState({ kind: "camera" });
  };

  const fail = (e: unknown) => {
    signal("error");
    const left = e instanceof ApiError && typeof e.details.attemptsLeft === "number" && e.code === "scan_invalid" ? ` ${sc.attemptsLeft(e.details.attemptsLeft)}` : "";
    setState({ kind: "error", message: `${errorText(e)}${left}` });
  };

  const check = async (input: { qr: string } | { code: string; totp: string }) => {
    if (locked.current) return;
    locked.current = true;
    setState({ kind: "busy" });
    try {
      const result = await bizApi.scan(input);
      signal("success");
      setState(result.kind === "coupon" ? { kind: "coupon", preview: result.preview } : { kind: "order", order: result.order });
    } catch (e) {
      fail(e);
    }
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (locked.current || state.kind !== "camera" || !data) return;
    const now = Date.now();
    if (last.current && last.current.text === data && now - last.current.at < SAME_QR_MS) return;
    last.current = { text: data, at: now };
    void check({ qr: data.trim().slice(0, 200) });
  };

  const done = (receipt: Receipt | null, pdfUrl: string | null, title: string) => {
    signal("success");
    setState({ kind: "done", receipt, pdfUrl, title });
    loadToday();
  };

  const granted = permission?.granted ?? false;
  const cameraOn = focused && granted && !manual && (state.kind === "camera" || state.kind === "busy");

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.head}>
        <View style={styles.flex1}>
          <Txt style={[font(900, 112), styles.title]}>{sc.title}</Txt>
          <Txt numberOfLines={1} style={styles.sub}>
            {[me?.business?.name, today ? `${sc.today}: ${sc.todayCount(today.count, som(today.sum))}` : null].filter(Boolean).join(" · ")}
          </Txt>
        </View>
        {state.kind === "camera" && granted ? <RoundButton dark icon="torch" label={sc.torch} active={torch} onPress={() => setTorch((t) => !t)} /> : null}
      </View>

      {state.kind === "camera" || state.kind === "busy" ? (
        <View style={styles.body}>
          <View style={styles.frame}>
            {cameraOn ? (
              <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} />
            ) : null}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {!granted && permission ? (
              <View style={styles.center}>
                <Txt style={styles.permission}>{sc.permission}</Txt>
                {permission.canAskAgain ? (
                  <PrimaryButton tone="orange" icon={null} onPress={() => void requestPermission()} style={styles.allow}>
                    {sc.allowCamera}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton tone="orange" icon={null} onPress={() => void Linking.openSettings()} style={styles.allow}>
                    {sc.allowCamera}
                  </PrimaryButton>
                )}
              </View>
            ) : null}
            {state.kind === "busy" ? (
              <View style={styles.busy}>
                <ActivityIndicator color={colors.white} size="large" />
              </View>
            ) : null}
          </View>
          <Txt style={[font(800), styles.aim]}>{sc.aim}</Txt>
          <View style={styles.grow} />
          <SecondaryButton icon="edit" onPress={() => setManual(true)} style={[styles.manualBtn, { marginBottom: 16 }]}>
            {sc.enterCode}
          </SecondaryButton>
        </View>
      ) : (
        // Narxsiz chegirmada summa maydoni: maydon, to'lov turi va "Tasdiqlash" klaviatura ustida ko'rinadi
        <KeyboardAwareScrollView contentContainerStyle={styles.result} bottomOffset={SUM_GAP} keyboardShouldPersistTaps="handled">
          {state.kind === "coupon" ? <CouponConfirm preview={state.preview} onDone={done} onFail={fail} onCancel={reset} /> : null}
          {state.kind === "order" ? <OrderHandOver order={state.order} onDone={() => done(null, null, state.order.title)} onFail={fail} onCancel={reset} /> : null}
          {state.kind === "done" ? <Done state={state} onNext={reset} /> : null}
          {state.kind === "error" ? (
            <>
              <Card style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <Icon name="close" size={34} color={colors.white} strokeWidth={3.2} />
                </View>
                <Txt style={[font(900, 112), styles.errorTitle]}>{sc.failed}</Txt>
                <Txt style={[font(700), styles.errorText]}>{state.message}</Txt>
              </Card>
              <PrimaryButton tone="orange" icon="refresh" onPress={reset} style={styles.next}>
                {sc.backToScan}
              </PrimaryButton>
            </>
          ) : null}
        </KeyboardAwareScrollView>
      )}

      <ManualSheet
        visible={manual}
        onClose={() => setManual(false)}
        onSubmit={(code, totp) => {
          setManual(false);
          void check({ code, totp });
        }}
      />
    </View>
  );
}

/** Kupon: talaba, chegirma, summa (narxsiz bo'lsa kiritiladi), to'lov turi → sotuv */
function CouponConfirm({ preview, onDone, onFail, onCancel }: { preview: ScanPreview; onDone: (r: Receipt, pdf: string, title: string) => void; onFail: (e: unknown) => void; onCancel: () => void }) {
  const sc = copy.biz.scan;
  const [payment, setPayment] = useState<PaymentType>("CASH");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsAmount = preview.finalPrice === null;
  const entered = parseAmount(amount);

  const confirm = async () => {
    if (busy) return;
    if (needsAmount && (!entered || entered <= 0)) return setError(sc.amountError);
    setBusy(true);
    setError(null);
    try {
      const res = await bizApi.confirm({ couponId: preview.couponId, ticket: preview.ticket, paymentType: payment, amount: needsAmount ? entered : undefined });
      onDone(res.receipt, res.pdfUrl, preview.title);
    } catch (e) {
      if (e instanceof ApiError && e.fields.includes("amount")) setError(sc.amountError);
      else onFail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.okRow}>
          <Icon name="checkCircle" size={22} color={colors.greenOk} strokeWidth={2.6} />
          <Txt style={[font(800), { fontSize: 14, color: colors.greenOk }]}>{`${sc.valid} · ${sc.verifiedStudent}`}</Txt>
        </View>
        <View style={styles.studentRow}>
          <View style={styles.avatar}>
            <Txt style={[font(900, 112), { fontSize: 22, color: colors.white }]}>{preview.student.initials || "T"}</Txt>
          </View>
          <View style={styles.flex1}>
            <Txt style={[font(900), { fontSize: 19 }]}>{preview.student.name}</Txt>
            <Txt style={styles.muted}>{`${preview.student.university} · ${copy.coupon.course(preview.student.course)}`}</Txt>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.itemRow}>
          <Txt style={[font(800), styles.flex1, { fontSize: 17 }]}>{preview.title}</Txt>
          <View style={styles.badge}>
            <Txt style={[font(900, 62), { fontSize: 24 }]}>{preview.badge}</Txt>
          </View>
        </View>
        {preview.finalPrice !== null ? (
          <View style={styles.sums}>
            {preview.originalPrice !== null ? <SumRow label={sc.original} value={som(preview.originalPrice)} /> : null}
            {preview.discountAmount !== null ? <SumRow label={sc.studentDiscount} value={`−${som(preview.discountAmount)}`} /> : null}
            <SumRow label={sc.toPay} value={som(preview.finalPrice)} big />
          </View>
        ) : (
          <View style={styles.sums}>
            <Label>{preview.bogo ? sc.itemPrice : sc.checkAmount}</Label>
            <Field value={amount} onChangeText={(v) => setAmount(v)} keyboardType="number-pad" placeholder="50 000" text={22} autoFocus invalid={Boolean(error)} />
            {entered && preview.percent !== null ? <SumRow label={sc.toPay} value={som(priceAfterPercent(entered, preview.percent))} big /> : null}
            {entered && preview.bogo ? <SumRow label={sc.toPay} value={som(entered)} big /> : null}
          </View>
        )}
        <Note>{sc.limit[preview.limit](preview.nth)}</Note>
      </Card>

      <Label style={styles.payLabel}>{sc.paymentType}</Label>
      <View style={styles.pay}>
        {(["CASH", "CARD", "QR"] as const).map((p) => (
          <Chip key={p} selected={payment === p} onPress={() => setPayment(p)}>
            {copy.biz.paymentType[p] ?? p}
          </Chip>
        ))}
      </View>
      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton tone="orange" icon="tick" onPress={() => void confirm()} loading={busy} style={styles.next}>
        {sc.confirm}
      </PrimaryButton>
      <SecondaryButton onPress={onCancel} disabled={busy} style={styles.cancel}>
        {sc.cancel}
      </SecondaryButton>
    </>
  );
}

/** Oldindan buyurtma: tafsilot va kassada olinadigan qoldiq → "Berildi" */
function OrderHandOver({ order, onDone, onFail, onCancel }: { order: OrderScan; onDone: () => void; onFail: (e: unknown) => void; onCancel: () => void }) {
  const sc = copy.biz.scan;
  const [busy, setBusy] = useState(false);
  const until = order.validUntil ? new Date(new Date(order.validUntil).getTime() - 86_400_000) : null;

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await bizApi.completeOrder(order.orderId, order.ticket);
      onDone();
    } catch (e) {
      onFail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card style={styles.card}>
        <Txt style={[font(800), styles.eyebrow]}>{`${sc.orderTitle.toUpperCase()} · ${order.code}`}</Txt>
        <View style={styles.studentRow}>
          <View style={styles.avatar}>
            <Txt style={[font(900, 112), { fontSize: 22, color: colors.white }]}>{order.student.initials || "T"}</Txt>
          </View>
          <View style={styles.flex1}>
            <Txt style={[font(900), { fontSize: 19 }]}>{order.student.name}</Txt>
            <Txt style={styles.muted}>{order.student.phone}</Txt>
          </View>
        </View>
        <View style={styles.divider} />
        <Txt style={[font(800), { fontSize: 17 }]}>{`${order.title} × ${order.quantity}`}</Txt>
        <Txt style={styles.muted}>{until ? sc.validUntil(until.toISOString().slice(0, 10).split("-").reverse().join(".")) : order.slot}</Txt>
        {order.note ? <Txt style={[styles.muted, { marginTop: 4 }]}>{order.note}</Txt> : null}
        <View style={styles.sums}>
          {order.prepayAmount > 0 ? <SumRow label={sc.prepaidLabel} value={som(order.prepayAmount)} /> : null}
          <SumRow label={sc.due} value={som(order.dueNow)} big />
        </View>
      </Card>
      <PrimaryButton tone="orange" icon="tick" onPress={() => void complete()} loading={busy} style={styles.next}>
        {sc.handOver}
      </PrimaryButton>
      <SecondaryButton onPress={onCancel} disabled={busy} style={styles.cancel}>
        {sc.cancel}
      </SecondaryButton>
    </>
  );
}

function Done({ state, onNext }: { state: Extract<State, { kind: "done" }>; onNext: () => void }) {
  const sc = copy.biz.scan;
  const r = state.receipt;
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.doneIcon}>
          <Icon name="tick" size={40} color={colors.white} strokeWidth={3.4} />
        </View>
        <Txt style={[font(900, 112), styles.doneTitle]}>{r ? sc.done : sc.handed}</Txt>
        <Txt style={styles.muted}>{state.title}</Txt>
        {r ? (
          <>
            <View style={styles.divider} />
            <SumRow label={copy.biz.receipt.title(r.no)} value={r.time} />
            <SumRow label={copy.biz.receipt.student} value={r.student} />
            <SumRow label={copy.biz.receipt.discount} value={`−${som(r.discountAmount)}`} />
            <SumRow label={sc.toPay} value={som(r.paidAmount)} big />
            <Note>{sc.receiptSent}</Note>
          </>
        ) : null}
      </Card>
      <PrimaryButton tone="orange" icon="arrow" onPress={onNext} style={styles.next}>
        {sc.next}
      </PrimaryButton>
      {r ? (
        <SecondaryButton icon="receipt" onPress={() => router.push(`/receipt/${r.id}`)} style={styles.cancel}>
          {copy.biz.receipt.title(r.no)}
        </SecondaryButton>
      ) : null}
      {r && state.pdfUrl ? (
        <Press onPress={() => void Linking.openURL(`${API_URL}${state.pdfUrl}`)} accessibilityRole="link" style={styles.pdf}>
          <Txt style={[font(800), { fontSize: 15, textDecorationLine: "underline" }]}>{copy.biz.receipt.pdf}</Txt>
        </Press>
      ) : null}
    </>
  );
}

function SumRow({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Txt style={[styles.flex1, { fontSize: big ? 16 : 14, color: big ? colors.ink : colors.muted2 }, big ? font(800) : null]}>{label}</Txt>
      <Txt style={[font(big ? 900 : 700), { fontSize: big ? 22 : 15 }]}>{value}</Txt>
    </View>
  );
}

/** Qo'lda: kupon kodi va 6 raqamli kod (faqat kod hech qachon yetmaydi) */
function ManualSheet({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (code: string, totp: string) => void }) {
  const sc = copy.biz.scan;
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const ready = code.trim().length >= 6 && /^\d{6}$/.test(totp);
  const submit = () => {
    onSubmit(code.trim(), totp);
    setCode("");
    setTotp("");
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={sc.manualTitle}>
      <View style={styles.sheetBody}>
        <Label>{sc.couponCode}</Label>
        <Field value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder={sc.couponPlaceholder} autoCapitalize="characters" autoCorrect={false} text={19} autoFocus returnKeyType="next" />
        <Label style={styles.sheetLabel}>{sc.totpCode}</Label>
        <Field
          value={totp}
          onChangeText={(v) => setTotp(v.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          text={22}
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={() => ready && submit()}
        />
        <PrimaryButton tone="orange" disabled={!ready} onPress={submit} style={styles.next}>
          {sc.check}
        </PrimaryButton>
      </View>
    </Sheet>
  );
}

const C = 34;
/** Summa maydoni ostidagi to'lov turi va "Tasdiqlash" ham klaviatura ustida qolsin */
const SUM_GAP = 260;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  flex1: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  title: { fontSize: 34, letterSpacing: em(34, -0.03), color: colors.white },
  sub: { fontSize: 13, color: colors.line, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  frame: { aspectRatio: 1, width: "100%", borderRadius: 28, overflow: "hidden", backgroundColor: colors.frame },
  corner: { position: "absolute", width: C, height: C, borderColor: colors.orange },
  tl: { top: 18, left: 18, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 18, right: 18, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 18, left: 18, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 18, right: 18, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 28, gap: 16 },
  permission: { color: colors.white, fontSize: 15, lineHeight: 21, textAlign: "center" },
  allow: { alignSelf: "stretch" },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(17,17,17,0.55)", alignItems: "center", justifyContent: "center" },
  aim: { color: colors.white, fontSize: 15, textAlign: "center", marginTop: 16 },
  grow: { flex: 1 },
  manualBtn: { backgroundColor: colors.white },
  result: { padding: 24, paddingTop: 18, paddingBottom: 32 },
  card: { padding: 20, gap: 6 },
  okRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-4deg" }] },
  muted: { fontSize: 14, color: colors.muted2 },
  divider: { height: 1.5, backgroundColor: colors.lineSoft, marginVertical: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { backgroundColor: colors.orange, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 2, transform: [{ rotate: "-3deg" }] },
  sums: { marginTop: 10, gap: 6 },
  sumRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  payLabel: { color: colors.white, marginTop: 18 },
  pay: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  next: { marginTop: 18 },
  cancel: { marginTop: 10, backgroundColor: colors.white },
  eyebrow: { fontSize: 12, letterSpacing: em(12, 0.08), color: colors.muted2 },
  errorCard: { padding: 24, alignItems: "center", gap: 8 },
  errorIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  errorTitle: { fontSize: 28, marginTop: 6 },
  errorText: { fontSize: 16, lineHeight: 22, textAlign: "center", color: colors.danger },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenOk, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  doneTitle: { fontSize: 28, textAlign: "center", marginTop: 8 },
  pdf: { alignSelf: "center", marginTop: 16, padding: 6 },
  sheetBody: { paddingHorizontal: 24, paddingBottom: 8 },
  sheetLabel: { marginTop: 14 },
});
