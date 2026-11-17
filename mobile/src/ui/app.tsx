import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
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
 * Talaba ilovasi primitivlari (kirgandan keyingi qism). Lenta kartasi, holat pilyulkasi, narx yorlig'i, foiz stikeri, oyna —
 * Lenta.dc.html / LentaFiltr.dc.html / Chegirma.dc.html; qolganlari dizaynda chizilmagan — mazmun saytdagi talaba bo'limidan
 * (T5–T8), ko'rinish app-flow uslubida: paper fon, oq kartalar (radius 24), 2px qora chegara, Archivo 900/112 sarlavhalar.
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

export const PILL: Record<PillTone, { dot: string; text: string }> = {
  open: { dot: colors.green, text: colors.greenOk },
  soon: { dot: colors.orange, text: colors.rust },
  closed: { dot: colors.idle, text: colors.ink5 },
};

/** Holat pilyulkasi (Lenta.dc.html, rasm ustida): "Hozir ochiq · 21:00 gacha" — yashil / to'q sariq / kulrang nuqta */
export function StatusPill({ deal, now, style }: { deal: Pick<FeedDeal, "live" | "closesAt" | "opensAt">; now: Date; style?: StyleProp<ViewStyle> }) {
  const pill = statusPill(deal, now);
  const tone = PILL[pill.tone];
  return (
    <View style={[styles.pill, style]}>
      <View style={[styles.pillDot, { backgroundColor: tone.dot }]} />
      <Txt numberOfLines={1} style={[font(800), { fontSize: 12, color: tone.text }]}>
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

const STICKER = {
  card: { size: 32, radius: 12, pt: 1, px: 10, pb: 4, rotate: "7deg" },
  hero: { size: 40, radius: 14, pt: 2, px: 12, pb: 5, rotate: "11deg" },
} as const;

/** Qiyshiq foiz stikeri (Lenta: rasm burchagida +7°; Chegirma: narx yorlig'i ustida +11°) */
export function PctSticker({ children, size, style }: { children: string; size: keyof typeof STICKER; style?: StyleProp<ViewStyle> }) {
  const s = STICKER[size];
  return (
    <View style={[styles.sticker, { borderRadius: s.radius, paddingTop: s.pt, paddingHorizontal: s.px, paddingBottom: s.pb, transform: [{ rotate: s.rotate }] }, style]}>
      <Txt style={[font(900, 62), { fontSize: s.size, lineHeight: Math.round(s.size * 1.05) }]}>{children}</Txt>
    </View>
  );
}

// ───────── chegirma kartasi ─────────

/** Narx plitkasi (kupon chiptasi): "26 600 so'm ~~38 000~~" yoki narxsiz matn */
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

const TAG = {
  card: { price: 26, lh: 26, cur: 13, old: 13, radius: 12, pt: 5, pr: 12, pb: 6, pl: 24, hole: 8, holeLeft: 8, note: 18 },
  hero: { price: 48, lh: 44, cur: 16, old: 14, radius: 16, pt: 12, pr: 20, pb: 12, pl: 34, hole: 12, holeLeft: 12, note: 28 },
} as const;

/**
 * Narx yorlig'i — rasm pastki chetiga osilgan oq "bilet" (2px qora chegara, chapda teshikcha, −3° qiya). Lenta: narx,
 * so'm, ustidan chizilgan eski narx; Chegirma (`hero`): ikkinchi qatorda eski narx va "12 000 tejaysiz". Narxsiz — matn.
 * `children` — yorliq bilan birga qiyshayadigan qism (Chegirmadagi foiz stikeri).
 */
export function PriceTag({ deal, size, style, children }: { deal: Pick<FeedDeal, "price" | "note" | "badge">; size: keyof typeof TAG; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const t = TAG[size];
  const old = deal.price?.old ?? null;
  return (
    <View style={[styles.tagWrap, style]}>
      <View style={[styles.tag, { borderRadius: t.radius, paddingTop: t.pt, paddingRight: t.pr, paddingBottom: t.pb, paddingLeft: t.pl }]}>
        <View style={[styles.hole, { left: t.holeLeft, width: t.hole, height: t.hole, borderRadius: t.hole / 2, marginTop: -t.hole / 2 }]} />
        {deal.price ? (
          <View style={styles.tagRow}>
            <Txt style={[font(900, 62), { fontSize: t.price, lineHeight: t.lh }]}>{formatSom(deal.price.now)}</Txt>
            <Txt style={[font(800), { fontSize: t.cur }]}>{copy.currency}</Txt>
            {size === "card" && old ? <Txt style={[font(700), styles.old, { fontSize: t.old }]}>{formatSom(old)}</Txt> : null}
          </View>
        ) : (
          <Txt numberOfLines={2} style={[font(900), { fontSize: t.note, lineHeight: Math.round(t.note * 1.1), maxWidth: size === "card" ? 220 : 230 }]}>
            {dealNote(deal)}
          </Txt>
        )}
        {size === "hero" && deal.price && old ? (
          <View style={styles.tagSub}>
            <Txt style={[font(700), styles.old, { fontSize: t.old }]}>{formatSom(old)}</Txt>
            <Txt style={[font(700), { fontSize: t.old, color: colors.greenOk }]}>{copy.deal.saves(formatSom(old - deal.price.now))}</Txt>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const ART = {
  card: { size: 82, top: 48, right: -4, opacity: 0.13 },
  hero: { size: 150, top: 105, right: -6, opacity: 0.12 },
} as const;

/** Rasmsiz chegirma: kategoriya rangi va katta, xira kategoriya nomi (Lenta/Chegirma dizaynidagi plita) */
export function CategoryArt({ tile, ink, name, size }: { tile: string; ink: string; name: string; size: keyof typeof ART }) {
  const a = ART[size];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: tile }]} importantForAccessibility="no-hide-descendants">
      <Txt numberOfLines={1} style={[font(900, 62), styles.art, { fontSize: a.size, lineHeight: a.size, top: a.top, right: a.right, opacity: a.opacity, color: ink }]}>
        {name.toUpperCase()}
      </Txt>
    </View>
  );
}

/** Chegirma rasmi yoki (rasm yo'q / ochilmadi) kategoriya plitasi */
export function DealPhoto({ src, tile, ink, name, size }: { src: string | undefined; tile: string; ink: string; name: string; size: keyof typeof ART }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <CategoryArt tile={tile} ink={ink} name={name} size={size} />;
  return (
    <Image
      source={{ uri: imageUrl(src) }}
      style={[StyleSheet.absoluteFill, { backgroundColor: tile }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * Lenta kartasi (Lenta.dc.html): oq qutisiz — 188px rasm (radius 22) ichida holat pilyulkasi, burchakda qiyshiq foiz
 * stikeri, rasm pastki chetiga osilgan narx yorlig'i; ostida nom, "do'kon · tuman · masofa" va qoldiq (oz bo'lsa rust).
 */
export function DealCard({ deal, now, categoryName, onPress }: { deal: FeedDeal; now: Date; categoryName?: string; onPress: () => void }) {
  const low = isLowStock(deal, now);
  const where = [deal.store, deal.district, deal.distanceKm !== null ? formatKm(deal.distanceKm) : null].filter(Boolean).join(" · ");
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${deal.store}, ${deal.title}, ${deal.badge}`} scale={0.985}>
      <View>
        <View style={[styles.cardImage, { backgroundColor: deal.tile }]}>
          <DealPhoto src={deal.images[0]} tile={deal.tile} ink={deal.ink} name={categoryName ?? deal.typeLabel ?? ""} size="card" />
          <StatusPill deal={deal} now={now} style={styles.cardPill} />
        </View>
        <PctSticker size="card" style={styles.cardSticker}>
          {deal.badge}
        </PctSticker>
        <PriceTag deal={deal} size="card" style={styles.cardTag} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.flex1}>
          <Txt numberOfLines={2} style={[font(800), styles.cardTitle]}>
            {deal.title}
          </Txt>
          <Txt numberOfLines={1} style={[font(600), styles.cardWhere]}>
            {where}
          </Txt>
        </View>
        <Txt style={[font(800), styles.cardLeft, { color: low ? colors.rust : colors.muted2 }]}>{copy.feed.leftCount(deal.left)}</Txt>
      </View>
    </Press>
  );
}

/** Kalit (switch): Lenta — 34×20, oynada — 46×28; yoqilgani ko'k */
export function Toggle({ on, size = "sm" }: { on: boolean; size?: "sm" | "md" }) {
  const md = size === "md";
  return (
    <View style={[md ? styles.toggleMd : styles.toggleSm, { backgroundColor: on ? colors.blue : colors.dot }]}>
      <View style={[md ? styles.knobMd : styles.knobSm, { left: md ? (on ? 21 : 3) : on ? 16 : 2 }]} />
    </View>
  );
}

/** Radio doira (LentaFiltr): 22px, tanlangani ko'k halqa va nuqta */
export function Radio({ on }: { on: boolean }) {
  return (
    <View style={[styles.radioRing, { borderColor: on ? colors.blue : colors.dot }]}>
      <View style={[styles.radioDot, { backgroundColor: on ? colors.blue : "transparent" }]} />
    </View>
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

/**
 * Pastdan chiqadigan oyna (saralash, joy tanlovi, "Qanday borasiz?", qo'lda kiritish): parda bosilsa yoki Android
 * "orqaga" — avval oyna yopiladi. Klaviatura ochilsa oyna u bilan birga ko'tariladi (`react-native-keyboard-controller`
 * Modal ichida ham ishlaydi). `close={false}` — sarlavha yonida × yo'q (Yonalish.dc.html); `titleSize` 24 / 26 / 28.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  scroll = false,
  titleSize = 24,
  close = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  scroll?: boolean;
  titleSize?: 24 | 26 | 28;
  close?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    children
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.feed.location.close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 30) }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={[styles.sheetHead, close ? styles.sheetHeadClose : styles.sheetHeadPlain]}>
            <Txt accessibilityRole="header" style={[font(900, 112), styles.flex1, { fontSize: titleSize, lineHeight: titleSize + 4, letterSpacing: em(titleSize, -0.02) }]}>
              {title}
            </Txt>
            {close ? <RoundButton icon="x" label={copy.feed.location.close} onPress={onClose} /> : null}
          </View>
          {body}
        </View>
      </KeyboardAvoidingView>
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
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", maxWidth: "100%", height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.94)" },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pct: { backgroundColor: colors.orange, borderRadius: 11, paddingHorizontal: 9, paddingTop: 5, paddingBottom: 3, transform: [{ rotate: "-3deg" }] },
  sticker: { position: "absolute", backgroundColor: colors.orange },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  old: { color: colors.muted2, textDecorationLine: "line-through" },
  tagWrap: { position: "absolute", transform: [{ rotate: "-3deg" }], transformOrigin: ["0%", "50%", 0] },
  tag: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink },
  tagRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  tagSub: { flexDirection: "row", gap: 8, marginTop: 4 },
  hole: { position: "absolute", top: "50%", backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.ink },
  art: { position: "absolute", includeFontPadding: false },
  cardImage: { height: 188, borderRadius: 22, overflow: "hidden" },
  cardPill: { position: "absolute", top: 12, left: 12, maxWidth: "72%" },
  cardSticker: { top: -8, right: -6 },
  cardTag: { left: 12, bottom: -14 },
  cardBody: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 24 },
  cardTitle: { fontSize: 19, lineHeight: 22, letterSpacing: em(19, -0.01) },
  cardWhere: { marginTop: 4, fontSize: 13, color: colors.muted2 },
  cardLeft: { marginTop: 3, fontSize: 13 },
  toggleSm: { width: 34, height: 20, borderRadius: 10 },
  knobSm: { position: "absolute", top: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white },
  toggleMd: { width: 46, height: 28, borderRadius: 14 },
  knobMd: { position: "absolute", top: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
  radioRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
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
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  sheetHeadClose: { marginTop: 14 },
  sheetHeadPlain: { marginTop: 18 },
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
