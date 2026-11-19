import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { Period, Stats, StatsOffer } from "@/api/business";
import { copy } from "@/copy";
import { discountBadge } from "@/lib/discount";
import { clock, formatMinute, formatMln, formatSom, MINUS, toTashkent } from "@/lib/format";
import { colors, font } from "@/theme";
import { Press, Rich, Txt } from "@/ui/kit";
import { EmptyBlock, mono } from "./ui";

/*
 * B6 statistika bloklari — saytdagi `components/business/stats/blocks.tsx` ning telefon (390px) ko'rinishi:
 * bloklar ustma-ust, keng jadvallar va issiqlik xaritasi gorizontal suriladi.
 */

const HEAT = [colors.heat0, colors.heat1, colors.heat2, colors.heat3, colors.heat4] as const;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const pct1 = (part: number, whole: number) => (whole > 0 ? (Math.round((part / whole) * 1000) / 10).toFixed(1) : "0.0");
const signed = (n: number) => `${n >= 0 ? "+" : MINUS}${Math.abs(n)}`;
const niceMax = (max: number) => (max <= 10 ? Math.max(2, Math.ceil(max / 2) * 2) : Math.ceil(max / (max <= 100 ? 10 : 50)) * (max <= 100 ? 10 : 50));
const barHeight = (count: number, axisMax: number) => (count <= 0 || axisMax <= 0 ? 2 : Math.max(3, (count / axisMax) * 100));
const heatLevel = (count: number, max: number) => (count <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4))));
export const receiptNo = (n: number) => String(n).padStart(6, "0");

/** Saytdagi `Segmented` (md): kulrang yo'lak, oq faol bo'lak; `badge` — yozuv yonidagi son (buyurtmalar) */
export function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string; badge?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => (
        <Press key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} scale={0.97} style={[s.segItem, o.value === value ? s.segOn : null]}>
          <Txt style={[font(700), { fontSize: 14 }]}>{o.label}</Txt>
          {o.badge}
        </Press>
      ))}
    </View>
  );
}

/** Sarlavha osti sana: "Chorshanba, 18-noyabr · 16:49" */
export function dateLine(now: Date): string {
  const local = toTashkent(now);
  const weekday = copy.weekdays[(local.date.getUTCDay() + 6) % 7] ?? "";
  return copy.biz.stats.dateLine(weekday, local.date.getUTCDate(), copy.months[local.date.getUTCMonth()] ?? "", formatMinute(local.minute));
}

const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;
const CardTitle = ({ children }: { children: ReactNode }) => (
  <Txt accessibilityRole="header" style={[font(800), s.cardTitle]}>
    {children}
  </Txt>
);

/** `StatCard` (ui/stat-card.tsx) */
function StatCard({ label, value, note, dark = false, valueColor }: { label: string; value: string; note?: string | null; dark?: boolean; valueColor?: string }) {
  return (
    <View style={[s.stat, dark ? { backgroundColor: colors.ink } : null]}>
      <Txt style={{ fontSize: 13, color: dark ? colors.fog2 : colors.muted }}>{label}</Txt>
      <Txt numberOfLines={1} style={[font(900, 75), s.statValue, { color: valueColor ?? (dark ? colors.paper : colors.ink) }]}>
        {value}
      </Txt>
      {note ? <Txt style={[dark ? font(700) : null, { marginTop: 8, fontSize: 12, color: dark ? colors.mint : colors.muted }]}>{note}</Txt> : null}
    </View>
  );
}

export function Kpis({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const k = stats.kpi;
  const delta = k.delta ? (stats.period === 1 ? t.deltaDay : stats.period === 7 ? t.deltaWeek : t.deltaMonth)(signed(k.delta.value)) : null;
  return (
    <View style={s.stack}>
      <StatCard dark label={t.sold} value={formatSom(k.sold)} note={delta} />
      <StatCard label={t.revenue} value={formatMln(k.revenue)} note={t.revenueNote(formatSom(k.average))} />
      <StatCard label={t.given} value={formatMln(k.discount)} note={t.givenNote} valueColor={colors.rust} />
      <StatCard label={t.fresh} value={formatSom(k.fresh)} note={t.freshNote} />
      <View style={s.stat}>
        <Txt style={{ fontSize: 13, color: colors.muted }}>{t.returning}</Txt>
        <Txt style={[font(900, 75), s.statValue]}>{k.returningPercent}%</Txt>
        <View style={s.returnTrack}>
          <View style={[s.returnFill, { width: `${k.returningPercent}%` }]} />
        </View>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legend}>
      <View style={[s.swatch, { backgroundColor: color }]} />
      <Txt style={s.small}>{label}</Txt>
    </View>
  );
}

/** Kunlik (soatlik) sotuvlar grafigi */
export function SalesChart({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const { bars, hourly } = stats.chart;
  const axisMax = niceMax(Math.max(0, ...bars.map((b) => b.count)));
  const week = stats.period === 7;
  const gap = hourly || week ? 8 : 4;
  const label = (key: string, i: number) => {
    if (hourly) return key;
    const dd = key.slice(8, 10);
    if (week) return `${copy.weekdaysShort[(new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7]} ${Number(dd)}`;
    return (bars.length - 1 - i) % 5 === 0 ? `${dd}.${key.slice(5, 7)}` : "";
  };
  return (
    <Card>
      <View style={s.headWrap}>
        <CardTitle>{t.chart[stats.period]}</CardTitle>
        <View style={s.legends}>
          <Legend color={colors.ink} label={t.legendSales} />
          <Legend color={colors.orange} label={hourly ? t.legendHour : t.legendDay} />
        </View>
      </View>
      <View style={s.chartRow}>
        <View style={s.axis}>
          {[axisMax, axisMax / 2, 0].map((v) => (
            <Txt key={v} style={[mono(), s.axisText]}>
              {v}
            </Txt>
          ))}
        </View>
        <View style={s.flex1}>
          <View style={[s.plot, { gap }]} accessibilityRole="image" accessibilityLabel={t.chart[stats.period]}>
            <View style={[s.gridLine, { top: 0 }]} />
            <View style={[s.gridLine, { top: "50%" }]} />
            {bars.map((bar) => (
              <View
                key={bar.key}
                style={[s.bar, { height: `${barHeight(bar.count, axisMax)}%`, backgroundColor: bar.current ? colors.orange : bar.count > 0 ? colors.ink : colors.track }]}
              />
            ))}
          </View>
          <View style={[s.row, { gap, marginTop: 6 }]}>
            {bars.map((bar, i) => (
              <View key={bar.key} style={s.barLabelBox}>
                <Txt style={[mono(), s.barLabel]}>
                  {label(bar.key, i)}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}

function FunnelRow({ label, count, share, width, color }: { label: string; count: number; share?: string; width: string; color: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={s.between}>
        <Txt style={{ fontSize: 13 }}>{label}</Txt>
        <Txt style={[mono(700), { fontSize: 13 }]}>
          {formatSom(count)}
          {share ? <Txt style={[mono(), { fontSize: 13, color: colors.muted }]}> · {share}</Txt> : null}
        </Txt>
      </View>
      <View style={[s.funnelBar, { width: width as `${number}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Voronka: ko'rdi → QR oldi → sotib oldi */
export function Funnel({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const { views, qr, sold } = stats.funnel;
  const width = (n: number) => `${Math.max(views > 0 ? (n / views) * 100 : 0, 1.5)}%`;
  return (
    <Card style={{ gap: 14 }}>
      <View style={s.betweenBase}>
        <CardTitle>{t.funnel}</CardTitle>
        <Txt style={s.small}>{t.periodName[stats.period]}</Txt>
      </View>
      <FunnelRow label={t.views} count={views} width="100%" color={colors.track} />
      <FunnelRow label={t.qr} count={qr} share={`${pct1(qr, views)}%`} width={width(qr)} color={colors.blue} />
      <FunnelRow label={t.bought} count={sold} share={`${pct(sold, qr)}%`} width={width(sold)} color={colors.orange} />
      {qr > sold ? <Txt style={[s.note, s.loose, s.topLine]}>{t.lost(formatSom(qr - sold))}</Txt> : null}
    </Card>
  );
}

/** Hafta kuni × soat issiqlik xaritasi (oxirgi 30 kun) */
export function Heatmap({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const { hours, cells, busiest, quietest } = stats.heat;
  const grid = new Map(cells.map(([day, hour, count]) => [`${day}:${hour}`, count]));
  const max = Math.max(0, ...cells.map((c) => c[2]));
  const [box, setBox] = useState(0);
  const width = Math.max(520, box);
  return (
    <Card>
      <View style={s.headWrap}>
        <Txt style={[font(800), s.cardTitle]}>
          {t.heat} <Txt style={s.small}>· {t.heatNote}</Txt>
        </Txt>
        <View style={s.heatLegend}>
          <Txt style={s.tiny}>{t.less}</Txt>
          {HEAT.map((c) => (
            <View key={c} style={[s.heatSwatch, { backgroundColor: c }]} />
          ))}
          <Txt style={s.tiny}>{t.more}</Txt>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
        <View style={{ width, gap: 4 }}>
          <View style={s.heatRow}>
            <View style={s.heatDay} />
            {hours.map((h) => (
              <Txt key={h} style={[mono(), s.heatHour]}>
                {String(h).padStart(2, "0")}
              </Txt>
            ))}
          </View>
          {copy.weekdaysShort.map((day, row) => (
            <View key={day} style={s.heatRow}>
              <View style={[s.heatDay, s.heatCellH]}>
                <Txt style={[font(700), { fontSize: 12, color: colors.muted }]}>{day}</Txt>
              </View>
              {hours.map((hour) => (
                <View key={hour} style={[s.heatCell, { backgroundColor: HEAT[heatLevel(grid.get(`${row}:${hour}`) ?? 0, max)] }]} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {busiest ? (
        <Txt style={[s.note, { marginTop: 14 }]}>
          <Rich
            text={t.busiest(copy.weekdays[busiest.weekday] ?? "", formatMinute(busiest.from * 60), formatMinute(busiest.to * 60))}
            style={s.note}
            boldStyle={{ fontSize: 13 }}
          />
          {quietest !== null ? ` ${t.quietest(copy.weekdays[quietest] ?? "")}` : ""}
        </Txt>
      ) : (
        <Txt style={[s.note, { marginTop: 14 }]}>{t.heatEmpty}</Txt>
      )}
    </Card>
  );
}

/** Universitetlar bo'yicha sotuvlar */
export function Universities({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const rows = stats.universities;
  const top = Math.max(1, ...rows.map((u) => u.count));
  return (
    <Card>
      <View style={s.betweenBase}>
        <CardTitle>{t.universities}</CardTitle>
        <Txt style={s.small}>{t.universitiesSub(t.periodName[stats.period] ?? "")}</Txt>
      </View>
      {rows.length === 0 ? (
        <Txt style={[s.note, { marginTop: 16 }]}>{t.noSales}</Txt>
      ) : (
        <View style={{ marginTop: 16, gap: 12 }}>
          {rows.map((u) => (
            <View key={u.name || "others"} style={{ gap: 5 }}>
              <View style={s.between}>
                <Txt style={[font(600), { fontSize: 13 }]}>{u.name || t.others}</Txt>
                <Txt style={[mono(), { fontSize: 13 }]}>{formatSom(u.count)}</Txt>
              </View>
              <View style={s.uniTrack}>
                <View style={[s.uniFill, { width: `${Math.round((u.count / top) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const STATE_COLOR: Record<string, string> = { ACTIVE: colors.greenSite, ENDED: colors.muted2, PENDING_REVIEW: colors.warn, PAUSED: colors.muted2, REJECTED: colors.danger };
function Cell({ w, right = false, children, style }: { w: number; right?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: w, paddingHorizontal: 8, justifyContent: "center", alignItems: right ? "flex-end" : "flex-start" }, style]}>{children}</View>;
}

function offerState(o: StatsOffer): string {
  return o.ended || o.status === "DRAFT" || o.status === "ENDED" ? "ENDED" : o.status;
}

/** "Chegirmalar bo'yicha": har chegirma nechta sotilgani (telefonda ro'yxat, keng jadval emas) */
export function OffersTable({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const total = stats.offerTotals;
  return (
    <Card>
      <View style={s.headWrap}>
        <CardTitle>{t.offers}</CardTitle>
      </View>
      {stats.offers.length === 0 ? (
        <View style={{ marginTop: 12 }}>
          <EmptyBlock text={t.offersEmpty} action={t.offersAdd} onAction={() => router.push("/biz/discount/new")} flat />
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {stats.offers.map((o) => {
            const badge = discountBadge(o);
            const state = offerState(o);
            return (
              <View key={o.id} style={[s.row, s.td, { alignItems: "center", gap: 10, paddingVertical: 12 }]}>
                {badge ? (
                  <View style={s.offerBadge}>
                    <Txt style={[font(900, 70), { fontSize: 14, textAlign: "center" }]}>{badge}</Txt>
                  </View>
                ) : null}
                <View style={s.flex1}>
                  <Txt numberOfLines={2} style={[font(700), { fontSize: 14 }]}>
                    {o.title}
                  </Txt>
                  <Txt style={s.tiny}>
                    <Txt style={[font(700), { fontSize: 11, color: STATE_COLOR[state] }]}>{t.state[state]}</Txt>
                    {` · ${t.offerLine(formatSom(o.views), formatSom(o.qr), formatSom(o.revenue))}`}
                  </Txt>
                </View>
                <Txt style={[font(800), { fontSize: 18 }]}>{t.soldCount(formatSom(o.sold))}</Txt>
              </View>
            );
          })}
          <View style={[s.row, { justifyContent: "space-between", paddingTop: 12 }]}>
            <Txt style={[font(700), { fontSize: 14 }]}>{t.col.total}</Txt>
            <Txt style={[font(800), { fontSize: 14 }]}>{`${t.soldCount(formatSom(total.sold))} · ${formatSom(total.revenue)} ${copy.currency}`}</Txt>
          </View>
        </View>
      )}
    </Card>
  );
}

// Sotuvlar jadvali (min-w 600): sana, vaqt, chek, talaba, mahsulot, kassir, to'landi, PDF
const SALE_COLS = { date: 64, time: 55, receipt: 68, student: 138, item: 197, cashier: 78, paid: 63, pdf: 56 } as const;

/** Sotuvlar jadvali: B6 "Oxirgi sotuvlar" va "Sotuvlar va cheklar" uchun */
export function SalesTable({ sales, withDate = false, pdf }: { sales: Stats["sales"]; withDate?: boolean; pdf?: (id: string) => void }) {
  const h = copy.biz.stats.sale;
  const cols: [keyof typeof SALE_COLS, string, boolean][] = [
    ...(withDate ? [["date", h.date, false] as [keyof typeof SALE_COLS, string, boolean]] : []),
    ["time", h.time, false],
    ["receipt", h.receipt, false],
    ["student", h.student, false],
    ["item", h.item, false],
    ["cashier", h.cashier, false],
    ["paid", h.paid, true],
    ...(pdf ? [["pdf", "", true] as [keyof typeof SALE_COLS, string, boolean]] : []),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[s.row, s.th]}>
          {cols.map(([key, label, right]) => (
            <Cell key={key} w={SALE_COLS[key]} right={right} style={s.saleTh}>
              <Txt style={[font(600), { fontSize: 12, color: colors.muted }]}>{label}</Txt>
            </Cell>
          ))}
        </View>
        {sales.map((sale) => {
          const local = toTashkent(new Date(sale.at)).date.toISOString();
          return (
            <View key={sale.id} style={[s.row, s.td]}>
              {withDate ? (
                <Cell w={SALE_COLS.date} style={s.saleTd}>
                  <Txt style={[mono(), { fontSize: 14 }]}>{`${local.slice(8, 10)}.${local.slice(5, 7)}`}</Txt>
                </Cell>
              ) : null}
              <Cell w={SALE_COLS.time} style={s.saleTd}>
                <Txt style={[mono(), { fontSize: 14 }]}>{clock(sale.at)}</Txt>
              </Cell>
              <Cell w={SALE_COLS.receipt} style={s.saleTd}>
                <Txt style={[mono(), { fontSize: 14, color: colors.muted }]}>{receiptNo(sale.receiptNo)}</Txt>
              </Cell>
              <Cell w={SALE_COLS.student} style={s.saleTd}>
                <Txt style={{ fontSize: 14 }}>
                  <Txt style={[font(700), { fontSize: 14 }]}>{sale.student}</Txt>
                  {sale.university ? <Txt style={{ fontSize: 14, color: colors.muted }}> · {sale.university}</Txt> : null}
                </Txt>
              </Cell>
              <Cell w={SALE_COLS.item} style={s.saleTd}>
                <Txt style={{ fontSize: 14 }}>{sale.item}</Txt>
              </Cell>
              <Cell w={SALE_COLS.cashier} style={s.saleTd}>
                <Txt style={{ fontSize: 14, color: colors.muted }}>{sale.cashier}</Txt>
              </Cell>
              <Cell w={SALE_COLS.paid} right style={s.saleTd}>
                <Txt style={[mono(600), { fontSize: 14 }]}>{formatSom(sale.paid)}</Txt>
              </Cell>
              {pdf ? (
                <Cell w={SALE_COLS.pdf} right style={s.saleTd}>
                  <Press onPress={() => pdf(sale.id)} accessibilityRole="link" scale={0.96}>
                    <Txt style={[font(700), { fontSize: 13, color: colors.rust }]}>PDF</Txt>
                  </Press>
                </Cell>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** B6 "Oxirgi sotuvlar" */
export function RecentSales({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  return (
    <Card>
      <View style={[s.between, { alignItems: "center" }]}>
        <CardTitle>{t.recent}</CardTitle>
        <View style={s.legend}>
          <View style={s.liveDot} />
          <Txt style={[font(700), { fontSize: 12, color: colors.greenSite }]}>{t.live}</Txt>
        </View>
      </View>
      <View style={{ marginTop: 10 }}>{stats.sales.length === 0 ? <Txt style={[s.note, s.loose]}>{t.recentEmpty}</Txt> : <SalesTable sales={stats.sales} />}</View>
      <Press onPress={() => router.navigate("/panel/sales")} accessibilityRole="link" scale={0.98} style={s.allLink}>
        <Txt style={[font(700), { fontSize: 14, color: colors.rust }]}>{t.allSales}</Txt>
      </Press>
    </Card>
  );
}

/** Kassirlar (30 kun) — qora blok */
export function CashierBars({ stats }: { stats: Stats }) {
  const t = copy.biz.stats;
  const { rows, rejected } = stats.cashiers;
  const top = Math.max(1, ...rows.map((c) => c.count));
  return (
    <View style={[s.card, { backgroundColor: colors.ink, gap: 14 }]}>
      <Txt accessibilityRole="header" style={[font(800), s.cardTitle, { color: colors.paper }]}>
        {t.cashiers}
      </Txt>
      {rows.length === 0 ? <Txt style={{ fontSize: 13, color: colors.fog2 }}>{t.cashiersEmpty}</Txt> : null}
      {rows.map((c) => (
        <View key={c.name} style={{ gap: 6 }}>
          <View style={s.between}>
            <Txt style={{ fontSize: 14, color: colors.paper }}>{c.name}</Txt>
            <Txt style={[mono(700), { fontSize: 14, color: colors.paper }]}>{formatSom(c.count)}</Txt>
          </View>
          <View style={[s.uniTrack, { backgroundColor: colors.ink4 }]}>
            <View style={[s.uniFill, { width: `${Math.round((c.count / top) * 100)}%`, backgroundColor: colors.orange }]} />
          </View>
        </View>
      ))}
      <View style={[s.between, s.darkLine]}>
        <Txt style={{ fontSize: 13, color: colors.fog2 }}>{t.rejected}</Txt>
        <Txt style={[mono(700), { fontSize: 13, color: colors.white }]}>{formatSom(rejected)}</Txt>
      </View>
    </View>
  );
}

export const PERIOD_OPTIONS: Period[] = [1, 7, 30];

const s = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row" },
  stack: { gap: 10 },
  between: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  betweenBase: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  headWrap: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  seg: { flexDirection: "row", alignSelf: "flex-start", gap: 4, borderRadius: 12, backgroundColor: colors.track, padding: 4 },
  segItem: { height: 36, flexDirection: "row", gap: 8, borderRadius: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: colors.white },
  card: { minWidth: 0, borderRadius: 18, backgroundColor: colors.white, padding: 20 },
  cardTitle: { fontSize: 17 },
  stat: { borderRadius: 18, backgroundColor: colors.white, padding: 18 },
  statValue: { marginTop: 8, fontSize: 44, lineHeight: 44 },
  returnTrack: { marginTop: 10, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.bar },
  returnFill: { height: 6, backgroundColor: colors.blue },
  small: { fontSize: 12, color: colors.muted },
  tiny: { fontSize: 11, color: colors.muted },
  note: { fontSize: 13, color: colors.muted },
  /** saytdagi `leading-[1.45]` */
  loose: { lineHeight: 19 },
  topLine: { borderTopWidth: 1, borderTopColor: colors.surface, paddingTop: 12 },
  legends: { flexDirection: "row", gap: 14 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  chartRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  axis: { width: 26, height: 220, justifyContent: "space-between", alignItems: "flex-end" },
  axisText: { fontSize: 11, lineHeight: 13, color: colors.muted2 },
  plot: { height: 220, flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1.5, borderBottomColor: colors.ink },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.surface },
  bar: { flex: 1, minWidth: 0, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLabelBox: { flex: 1, minWidth: 0, alignItems: "center", overflow: "visible" },
  // Yorliq ustundan keng — markazda, ikki tomonga chiqib turadi (saytdagi `overflow-visible whitespace-nowrap`)
  barLabel: { fontSize: 10, color: colors.muted2, textAlign: "center", width: 60, marginHorizontal: -30 },
  funnelBar: { height: 30, borderRadius: 6 },
  heatLegend: { flexDirection: "row", alignItems: "center", gap: 4 },
  heatSwatch: { width: 14, height: 14, borderRadius: 3 },
  heatRow: { flexDirection: "row", gap: 4 },
  heatDay: { width: 30 },
  heatCellH: { height: 26, justifyContent: "center" },
  heatHour: { flex: 1, fontSize: 10, color: colors.muted2, textAlign: "center" },
  heatCell: { flex: 1, height: 26, borderRadius: 4 },
  uniTrack: { height: 8, borderRadius: 4, backgroundColor: colors.heat0 },
  uniFill: { height: 8, borderRadius: 4, backgroundColor: colors.blue },
  th: { borderBottomWidth: 1.5, borderBottomColor: colors.ink },
  td: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  thCell: { paddingVertical: 10 },
  tdCell: { paddingVertical: 12 },
  saleTh: { paddingVertical: 8 },
  saleTd: { paddingVertical: 10 },
  offerBadge: { minWidth: 34, marginRight: 8, borderRadius: 5, backgroundColor: colors.orange, paddingHorizontal: 5, paddingVertical: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.greenLive },
  allLink: { marginTop: 12, height: 44, justifyContent: "center", alignSelf: "flex-start" },
  darkLine: { marginTop: "auto", borderTopWidth: 1, borderTopColor: colors.ink4, paddingTop: 12 },
});
