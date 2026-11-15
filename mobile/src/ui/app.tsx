import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/api/client";
import type { FeedDeal } from "@/api/endpoints";
import { copy } from "@/copy";
import { isLowStock } from "@/lib/feed";
import { dealNote, formatKm, formatSom, statusPill, type PillTone } from "@/lib/format";
import { colors, em, font } from "@/theme";
import { Icon, isIconName, type IconName } from "./icons";
import { ErrorBox, PrimaryButton, Press, Title, Txt } from "./kit";

/*
 * Talaba ilovasi primitivlari (kirgandan keyingi qism). Dizaynda chizilmagan — mazmun saytdagi talaba bo'limidan
 * (T4–T8: FeedCard, StatusPill, PctBadge), ko'rinish app-flow uslubida: paper fon, oq kartalar (radius 24), 2px qora
 * chegara, Archivo 900/112 sarlavhalar, 58px tugmalar.
 */

/** Nisbiy rasm manzili (`/api/chegirma/rasm/<id>`) → to'liq */
export const imageUrl = (path: string) => (/^https?:/.test(path) ? path : `${API_URL}${path}`);

// ───────── ekran ─────────

/** Tab ekrani: tepada xavfsiz hudud + 12, yon 24; pastki menyu o'z joyini o'zi oladi. */
export function TabScreen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.fill, { paddingTop: insets.top + 12, backgroundColor: colors.paper }, style]}>{children}</View>;
}

/** Sarlavha qatori: katta sarlavha + o'ngda tugmalar */
export function ScreenHeader({ title, right, style }: { title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.header, style]}>
      <Title text={title} size={38} style={styles.flex1} />
      {right ? <View style={styles.row8}>{right}</View> : null}
    </View>
  );
}

/** 44×44 oq doira tugma (qo'ng'iroq, xarita, ←, saqlash); `dot` — o'qilmagan belgisi */
export function RoundButton({ icon, onPress, label, dot = false, active = false, dark = false }: { icon: IconName; onPress: () => void; label: string; dot?: boolean; active?: boolean; dark?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} scale={0.94} style={[styles.round, dark ? styles.roundDark : null]}>
      <Icon name={icon} size={22} strokeWidth={2.4} color={active ? colors.blue : dark ? colors.white : colors.ink} fill={active ? colors.blue : "none"} />
      {dot ? <View style={styles.dot} /> : null}
    </Press>
  );
}

// ───────── chip va pilyulka ─────────

/** Tanlov chipi: tanlangani qora, qolgani oq 2px qora chegara (app-flow `Choice` pill bilan bir xil) */
export function Chip({ selected, onPress, children, icon, label }: { selected: boolean; onPress: () => void; children: string; icon?: string; label?: string }) {
  const fg = selected ? colors.white : colors.ink;
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      scale={0.96}
      style={[styles.chip, { backgroundColor: selected ? colors.ink : colors.white }]}
    >
      {icon && isIconName(icon) ? <Icon name={icon} size={18} strokeWidth={2.2} color={fg} /> : null}
      <Txt style={[font(800), { fontSize: 15, color: fg }]}>{children}</Txt>
    </Press>
  );
}

const PILL: Record<PillTone, { dot: string; text: string }> = {
  open: { dot: colors.green, text: colors.greenOk },
  soon: { dot: colors.orange, text: "#9A3A0E" },
  closed: { dot: colors.muted2, text: colors.muted },
};

/** Holat pilyulkasi (saytdagi `StatusPill`): "Hozir ochiq · 23:00 gacha" — yashil / to'q sariq / kulrang */
export function StatusPill({ deal, now }: { deal: Pick<FeedDeal, "live" | "closesAt" | "opensAt">; now: Date }) {
  const pill = statusPill(deal, now);
  const tone = PILL[pill.tone];
  return (
    <View style={styles.pill}>
      <View style={[styles.pillDot, { backgroundColor: tone.dot }]} />
      <Txt numberOfLines={1} style={[font(700), { fontSize: 12, color: tone.text }]}>
        {pill.text}
      </Txt>
    </View>
  );
}

/** Foiz yorlig'i: "−30%", "1+1" — to'q sariq, −3° qiya, siqiq 900 */
export function PctBadge({ children, size = 40, style }: { children: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pct, style]}>
      <Txt style={[font(900, 62), { fontSize: size, lineHeight: Math.round(size * 1.02) }]}>{children}</Txt>
    </View>
  );
}

/** "Tez tugayapti · 2/20" — qora fon, to'q sariq yozuv */
export function StockTag({ children }: { children: string }) {
  return (
    <View style={styles.stock}>
      <Txt style={[font(800), { fontSize: 11, letterSpacing: em(11, 0.06), color: colors.orange }]}>{children.toUpperCase()}</Txt>
    </View>
  );
}

// ───────── chegirma kartasi ─────────

/** Narx plitkasi: "26 600 so'm ~~38 000~~" yoki narxsiz matn */
export function PriceLine({ deal, big = false }: { deal: Pick<FeedDeal, "price" | "note" | "badge">; big?: boolean }) {
  if (!deal.price) return <Txt style={[font(900), { fontSize: big ? 22 : 18, lineHeight: big ? 26 : 22 }]}>{dealNote(deal)}</Txt>;
  return (
    <View style={styles.priceRow}>
      <Txt style={[font(900, 62), { fontSize: big ? 44 : 34, lineHeight: big ? 46 : 36 }]}>{formatSom(deal.price.now)}</Txt>
      <Txt style={[font(800), { fontSize: big ? 15 : 13 }]}>{copy.currency}</Txt>
      {deal.price.old ? <Txt style={[font(600), styles.old, { fontSize: big ? 14 : 12 }]}>{formatSom(deal.price.old)}</Txt> : null}
    </View>
  );
}

/** Rasm yoki rasmsiz plita (katta bosh harf + "Rasm kutilmoqda") */
export function DealImage({ deal, height, children }: { deal: Pick<FeedDeal, "images" | "store" | "tile" | "ink">; height: number; children?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const src = deal.images[0];
  const letter = deal.store.trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.image, { height, backgroundColor: deal.tile }]}>
      {src && !failed ? (
        <Image source={{ uri: imageUrl(src) }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <>
          <Txt style={[font(900, 112), styles.letter, { color: deal.ink, fontSize: height * 1.1, lineHeight: height * 1.15 }]}>{letter}</Txt>
          <Txt style={[font(700), styles.pending, { color: deal.ink }]}>{copy.deal.pending.toUpperCase()}</Txt>
        </>
      )}
      {children}
    </View>
  );
}

/**
 * Lenta kartasi (saytdagi FeedCard "Lenta B · Jurnal" mazmuni): rasm (holat pilyulkasi, zaxira yorlig'i, narx plitkasi),
 * foiz yorlig'i, biznes · tuman · masofa, nom, "tejaysiz" va qoldiq.
 */
export function DealCard({ deal, now, onPress }: { deal: FeedDeal; now: Date; onPress: () => void }) {
  const low = isLowStock(deal, now);
  const where = [deal.district, deal.distanceKm !== null ? formatKm(deal.distanceKm) : null].filter(Boolean).join(" · ");
  const saves = deal.price?.old ? copy.deal.saves(formatSom(deal.price.old - deal.price.now)) : null;
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${deal.store}, ${deal.title}, ${deal.badge}`} scale={0.985} style={styles.cardWrap}>
      <View style={styles.card}>
        <DealImage deal={deal} height={180}>
          <View style={styles.marks}>
            <StatusPill deal={deal} now={now} />
            {low ? <StockTag>{copy.deal.hot(deal.left, deal.total)}</StockTag> : null}
          </View>
          <View style={styles.priceTile}>
            <PriceLine deal={deal} />
          </View>
        </DealImage>
        <View style={styles.cardBody}>
          <View style={styles.storeRow}>
            <View style={[styles.storeDot, { backgroundColor: deal.ink }]}>
              <Txt style={[font(900), { fontSize: 11, color: deal.tile }]}>{deal.store.trim().charAt(0).toUpperCase()}</Txt>
            </View>
            <Txt numberOfLines={1} style={[styles.flex1, { fontSize: 13, color: colors.muted }]}>
              <Txt style={[font(700), { color: colors.ink }]}>{deal.store}</Txt>
              {where ? ` · ${where}` : ""}
            </Txt>
          </View>
          <Txt numberOfLines={2} style={[font(800), { fontSize: 21, lineHeight: 24, letterSpacing: em(21, -0.02) }]}>
            {deal.title}
          </Txt>
          <View style={styles.cardFoot}>
            <Txt style={[font(700), { fontSize: 13, color: colors.greenOk }]}>{saves ?? ""}</Txt>
            <Txt style={[low ? font(700) : null, { fontSize: 13, color: low ? colors.danger : colors.muted2 }]}>
              {low ? copy.deal.leftLow(deal.left, deal.total) : copy.deal.left(deal.left, deal.total)}
            </Txt>
          </View>
        </View>
      </View>
      <PctBadge style={styles.cardPct}>{deal.badge}</PctBadge>
    </Press>
  );
}

// ───────── holatlar ─────────

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.blue} size="large" />
    </View>
  );
}

/** Bo'sh holat: belgi plitkasi, sarlavha, matn va (ixtiyoriy) tugma */
export function Empty({ icon, title, text, action, style }: { icon: IconName; title: string; text?: string; action?: { label: string; onPress: () => void }; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.empty, style]}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} strokeWidth={2.2} color={colors.muted} />
      </View>
      <Txt style={[font(800), styles.emptyTitle]}>{title}</Txt>
      {text ? <Txt style={styles.emptyText}>{text}</Txt> : null}
      {action ? (
        <PrimaryButton onPress={action.onPress} style={styles.emptyAction}>
          {action.label}
        </PrimaryButton>
      ) : null}
    </View>
  );
}

/** Xato bloki + "Qayta urinish" */
export function Failed({ error, onRetry, style }: { error: string; onRetry: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.failed, style]}>
      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton icon="refresh" onPress={onRetry} style={styles.retry}>
        {copy.retry}
      </PrimaryButton>
    </View>
  );
}

// ───────── oyna ─────────

/** Pastdan chiqadigan oyna (saralash, joy tanlovi): parda bosilsa yopiladi */
export function Sheet({ visible, onClose, title, children, scroll = false }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    children
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.feed.location.close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Txt style={[font(900, 112), { fontSize: 24, letterSpacing: em(24, -0.02), flex: 1 }]}>{title}</Txt>
            <RoundButton icon="x" label={copy.feed.location.close} onPress={onClose} />
          </View>
          {body}
        </View>
      </View>
    </Modal>
  );
}

/** Oynadagi tanlov qatori (radio) */
export function OptionRow({ label, hint, selected, onPress, icon }: { label: string; hint?: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={({ pressed }) => [styles.option, pressed ? styles.optionPressed : null]}>
      {icon ? <Icon name={icon} size={22} color={colors.blue} strokeWidth={2.4} /> : null}
      <View style={styles.flex1}>
        <Txt style={[font(selected ? 800 : 600), { fontSize: 16 }]}>{label}</Txt>
        {hint ? <Txt style={{ fontSize: 13, color: colors.muted2, marginTop: 2 }}>{hint}</Txt> : null}
      </View>
      <View style={[styles.radio, selected ? styles.radioOn : null]}>{selected ? <Icon name="tick" size={14} strokeWidth={3.6} color={colors.white} /> : null}</View>
    </Pressable>
  );
}

// ───────── ro'yxat qatorlari ─────────

/** Oq kartadagi ma'lumot qatori: belgi, yorliq va qiymat */
export function InfoRow({ icon, label, value, last = false }: { icon: IconName; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last ? null : styles.rowLine]}>
      <Icon name={icon} size={20} color={colors.muted} strokeWidth={2.2} />
      <Txt style={[styles.flex1, { fontSize: 14, color: colors.muted2 }]}>{label}</Txt>
      <Txt style={[font(800), styles.infoValue]}>{value}</Txt>
    </View>
  );
}

/** Menyu qatori (profil): belgi, matn, o'ngda qiymat yoki ›; `danger` — qizil */
export function MenuRow({ icon, label, onPress, value, danger = false, last = false }: { icon: IconName; label: string; onPress: () => void; value?: string; danger?: boolean; last?: boolean }) {
  const c = danger ? colors.danger : colors.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menuRow, last ? null : styles.rowLine, pressed ? styles.optionPressed : null]}>
      <Icon name={icon} size={22} color={c} strokeWidth={2.2} />
      <Txt style={[font(700), styles.flex1, { fontSize: 16, color: c }]}>{label}</Txt>
      {value ? <Txt style={[font(800), styles.menuValue]}>{value}</Txt> : null}
      <Icon name="chevronRight" size={20} color={colors.muted2} strokeWidth={2.4} />
    </Pressable>
  );
}

/** Oq karta (radius 24) */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.whiteCard, style]}>{children}</View>;
}

/** Kartaning ichidagi kichik sarlavha ("QACHON", "SHARTLAR") */
export function CardLabel({ children }: { children: string }) {
  return <Txt style={[font(800), styles.cardLabel]}>{children.toUpperCase()}</Txt>;
}

/** Ikkinchi darajali tugma: oq, 2px qora chegara, 58px */
export function SecondaryButton({ children, onPress, icon, danger = false, disabled = false, style }: { children: string; onPress: () => void; icon?: IconName; danger?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = danger ? colors.danger : colors.ink;
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={[styles.secondary, { borderColor: c, opacity: disabled ? 0.55 : 1 }, style]}>
      {icon ? <Icon name={icon} size={20} strokeWidth={2.4} color={c} /> : null}
      <Txt style={[font(800), { fontSize: 17, color: c }]}>{children}</Txt>
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  row8: { flexDirection: "row", alignItems: "center", gap: 8 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 24 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  roundDark: { backgroundColor: "rgba(17,17,17,0.55)" },
  dot: { position: "absolute", top: 9, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.white },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, borderRadius: 999, paddingHorizontal: 16, borderWidth: 2, borderColor: colors.ink },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pct: { backgroundColor: colors.orange, borderRadius: 11, paddingHorizontal: 9, paddingTop: 5, paddingBottom: 3, transform: [{ rotate: "-3deg" }] },
  stock: { alignSelf: "flex-start", backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  old: { color: colors.muted2, textDecorationLine: "line-through" },
  image: { overflow: "hidden", justifyContent: "center", alignItems: "center" },
  letter: { position: "absolute", top: -30, right: -6, opacity: 0.14 },
  pending: { position: "absolute", left: 14, bottom: 64, fontSize: 10, letterSpacing: 1 },
  cardWrap: { marginTop: 10 },
  card: { backgroundColor: colors.white, borderRadius: 24, overflow: "hidden" },
  marks: { position: "absolute", top: 12, left: 12, right: 92, gap: 6, alignItems: "flex-start" },
  priceTile: { position: "absolute", left: 0, bottom: 0, maxWidth: "100%", backgroundColor: colors.white, borderTopRightRadius: 16, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  cardBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 6 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  storeDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 2 },
  cardPct: { position: "absolute", top: -8, right: -6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.track, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: 16, fontSize: 20, textAlign: "center" },
  emptyText: { marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.muted2, textAlign: "center" },
  emptyAction: { marginTop: 20, alignSelf: "stretch" },
  failed: { paddingVertical: 12 },
  retry: { marginTop: 12 },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(17,17,17,0.45)" },
  sheet: { maxHeight: "86%", backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10 },
  sheetScroll: { flexGrow: 0 },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 10 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: 16 },
  optionPressed: { backgroundColor: colors.track },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  infoValue: { fontSize: 15, maxWidth: "55%", textAlign: "right" },
  rowLine: { borderBottomWidth: 1.5, borderBottomColor: colors.lineSoft },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 58, paddingHorizontal: 4 },
  menuValue: { fontSize: 14, color: colors.blue },
  whiteCard: { backgroundColor: colors.white, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 6 },
  cardLabel: { fontSize: 12, letterSpacing: em(12, 0.08), color: colors.muted2, marginTop: 14, marginBottom: 6 },
  secondary: { height: 58, borderRadius: 20, borderWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.white },
});
