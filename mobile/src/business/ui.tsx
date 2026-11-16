import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { DiscountStatus, Period, SaleRow } from "@/api/business";
import { copy } from "@/copy";
import { clock, formatSom } from "@/lib/format";
import { colors, em, font } from "@/theme";
import { Chip } from "@/ui/app";
import { Icon, type IconName } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

/*
 * Biznes ilovasi primitivlari (dizaynda chizilmagan — mazmun saytdagi B5/B6 dan, ko'rinish talaba ilovasi primitivlari
 * uslubida: paper fon, oq kartalar, 2px qora chegara, to'q sariq urg'u — saytdagi biznes mavzusi).
 */

const som = (n: number) => `${formatSom(n)} ${copy.currency}`;
export { som };

/** Davr chiplari: Bugun · 7 kun · 30 kun */
export function PeriodChips({ value, onChange, style }: { value: Period; onChange: (p: Period) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, style]}>
      {copy.biz.periods.map((p) => (
        <Chip key={p.value} selected={value === p.value} onPress={() => onChange(p.value)}>
          {p.label}
        </Chip>
      ))}
    </ScrollView>
  );
}

/** Ko'rsatkich plitkasi: yorliq, katta raqam, izoh (ixtiyoriy rangli) */
export function Kpi({ label, value, note, tone, dark = false }: { label: string; value: string; note?: string | null; tone?: "up" | "down"; dark?: boolean }) {
  const fg = dark ? colors.white : colors.ink;
  return (
    <View style={[styles.kpi, dark ? styles.kpiDark : null]}>
      <Txt style={[font(800), styles.kpiLabel, { color: dark ? colors.line : colors.muted2 }]}>{label.toUpperCase()}</Txt>
      <Txt numberOfLines={1} adjustsFontSizeToFit style={[font(900, 62), { fontSize: 40, lineHeight: 44, color: fg }]}>
        {value}
      </Txt>
      {note ? (
        <Txt style={[font(tone ? 700 : 600), { fontSize: 13, color: tone === "up" ? (dark ? colors.green : colors.greenOk) : tone === "down" ? colors.orange : dark ? colors.line : colors.muted2 }]}>{note}</Txt>
      ) : null}
    </View>
  );
}

/** Ustunli grafik: joriy ustun to'q sariq, qolganlari qora; tagida birinchi/o'rta/oxirgi yorliq */
export function Bars({ bars, label }: { bars: { key: string; count: number; current: boolean }[]; label: (key: string) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const ticks = new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1]);
  return (
    <View>
      <View style={styles.bars} accessibilityRole="image" accessibilityLabel={bars.map((b) => `${label(b.key)}: ${b.count}`).join(", ")}>
        {bars.map((b) => (
          <View key={b.key} style={styles.barSlot}>
            <View style={[styles.bar, { height: `${b.count > 0 ? Math.max(4, (b.count / max) * 100) : 2}%`, backgroundColor: b.current ? colors.orange : b.count > 0 ? colors.ink : colors.line }]} />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {bars.map((b, i) => (
          <Txt key={b.key} style={[font(600), styles.barLabel]} numberOfLines={1}>
            {ticks.has(i) ? label(b.key) : ""}
          </Txt>
        ))}
      </View>
    </View>
  );
}

/** Gorizontal chiziq (voronka, universitetlar): yorliq, son va ulush */
export function HBar({ label, count, max, accent = false }: { label: string; count: number; max: number; accent?: boolean }) {
  return (
    <View style={styles.hbar}>
      <View style={styles.hbarHead}>
        <Txt numberOfLines={1} style={[font(700), styles.flex1, { fontSize: 14 }]}>
          {label}
        </Txt>
        <Txt style={[font(900), { fontSize: 15 }]}>{count}</Txt>
      </View>
      <View style={styles.hbarTrack}>
        <View style={[styles.hbarFill, { width: `${max > 0 ? Math.max(count > 0 ? 3 : 0, (count / max) * 100) : 0}%`, backgroundColor: accent ? colors.orange : colors.ink }]} />
      </View>
    </View>
  );
}

const STATUS_TONE: Record<DiscountStatus, { bg: string; fg: string }> = {
  ACTIVE: { bg: colors.greenTint, fg: colors.greenOk },
  PENDING_REVIEW: { bg: colors.peach, fg: "#9A3A0E" },
  PAUSED: { bg: colors.track, fg: colors.muted },
  DRAFT: { bg: colors.track, fg: colors.muted },
  REJECTED: { bg: colors.dangerBg, fg: colors.danger },
  ENDED: { bg: colors.track, fg: colors.muted2 },
};

/** Holat yorlig'i (chegirma) */
export function StatusBadge({ status, children }: { status: DiscountStatus; children?: string }) {
  const tone = STATUS_TONE[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Txt numberOfLines={1} style={[font(800), { fontSize: 12, color: tone.fg }]}>
        {children ?? copy.biz.discounts.state[status]}
      </Txt>
    </View>
  );
}

/** Rangli yorliq (buyurtma holati, smena) */
export function Tag({ children, tone = "muted" }: { children: string; tone?: "green" | "orange" | "muted" | "danger" }) {
  const t = { green: STATUS_TONE.ACTIVE, orange: STATUS_TONE.PENDING_REVIEW, muted: STATUS_TONE.PAUSED, danger: STATUS_TONE.REJECTED }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Txt numberOfLines={1} style={[font(800), { fontSize: 12, color: t.fg }]}>
        {children}
      </Txt>
    </View>
  );
}

/** Sotuv qatori: vaqt, mahsulot, talaba · kassir, summa */
export function SaleItem({ sale, onPress, last = false, showCashier = true }: { sale: Pick<SaleRow, "at" | "item" | "student" | "university" | "cashier" | "paid">; onPress: () => void; last?: boolean; showCashier?: boolean }) {
  const who = [sale.student, sale.university, showCashier ? sale.cashier : null].filter(Boolean).join(" · ");
  return (
    <Press onPress={onPress} accessibilityRole="button" scale={0.985} style={[styles.sale, last ? null : styles.rowLine]}>
      <Txt style={[font(800), styles.saleTime]}>{clock(sale.at)}</Txt>
      <View style={styles.flex1}>
        <Txt numberOfLines={1} style={[font(800), { fontSize: 15 }]}>
          {sale.item}
        </Txt>
        <Txt numberOfLines={1} style={{ fontSize: 13, color: colors.muted2, marginTop: 2 }}>
          {who}
        </Txt>
      </View>
      <Txt style={[font(900), { fontSize: 15 }]}>{formatSom(sale.paid)}</Txt>
    </Press>
  );
}

/** Bo'lim sarlavhasi kartaning ustida: "VORONKA" + o'ngda havola */
export function Section({ title, action, children, style }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <Txt style={[font(900, 112), styles.sectionTitle]}>{title}</Txt>
        {action ? (
          <Press onPress={action.onPress} accessibilityRole="link" hitSlop={8}>
            <Txt style={[font(800), { fontSize: 14, color: colors.ink, textDecorationLine: "underline" }]}>{action.label}</Txt>
          </Press>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Qora banner (yangi buyurtmalar): belgi, matn, › */
export function Banner({ icon, title, text, onPress, hot = false }: { icon: IconName; title: string; text: string; onPress: () => void; hot?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" scale={0.985} style={[styles.banner, { backgroundColor: hot ? colors.orange : colors.ink }]}>
      <Icon name={icon} size={26} color={hot ? colors.ink : colors.white} strokeWidth={2.4} />
      <View style={styles.flex1}>
        <Txt style={[font(900), { fontSize: 17, color: hot ? colors.ink : colors.white }]}>{title}</Txt>
        <Txt style={{ fontSize: 13, color: hot ? colors.ink : colors.line, marginTop: 2 }}>{text}</Txt>
      </View>
      <Icon name="chevronRight" size={22} color={hot ? colors.ink : colors.white} strokeWidth={2.6} />
    </Press>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  chips: { gap: 8, paddingHorizontal: 24 },
  kpi: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 4 },
  kpiDark: { backgroundColor: colors.ink },
  kpiLabel: { fontSize: 11, letterSpacing: em(11, 0.08) },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 3 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { borderRadius: 4, minHeight: 2 },
  barLabels: { flexDirection: "row", gap: 3, marginTop: 6 },
  barLabel: { flex: 1, fontSize: 10, color: colors.muted2, textAlign: "center", overflow: "visible" },
  hbar: { gap: 6 },
  hbarHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  hbarTrack: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: "hidden" },
  hbarFill: { height: "100%", borderRadius: 5 },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  sale: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowLine: { borderBottomWidth: 1.5, borderBottomColor: colors.lineSoft },
  saleTime: { fontSize: 13, color: colors.muted2, width: 44 },
  section: { marginTop: 22 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 22, letterSpacing: em(22, -0.02) },
  banner: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, padding: 18 },
});
