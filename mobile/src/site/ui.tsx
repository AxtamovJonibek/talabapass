import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, em, font } from "@/theme";
import { Icon, isIconName, type IconName } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

/*
 * Saytdagi `src/components/ui` primitivlarining React Native nusxalari — ilova = saytning 390px ko'rinishi (C qismi).
 * Qiymatlar saytdagi Tailwind klasslaridan (izohda manba) va `globals.css` tokenlaridan aynan ko'chirilgan; solishtirish —
 * `node scripts/app-compare.mjs`. Saytda o'zgarsa, shu yerda ham.
 */

/** Saytdagi `font-mono`: Archivo (400) + tabular raqamlar */
export const mono = (weight: 400 | 600 | 700 = 400): TextStyle => ({ ...font(weight), fontVariant: ["tabular-nums"] });

/** `shadow-card`: 0 14px 24px -18px rgb(20 20 20 / .55) */
export const shadowCard: ViewStyle = { boxShadow: "0 14px 24px -18px rgba(20, 20, 20, 0.55)" };

// ───────── holat pilyulkasi (ui/status-pill.tsx) ─────────

const DOT = { open: colors.greenLive, soon: colors.orange, closed: colors.placeholder } as const;
export type PillTone = keyof typeof DOT;

/** h-7, rounded-full, px-2.5, 13px semibold; `onImage` — bg-white/80, ring-1 ink/10, shadow-pill */
export function StatusPill({ tone, onImage = false, children, style }: { tone: PillTone; onImage?: boolean; children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.pill, onImage ? s.pillImage : { backgroundColor: colors.surface }, style]} testID="status-pill">
      <View style={[s.pillDot, { backgroundColor: DOT[tone] }]} />
      <Txt numberOfLines={1} style={[font(600), s.pillText]}>
        {children}
      </Txt>
    </View>
  );
}

/** "−30%", "1+1": −3°, rounded-11, bg-orange, 900 / 62%, 46px (lg — 64px) */
export function PctBadge({ children, size = "md", style }: { children: string; size?: "md" | "lg"; style?: StyleProp<ViewStyle> }) {
  const lg = size === "lg";
  return (
    <View style={[s.pct, lg ? s.pctLg : null, style]}>
      <Txt style={[font(900, 62), { fontSize: lg ? 64 : 46, lineHeight: (lg ? 64 : 46) * 0.9 }]}>{children}</Txt>
    </View>
  );
}

/** Zaxira yorlig'i "Tez tugayapti · 2/20": mono 11 uppercase, hot — qora fonda to'q sariq */
export function DealTag({ hot, children }: { hot: boolean; children: string }) {
  return (
    <View style={[s.tag, { backgroundColor: hot ? colors.ink : colors.white }]}>
      <Txt style={[mono(600), s.tagText, { color: hot ? colors.orange : colors.ink }]}>{children.toUpperCase()}</Txt>
    </View>
  );
}

// ───────── lenta kartasi (ui/feed-card.tsx) ─────────

const STATUS_TONE: Record<"hot" | "open" | "later", TextStyle> = {
  hot: { ...font(600), color: colors.rust },
  open: { color: colors.greenSite },
  later: { color: colors.muted },
};

export type FeedCardProps = {
  badge: string;
  store: string;
  where?: string;
  title: string;
  price?: { now: string; old?: string; currency: string };
  note?: string;
  saves?: string | null;
  marks?: ReactNode;
  status: string;
  statusTone: "hot" | "open" | "later";
  image?: string;
  pendingLabel: string;
  tileColor: string;
  inkColor: string;
  onPress: () => void;
};

/** "Lenta B · Jurnal": 210px rasm (foiz, pilyulka, narx plitkasi), chipta tishlari, uzuq chiziq, biznes, nom, holat */
export function FeedCard({ badge, store, where, title, price, note, saves, marks, status, statusTone, image, pendingLabel, tileColor, inkColor, onPress }: FeedCardProps) {
  const letter = store.trim().charAt(0).toUpperCase();
  return (
    <Press onPress={onPress} accessibilityRole="link" accessibilityLabel={`${title}, ${store}`} scale={0.985} style={[s.card, shadowCard]}>
      <View style={s.cardClip}>
        <View style={[s.cardImage, { backgroundColor: tileColor }]}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <>
              <Txt style={[font(900, 125), s.cardLetter, { color: inkColor }]}>{letter}</Txt>
              <Txt style={[mono(), s.pending, marks ? { bottom: 62 } : { top: 14 }, { color: inkColor }]}>{pendingLabel.toUpperCase()}</Txt>
            </>
          )}
          {marks}
          <View style={s.priceTile}>
            {price ? (
              <>
                <Txt style={[font(900, 75), s.priceNow]}>{price.now}</Txt>
                <Txt style={[font(700), s.priceCur]}>{price.currency}</Txt>
                {price.old ? <Txt style={[mono(), s.priceOld]}>{price.old}</Txt> : null}
              </>
            ) : (
              <Txt style={[font(900, 75), s.note]}>{note}</Txt>
            )}
          </View>
        </View>
        <View style={[s.notch, { left: -11 }]} />
        <View style={[s.notch, { right: -11 }]} />
        <View style={s.dashed} />
        <View style={s.cardBody}>
          <View style={s.storeRow}>
            <View style={[s.storeDot, { backgroundColor: inkColor }]}>
              <Txt style={[font(900), { fontSize: 11, color: tileColor }]}>{letter}</Txt>
            </View>
            <Txt numberOfLines={1} style={[mono(), s.storeText]}>
              <Txt style={[font(600), { fontSize: 11, color: colors.ink }]}>{store}</Txt>
              {where ? ` · ${where.toUpperCase()}` : ""}
            </Txt>
          </View>
          <Txt style={[font(800, 108), s.cardTitle]}>{title}</Txt>
          <View style={s.cardFoot}>
            <Txt style={[font(700), s.saves]}>{saves ?? ""}</Txt>
            <Txt style={[mono(), s.status, STATUS_TONE[statusTone]]}>{status}</Txt>
          </View>
        </View>
      </View>
      {/* Foiz yorlig'i kartadan sal chiqib turadi */}
      <PctBadge style={s.cardPct}>{badge}</PctBadge>
    </Press>
  );
}

// ───────── kategoriya chipi (ui/category-pill.tsx) ─────────

export function CategoryPill({ selected, label, icon, tileColor, inkColor, onPress }: { selected: boolean; label: string; icon: string; tileColor: string; inkColor: string; onPress: () => void }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      scale={0.96}
      style={[s.cat, selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : null]}
    >
      <View style={[s.catDot, { backgroundColor: selected ? colors.orange : tileColor }]}>
        <Icon name={isIconName(icon) ? icon : "all"} size={17} color={selected ? colors.ink : inkColor} />
      </View>
      <Txt style={[font(700), s.catText, selected ? { color: colors.white } : null]}>{label}</Txt>
    </Press>
  );
}

/** Kategoriyalar qatori (student/feed/category-chips.tsx): gorizontal, gap 8, chetlarida 16px */
export function CategoryRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

// ───────── lenta boshqaruvi (toggle-pill, dropdown, view-switch) ─────────

/** "Hozir ochiq": h-11, rounded-22, px-4, 14 bold; yoqilganda ko'k */
export function TogglePill({ pressed, onChange, label }: { pressed: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Press onPress={() => onChange(!pressed)} accessibilityRole="button" accessibilityState={{ selected: pressed }} scale={0.97} style={[s.chipBox, pressed ? s.chipBlue : null]}>
      <View style={[s.liveDot, { backgroundColor: pressed ? colors.white : colors.greenLive }]} />
      <Txt style={[font(700), s.chipText, pressed ? { color: colors.white } : null]}>{label}</Txt>
    </Press>
  );
}

/** Saralash tugmasi: h-11, rounded-22, px-4, "Saralash: Eng yaqin ▾" (ro'yxat — pastdan oyna) */
export function DropdownChip({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} scale={0.97} style={s.chipBox}>
      <Txt style={[font(700), s.chipText]}>
        <Txt style={[font(700), { fontSize: 14, color: colors.muted }]}>{label}:</Txt> {value}
      </Txt>
      <Icon name="chevronDown" size={14} />
    </Press>
  );
}

/** "Ro'yxat | Xarita": h-11, p-[3px], tanlangani ko'k */
export function ViewSwitch<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <View style={s.switch} accessibilityRole="radiogroup">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          style={[s.switchItem, o.value === value ? { backgroundColor: colors.blue } : null]}
        >
          <Txt style={[font(700), s.chipText, o.value === value ? { color: colors.white } : null]}>{o.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

// ───────── qidiruv, qo'ng'iroq, suzuvchi tugma ─────────

/** SearchField underline: h-11, pastki 2px qora chiziq, 17 semibold, o'ngda lupa 20 */
export function SearchUnderline({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <View style={s.search}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#7A776F"
        selectionColor={colors.blue}
        accessibilityLabel={label}
        returnKeyType="search"
        autoCorrect={false}
        maxFontSizeMultiplier={1.25}
        style={[font(600), s.searchInput]}
      />
      <Icon name="search" size={20} />
    </View>
  );
}

/** BellButton: 44px oq doira, o'qilmagani bo'lsa to'q sariq nuqta */
export function BellButton({ unread, onPress, label }: { unread: boolean; onPress: () => void; label: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scale={0.94} style={s.bell}>
      <Icon name="bell" size={20} />
      {unread ? <View style={s.bellDot} /> : null}
    </Press>
  );
}

/** Lenta ustidagi "Xarita" / "Ro'yxat": h-12, rounded-full, bg-ink, px-5, 15 bold oq; pastki menyudan 100px yuqorida */
export function FloatButton({ icon, label, onPress, bottom }: { icon?: IconName; label: string; onPress: () => void; bottom: number }) {
  return (
    <View pointerEvents="box-none" style={[s.floatWrap, { bottom }]}>
      <Press onPress={onPress} accessibilityRole="button" scale={0.97} style={s.float}>
        {icon ? <Icon name={icon} size={18} color={colors.white} /> : null}
        <Txt style={[font(700), { fontSize: 15, color: colors.white }]}>{label}</Txt>
      </Press>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { height: 28, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, alignSelf: "flex-start" },
  pillImage: { backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "rgba(20,20,20,0.1)", boxShadow: "0 1px 3px rgba(20,20,20,0.1)" },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 13, lineHeight: 15, color: colors.ink, flexShrink: 1 },
  pct: { transform: [{ rotate: "-3deg" }], borderRadius: 11, backgroundColor: colors.orange, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  pctLg: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start" },
  tagText: { fontSize: 11, letterSpacing: em(11, 0.08) },
  card: { borderRadius: 4, backgroundColor: colors.white },
  cardClip: { borderRadius: 4, overflow: "hidden", backgroundColor: colors.white },
  cardImage: { height: 210, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardLetter: { position: "absolute", top: -40, right: -10, fontSize: 260, lineHeight: 260, opacity: 0.14 },
  pending: { position: "absolute", left: 14, fontSize: 10, letterSpacing: em(10, 0.1) },
  priceTile: { position: "absolute", left: 0, bottom: 0, flexDirection: "row", alignItems: "baseline", gap: 8, backgroundColor: colors.white, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  priceNow: { fontSize: 32, lineHeight: 32 },
  priceCur: { fontSize: 13 },
  priceOld: { fontSize: 12, color: colors.muted2, textDecorationLine: "line-through" },
  note: { fontSize: 18, lineHeight: 20 },
  notch: { position: "absolute", top: 199, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper },
  dashed: { marginHorizontal: 18, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.dash },
  cardBody: { gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  storeDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  storeText: { flex: 1, fontSize: 11, letterSpacing: em(11, 0.04), color: colors.muted },
  cardTitle: { fontSize: 22, lineHeight: 23, letterSpacing: em(22, -0.02) },
  cardFoot: { marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  saves: { fontSize: 12, color: colors.greenSite },
  status: { fontSize: 12, textAlign: "right", marginLeft: "auto" },
  cardPct: { position: "absolute", top: -10, right: -10, zIndex: 3 },
  cat: { height: 42, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 21, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingLeft: 6, paddingRight: 14 },
  catDot: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  catText: { fontSize: 14 },
  catRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chipBox: { height: 44, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 16 },
  chipBlue: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { fontSize: 14, color: colors.ink },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  switch: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, padding: 3 },
  switchItem: { height: 36, justifyContent: "center", borderRadius: 19, paddingHorizontal: 14 },
  search: { height: 44, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 2, borderColor: colors.ink },
  searchInput: { flex: 1, minWidth: 0, fontSize: 17, color: colors.ink, padding: 0 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.white },
  floatWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 20 },
  float: { height: 48, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: colors.ink, paddingHorizontal: 20 },
});
