import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Linking, ScrollView, StyleSheet, View, type TextInputInstance, useWindowDimensions } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, ApiError, errorText } from "@/api/client";
import { bizApi, type OrderScan, type PaymentType, type Receipt, type ScanPreview, type ScanSummary } from "@/api/business";
import { copy } from "@/copy";
import { parseAmount, priceAfterPercent } from "@/lib/discount";
import { clock, formatSom, MINUS, toTashkent, formatMinute } from "@/lib/format";
import { localDigits, displayPhone } from "@/lib/phone";
import { signal } from "@/lib/sound";
import { PrintReceipt, ReceiptDivider, ReceiptRow } from "@/site/receipt";
import { mono, SiteField, SiteInput, ToggleSquare } from "@/site/ui";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Press, Rich, Txt } from "@/ui/kit";

type Stage =
  | { kind: "scan" }
  | { kind: "manual" }
  | { kind: "preview"; preview: ScanPreview; at: string }
  | { kind: "done"; receipt: Receipt; pdfUrl: string }
  | { kind: "order"; order: OrderScan; at: string }
  | { kind: "orderDone" };

const PAYMENTS = ["CASH", "CARD", "QR"] as const;
/** Bir xil QR'ni kamera ketma-ket bir necha marta o'qiydi — shu vaqt ichida qayta yuborilmaydi (saytdagidek) */
const SAME_QR_MS = 4000;
const nowClock = () => formatMinute(toTashkent(new Date()).minute);

/**
 * B3 — skaner va B4 — sotuvni tasdiqlash / chek, saytdagi `/biznes/skaner` (`ScannerScreen`) ning nusxasi: qora fon,
 * biznes va kassir, bugungi sotuvlar, ramka (expo-camera, faqat QR), "Kodni kiritish" (kupon kodi + 6 raqam), oxirgi
 * sotuv; kassirda pastda "Hisobdan chiqish" (egasida — pastki menyu). Server tekshiradi (`POST /business/scan`):
 * kupon → B4 (talaba, summa, to'lov turi) → chek; `TB-` buyurtma → tafsilot → "Berildi". Tab ko'rinmasa kamera o'chadi.
 */
export default function Scan() {
  const sc = copy.biz.scan;
  const insets = useSafeAreaInsets();
  const { me, signOut } = useApp();
  const cashier = me?.role === "CASHIER";
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "scan" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [torch, setTorch] = useState(false);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [noBusiness, setNoBusiness] = useState(false);
  const last = useRef<{ text: string; at: number } | null>(null);

  const loadSummary = useCallback(() => {
    bizApi.scanSummary().then(
      (s) => {
        setSummary(s);
        setNoBusiness(false);
      },
      (e: unknown) => {
        if (e instanceof ApiError && e.code === "business_not_ready") setNoBusiness(true);
      },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      loadSummary();
      return () => setFocused(false);
    }, [loadSummary]),
  );

  // Saytdagidek kamera ochilishi bilan ruxsat so'raladi (rad etilgan bo'lsa — sozlamalar havolasi)
  useEffect(() => {
    if (focused && permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [focused, permission, requestPermission]);

  // Xato xabari 5 soniyadan keyin yo'qoladi (keyingi skan uchun)
  useEffect(() => {
    if (!error || stage.kind !== "scan") return;
    const id = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(id);
  }, [error, stage.kind]);

  const submit = async (input: { qr: string } | { code: string; totp: string }) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await bizApi.scan(input);
      signal("success");
      setStage(result.kind === "order" ? { kind: "order", order: result.order, at: nowClock() } : { kind: "preview", preview: result.preview, at: nowClock() });
    } catch (e) {
      signal("error");
      const left = e instanceof ApiError && typeof e.details.attemptsLeft === "number" && e.details.attemptsLeft > 0 ? ` ${sc.attemptsLeft(e.details.attemptsLeft)}` : "";
      setError(`${errorText(e)}${left}`);
    } finally {
      setPending(false);
    }
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (pending || stage.kind !== "scan" || !data) return;
    const now = Date.now();
    if (last.current && last.current.text === data && now - last.current.at < SAME_QR_MS) return;
    last.current = { text: data, at: now };
    void submit({ qr: data.trim().slice(0, 200) });
  };

  const toScan = () => {
    setError(null);
    setStage({ kind: "scan" });
  };

  if (stage.kind === "preview")
    return (
      <SalePreview
        preview={stage.preview}
        at={stage.at}
        top={insets.top}
        onCancel={toScan}
        onDone={(receipt, pdfUrl) => {
          signal("success");
          setStage({ kind: "done", receipt, pdfUrl });
          loadSummary();
        }}
      />
    );
  if (stage.kind === "done") return <SaleDone receipt={stage.receipt} pdfUrl={stage.pdfUrl} top={insets.top} onNext={toScan} />;
  if (stage.kind === "order")
    return (
      <OrderPreview
        order={stage.order}
        at={stage.at}
        top={insets.top}
        onCancel={toScan}
        onDone={() => {
          signal("success");
          setStage({ kind: "orderDone" });
          loadSummary();
        }}
      />
    );
  if (stage.kind === "orderDone") return <OrderDone top={insets.top} onNext={toScan} />;

  const footer = cashier ? (
    <View style={styles.footer}>
      <Press onPress={() => void signOut()} accessibilityRole="button" scale={0.98} style={styles.logout}>
        <Icon name="logout" size={18} color={colors.fog2} />
        <Txt style={[font(600), { fontSize: 14, color: colors.fog2 }]}>{copy.profile.logout}</Txt>
      </Press>
    </View>
  ) : null;

  if (noBusiness)
    return (
      <View style={[styles.root, { paddingBottom: insets.bottom }]}>
        <View style={styles.noBusiness}>
          <Txt style={[font(700), { fontSize: 18, color: colors.paper }]}>{sc.noBusinessTitle}</Txt>
          <Txt style={{ fontSize: 14, lineHeight: 20, color: colors.fog0, textAlign: "center" }}>{sc.noBusinessText}</Txt>
        </View>
        {footer}
      </View>
    );

  const granted = permission?.granted ?? false;
  const cameraOn = focused && granted && stage.kind === "scan" && !pending;
  const cameraText = !permission || (permission.canAskAgain && !granted) ? sc.cameraStarting : sc.cameraDenied;
  const name = summary?.business.name ?? me?.business?.name ?? "";

  return (
    <View style={[styles.root, { paddingBottom: cashier ? insets.bottom : 0 }]}>
      <View style={[styles.head, { paddingTop: insets.top + 54 }]}>
        <View style={styles.headLeft}>
          <View style={styles.initial}>
            <Txt style={[font(900, 125), { fontSize: 16 }]}>{name.trim().charAt(0).toUpperCase()}</Txt>
          </View>
          <View style={styles.shrink}>
            <Txt numberOfLines={1} testID="cashier-business" style={[font(700), { fontSize: 15, color: colors.paper }]}>
              {name}
            </Txt>
            <Txt style={{ fontSize: 12, color: colors.fog3 }}>{sc.cashier(summary?.cashierName ?? "")}</Txt>
          </View>
        </View>
        <View style={styles.headRight}>
          <Txt testID="today-sales" style={[mono(600), { fontSize: 22, color: colors.paper }]}>
            {summary?.todaySales ?? 0}
          </Txt>
          <Txt style={{ fontSize: 11, color: colors.fog3 }}>{sc.todaySales}</Txt>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.middle} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {stage.kind === "manual" ? (
          <ManualEntry pending={pending} error={error} onSubmit={(code, totp) => void submit({ code, totp })} onClose={toScan} />
        ) : (
          <>
            <Txt style={[font(600), styles.aim]}>{sc.aimLines}</Txt>
            <View style={styles.frame}>
              {cameraOn ? (
                <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} />
              ) : null}
              {!granted ? (
                <Press
                  onPress={() => (permission?.canAskAgain ? void requestPermission() : void Linking.openSettings())}
                  accessibilityRole="button"
                  scale={1}
                  style={styles.cameraNote}
                >
                  <Txt style={{ fontSize: 13, color: colors.fog1, textAlign: "center" }}>{cameraText}</Txt>
                </Press>
              ) : null}
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              <ScanLine />
            </View>
            {error ? <ScanErrorBox text={error} /> : null}
            <View style={styles.tools}>
              <Press
                onPress={() => {
                  setError(null);
                  setStage({ kind: "manual" });
                }}
                accessibilityRole="button"
                scale={0.96}
                style={styles.enterCode}
              >
                <Icon name="keyboard" size={18} color={colors.paper} />
                <Txt style={[font(600), { fontSize: 14, color: colors.paper }]}>{sc.enterCode}</Txt>
              </Press>
              {granted ? (
                <Press
                  onPress={() => setTorch((t) => !t)}
                  accessibilityRole="button"
                  accessibilityLabel={sc.torch}
                  accessibilityState={{ selected: torch }}
                  scale={0.94}
                  style={[styles.torch, torch ? { backgroundColor: colors.orange } : null]}
                >
                  <Icon name="bolt" size={18} color={torch ? colors.ink : colors.paper} />
                </Press>
              ) : null}
            </View>
          </>
        )}
      </KeyboardAwareScrollView>

      {summary?.lastSale ? (
        <View style={styles.lastSale}>
          <Icon name="check" size={18} color={colors.mint2} strokeWidth={2.6} />
          <Rich text={sc.last(summary.lastSale.student, summary.lastSale.item)} style={styles.lastText} boldStyle={{ fontSize: 13, color: colors.white }} />
          <Txt style={[mono(), { fontSize: 12, color: colors.fog3 }]}>{clock(summary.lastSale.at)}</Txt>
        </View>
      ) : null}
      {footer}
    </View>
  );
}

/** Ramka ichida yuqoridan pastga yuradigan to'q sariq chiziq (saytdagi `scan-line`, 2.4 s) */
function ScanLine() {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  return <Animated.View style={[styles.scanLine, { transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 222] }) }] }]} />;
}

function ScanErrorBox({ text }: { text: string }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <Txt style={[font(800), { fontSize: 15, color: colors.danger, textAlign: "center" }]}>{copy.biz.scan.failed}</Txt>
      <Txt style={[font(600), { fontSize: 14, color: colors.danger, textAlign: "center" }]}>{text}</Txt>
    </View>
  );
}

/** "Kodni kiritish": kupon kodi VA 6 raqamli kod (faqat kupon kodi hech qachon yetarli emas) */
function ManualEntry({ pending, error, onSubmit, onClose }: { pending: boolean; error: string | null; onSubmit: (code: string, totp: string) => void; onClose: () => void }) {
  const sc = copy.biz.scan;
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const totpRef = useRef<TextInputInstance>(null);
  // Yuborilgach 6 raqamli kod tozalanadi, klaviatura ochiq qolib kursor shu maydonda turadi (xatoda qayta kiritiladi)
  const send = () => {
    if (!code.trim() || !totp.trim()) return;
    onSubmit(code.trim(), totp.replace(/\s/g, ""));
    setTotp("");
    totpRef.current?.focus();
  };
  return (
    <View style={styles.manual}>
      <Txt style={[font(700), { fontSize: 18 }]}>{sc.manualTitle}</Txt>
      <SiteField label={sc.couponCode}>
        <SiteInput mono value={code} onChangeText={setCode} placeholder="TP-7K3Q-92XD / TB-…" autoCapitalize="characters" autoCorrect={false} autoFocus returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => totpRef.current?.focus()} />
      </SiteField>
      <SiteField label={sc.totpCode}>
        <SiteInput mono inputRef={totpRef} value={totp} onChangeText={(v) => setTotp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" placeholder="000000" maxLength={6} autoComplete="one-time-code" returnKeyType="done" blurOnSubmit={false} onSubmitEditing={send} />
      </SiteField>
      {error ? <ScanErrorBox text={error} /> : null}
      <View style={styles.pair}>
        <Press onPress={onClose} accessibilityRole="button" scale={0.97} style={[styles.btn, styles.btnQuiet, { height: 48, borderRadius: 12, flex: 1 }]}>
          <Txt style={[font(700), { fontSize: 15 }]}>{sc.back}</Txt>
        </Press>
        <Press onPress={send} disabled={pending} accessibilityRole="button" accessibilityState={{ busy: pending }} scale={0.97} style={[styles.btn, styles.btnOrange, { height: 48, borderRadius: 12, flex: 2 }, pending ? styles.dim : null]}>
          <Txt style={[font(800), { fontSize: 15 }]}>{sc.check}</Txt>
        </Press>
      </View>
    </View>
  );
}

/** B4 sarlavhasi: yashil, yopish (skanerga), "QR haqiqiy", kod · vaqt */
function GreenHead({ title, sub, top, onClose }: { title: string; sub: string; top: number; onClose: () => void }) {
  return (
    <View style={[styles.green, { paddingTop: top + 54 }]}>
      <Press onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.biz.scan.backToScan} scale={0.94} style={styles.greenClose}>
        <Icon name="close" size={20} color={colors.white} />
      </Press>
      <View style={styles.shrink}>
        <Txt style={[font(800), { fontSize: 18, color: colors.white }]}>{title}</Txt>
        <Txt style={[mono(), { fontSize: 12, color: colors.mint3 }]}>{sub}</Txt>
      </View>
      <Icon name="checkCircle" size={34} color={colors.white} />
    </View>
  );
}

function BottomPair({ left, right, onLeft, onRight, busy = false, dark = false }: { left: string; right: string; onLeft: () => void; onRight: () => void; busy?: boolean; dark?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottom, { paddingBottom: insets.bottom + 30 }]}>
      <Press onPress={onLeft} accessibilityRole="button" scale={0.97} style={[styles.btn, styles.btnQuiet, { flex: 1 }]}>
        <Txt style={[font(700), { fontSize: 15 }]}>{left}</Txt>
      </Press>
      <Press
        onPress={onRight}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy }}
        scale={0.97}
        style={[styles.btn, dark ? { backgroundColor: colors.ink } : styles.btnOrange, { flex: 2 }, busy ? styles.dim : null]}
      >
        <Txt style={[font(800), { fontSize: 16, color: dark ? colors.white : colors.ink }]}>{right}</Txt>
      </Press>
    </View>
  );
}

function StudentCard({ initials, name, children }: { initials: string; name: string; children: ReactNode }) {
  return (
    <View style={styles.studentCard}>
      <View style={styles.studentAvatar}>
        <Txt style={[font(900), { fontSize: 20, color: colors.white }]}>{initials}</Txt>
      </View>
      <View style={[styles.shrink, { gap: 2 }]}>
        <Txt style={[font(800), { fontSize: 17 }]}>{name}</Txt>
        {children}
      </View>
    </View>
  );
}

function MoneyRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.between}>
      <Txt style={[mono(), { fontSize: 14, color: tone ?? colors.muted }]}>{label}</Txt>
      <Txt style={[mono(), { fontSize: 14, color: tone ?? colors.ink }]}>{value}</Txt>
    </View>
  );
}

function TotalRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={[styles.between, { alignItems: "baseline" }]}>
      <Txt style={[font(700), { fontSize: 14 }]}>{label}</Txt>
      <Txt testID={testID} style={[mono(600), { fontSize: 26 }]}>
        {value}
      </Txt>
    </View>
  );
}

/** B4 — QR haqiqiy: talaba, chegirma summalari, to'lov turi, "Sotuvni tasdiqlash" */
function SalePreview({ preview: p, at, top, onCancel, onDone }: { preview: ScanPreview; at: string; top: number; onCancel: () => void; onDone: (r: Receipt, pdfUrl: string) => void }) {
  const sc = copy.biz.scan;
  const [payment, setPayment] = useState<PaymentType>("CASH");
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Narxsiz chegirma: foizli — chek summasi, 1+1 — bitta mahsulot narxi
  const needsAmount = p.finalPrice === null;
  const amount = parseAmount(amountText);
  const computed = !needsAmount
    ? { original: p.originalPrice ?? 0, discount: p.discountAmount ?? 0, paid: p.finalPrice ?? 0 }
    : amount
      ? p.bogo
        ? { original: amount * 2, discount: amount, paid: amount }
        : p.percent !== null
          ? { original: amount, discount: amount - priceAfterPercent(amount, p.percent), paid: priceAfterPercent(amount, p.percent) }
          : null
      : null;

  const confirm = async () => {
    if (busy) return;
    setError(null);
    if (needsAmount && !amount) return setError(sc.amountError);
    setBusy(true);
    try {
      const res = await bizApi.confirm({ couponId: p.couponId, ticket: p.ticket, paymentType: payment, amount: needsAmount ? amount : null });
      onDone(res.receipt, res.pdfUrl);
    } catch (e) {
      signal("error");
      setError(e instanceof ApiError && e.fields.includes("amount") ? sc.amountError : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.paperRoot}>
      <GreenHead title={sc.valid} sub={`${p.code} · ${at}`} top={top} onClose={onCancel} />
      <KeyboardAwareScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        <StudentCard initials={p.student.initials} name={p.student.name}>
          <Txt style={{ fontSize: 13, color: colors.muted }}>{`${p.student.university} · ${copy.coupon.course(p.student.course)}`}</Txt>
          <Txt style={[font(700), { fontSize: 12, color: colors.greenSite }]}>{sc.verifiedStudent}</Txt>
        </StudentCard>

        <View style={styles.dealCard}>
          <View style={[styles.between, { alignItems: "flex-start", gap: 10 }]}>
            <View style={styles.shrink}>
              <Txt style={{ fontSize: 12, color: colors.muted }}>{sc.discount}</Txt>
              <Txt style={[font(800), { fontSize: 17, marginTop: 2 }]}>{p.title}</Txt>
            </View>
            <View style={styles.scanBadge}>
              <Txt style={[font(900, 62), { fontSize: 26, lineHeight: 26 }]}>{p.badge}</Txt>
            </View>
          </View>
          {needsAmount ? (
            <SiteField label={p.bogo ? sc.itemPrice : sc.checkAmount} style={{ marginTop: 14 }}>
              <SiteInput mono value={amountText} onChangeText={setAmountText} keyboardType="number-pad" placeholder="40 000" autoFocus />
            </SiteField>
          ) : null}
          {computed ? (
            <View style={styles.sums}>
              <MoneyRow label={sc.original} value={formatSom(computed.original)} />
              <MoneyRow label={sc.studentDiscount} value={`${MINUS}${formatSom(computed.discount)}`} tone={colors.rust} />
              <ReceiptDivider />
              <TotalRow label={sc.toPay} value={formatSom(computed.paid)} testID="sale-total" />
            </View>
          ) : null}
        </View>

        <View>
          <Txt style={[font(600), { fontSize: 13, marginBottom: 8 }]}>{sc.paymentType}</Txt>
          <View style={styles.payments}>
            {PAYMENTS.map((type) => (
              <ToggleSquare key={type} bold textSize={14} selected={payment === type} onPress={() => setPayment(type)} style={styles.flex1}>
                {copy.biz.paymentType[type] ?? type}
              </ToggleSquare>
            ))}
          </View>
        </View>
        <View style={styles.info}>
          <Icon name="info" size={16} color={colors.muted} />
          <Txt style={{ fontSize: 13, color: colors.muted, flexShrink: 1 }}>{sc.limitLine[p.limit](p.nth)}</Txt>
        </View>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorWide}>
            <Txt style={[font(600), { fontSize: 14, color: colors.danger }]}>{error}</Txt>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
      <BottomPair left={sc.reject} right={sc.confirm} onLeft={onCancel} onRight={() => void confirm()} busy={busy} />
    </View>
  );
}

/** B4 tasdiqlangandan keyin: "Chek chiqarildi" (saytda "Chop etish" — ilovada PDF) */
function SaleDone({ receipt: r, pdfUrl, top, onNext }: { receipt: Receipt; pdfUrl: string; top: number; onNext: () => void }) {
  const sc = copy.biz.scan;
  const rc = copy.biz.receipt;
  const { width } = useWindowDimensions();
  return (
    <View style={styles.paperRoot}>
      <ScrollView contentContainerStyle={[styles.done, { paddingTop: top + 22 }]}>
        <Txt style={[font(900, 110), styles.doneTitle]}>{sc.receiptDone}</Txt>
        <View style={{ marginTop: 16 }}>
          <PrintReceipt business={r.business.name} address={[r.business.address, r.business.tin ? rc.tin(r.business.tin) : null].filter(Boolean).join(" · ")} width={width - 40}>
            <ReceiptRow kind="plain" label={rc.no} value={r.no} />
            <ReceiptRow kind="plain" label={rc.date} value={r.time} />
            <ReceiptRow kind="plain" label={rc.student} value={r.student} />
            <ReceiptRow kind="plain" label={rc.cashier} value={r.cashier} />
            <ReceiptDivider wide />
            <ReceiptRow kind="plain" label={r.item} value={formatSom(r.originalPrice)} />
            <ReceiptRow kind="plain" label={`talabaPass ${r.badge}`} value={`${MINUS}${formatSom(r.discountAmount)}`} />
            <ReceiptRow kind="grand" label={rc.total} value={formatSom(r.paidAmount)} />
            <ReceiptRow label={rc.payment} value={copy.biz.paymentType[r.paymentType] ?? r.paymentType} />
          </PrintReceipt>
        </View>
        <Txt style={{ marginTop: 14, fontSize: 13, color: colors.muted, textAlign: "center" }}>{sc.receiptSent}</Txt>
      </ScrollView>
      <BottomPair left={rc.pdf} right={sc.next} onLeft={() => void Linking.openURL(pdfUrl.startsWith("http") ? pdfUrl : `${API_URL}${pdfUrl}`)} onRight={onNext} dark />
    </View>
  );
}

/** Oldindan band qilingan buyurtma (saytdagi `OrderPreview`): kim, nima, nechta, vaqt, to'langan va kassada olinadigan */
function OrderPreview({ order: o, at, top, onCancel, onDone }: { order: OrderScan; at: string; top: number; onCancel: () => void; onDone: () => void }) {
  const sc = copy.biz.scan;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const until = o.validUntil ? new Date(new Date(o.validUntil).getTime() - 86_400_000).toISOString().slice(0, 10).split("-").reverse().join(".") : null;

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await bizApi.completeOrder(o.orderId, o.ticket);
      onDone();
    } catch (e) {
      signal("error");
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.paperRoot}>
      <GreenHead title={sc.order.valid} sub={`${o.code} · ${at}`} top={top} onClose={onCancel} />
      <ScrollView contentContainerStyle={styles.sheet} testID="order-preview">
        <StudentCard initials={o.student.initials} name={o.student.name}>
          <Press onPress={() => void Linking.openURL(`tel:${o.student.phone}`)} accessibilityRole="link" scale={0.98}>
            <Txt style={[mono(), { fontSize: 13, color: colors.muted }]}>{displayPhone(localDigits(o.student.phone))}</Txt>
          </Press>
        </StudentCard>
        <View style={styles.dealCard}>
          <Txt style={{ fontSize: 12, color: colors.muted }}>{sc.order.kind[o.kind] ?? ""}</Txt>
          <View style={[styles.between, { alignItems: "baseline", gap: 12, marginTop: 2 }]}>
            <Txt style={[font(800), { fontSize: 20, flexShrink: 1 }]}>{o.title}</Txt>
            <Txt testID="order-quantity" style={[mono(600), { fontSize: 28 }]}>{`× ${o.quantity}`}</Txt>
          </View>
          <View style={[styles.sums, { marginTop: 12 }]}>
            <MoneyRow label={until ? sc.order.validUntil : sc.order.slot} value={until ?? o.slot} />
            {o.note ? (
              <View style={[styles.between, { gap: 12 }]}>
                <Txt style={[mono(), { fontSize: 14, color: colors.muted }]}>{sc.order.note}</Txt>
                <Txt style={{ fontSize: 14, textAlign: "right", flexShrink: 1 }}>{o.note}</Txt>
              </View>
            ) : null}
            <MoneyRow label={sc.prepaidLabel} value={formatSom(o.prepayAmount)} />
            <ReceiptDivider />
            <TotalRow label={sc.due} value={formatSom(o.dueNow)} />
            {o.dueNow === 0 ? <Txt style={[font(600), { fontSize: 13, color: colors.greenSite, textAlign: "right" }]}>{sc.order.nothingDue}</Txt> : null}
          </View>
        </View>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorWide}>
            <Txt style={[font(600), { fontSize: 14, color: colors.danger }]}>{error}</Txt>
          </View>
        ) : null}
      </ScrollView>
      <BottomPair left={sc.back} right={sc.handOver} onLeft={onCancel} onRight={() => void complete()} busy={busy} />
    </View>
  );
}

/** "Buyurtma berildi" — keyingi skanga */
function OrderDone({ top, onNext }: { top: number; onNext: () => void }) {
  const sc = copy.biz.scan;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.paperRoot, { paddingTop: top }]}>
      <View style={styles.orderDone}>
        <View style={styles.doneIcon}>
          <Icon name="check" size={32} color={colors.greenSite} strokeWidth={2.6} />
        </View>
        <Txt testID="order-done" style={[font(900, 110), styles.doneTitle]}>
          {sc.handed}
        </Txt>
        <Txt style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>{sc.order.doneHint}</Txt>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 30 }}>
        <Press onPress={onNext} accessibilityRole="button" scale={0.97} style={[styles.btn, { backgroundColor: colors.ink }]}>
          <Txt style={[font(800), { fontSize: 16, color: colors.white }]}>{sc.next}</Txt>
        </Press>
      </View>
    </View>
  );
}

const C = 44;
const styles = StyleSheet.create({
  flex1: { flex: 1 },
  shrink: { flex: 1, minWidth: 0 },
  between: { flexDirection: "row", justifyContent: "space-between" },
  root: { flex: 1, backgroundColor: colors.ink0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  initial: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  headRight: { alignItems: "flex-end" },
  middle: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 22, paddingHorizontal: 16, paddingVertical: 16 },
  aim: { fontSize: 16, color: colors.paper, textAlign: "center" },
  frame: { width: 260, height: 260, borderRadius: 22, overflow: "hidden", backgroundColor: colors.ink1 },
  cameraNote: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 24 },
  corner: { position: "absolute", width: C, height: C, borderColor: colors.orange },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 22 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 22 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 22 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 22 },
  scanLine: { position: "absolute", top: 18, left: 18, right: 18, height: 2, backgroundColor: colors.orange, boxShadow: `0 0 14px 2px ${colors.orange}` },
  tools: { flexDirection: "row", gap: 10 },
  enterCode: { height: 46, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 23, backgroundColor: colors.ink2, paddingHorizontal: 16 },
  torch: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink2, alignItems: "center", justifyContent: "center" },
  errorBox: { width: "100%", maxWidth: 320, borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 },
  errorWide: { borderRadius: 14, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 },
  lastSale: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginBottom: 14, borderRadius: 14, backgroundColor: colors.ink1, paddingHorizontal: 14, paddingVertical: 12 },
  lastText: { flex: 1, fontSize: 13, color: colors.fog1 },
  footer: { paddingHorizontal: 16, paddingBottom: 24 },
  logout: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, borderWidth: 1.5, borderColor: colors.ink4 },
  noBusiness: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  manual: { width: "100%", maxWidth: 340, gap: 12, borderRadius: 22, backgroundColor: colors.white, padding: 20 },
  pair: { flexDirection: "row", gap: 8 },
  btn: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnQuiet: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  btnOrange: { backgroundColor: colors.orange },
  dim: { opacity: 0.5 },
  paperRoot: { flex: 1, backgroundColor: colors.paper },
  green: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.greenSite, paddingHorizontal: 16, paddingBottom: 18 },
  greenClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green2, alignItems: "center", justifyContent: "center" },
  sheet: { padding: 16, gap: 10 },
  studentCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.white, padding: 14 },
  studentAvatar: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  dealCard: { borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 14 },
  scanBadge: { borderRadius: 7, backgroundColor: colors.orange, paddingHorizontal: 8, paddingTop: 5, paddingBottom: 3, transform: [{ rotate: "-5deg" }] },
  sums: { marginTop: 14, gap: 8 },
  payments: { flexDirection: "row", gap: 6 },
  info: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2, paddingTop: 2 },
  bottom: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingHorizontal: 16, paddingTop: 12 },
  done: { paddingHorizontal: 20, paddingBottom: 16 },
  doneTitle: { fontSize: 26, letterSpacing: em(26, -0.02), textAlign: "center" },
  orderDone: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.greenBg, alignItems: "center", justifyContent: "center" },
});
