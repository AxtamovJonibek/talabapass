import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Image, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, errorText } from "@/api/client";
import { bizApi, type DiscountDraft, type DiscountForm, type DiscountStatus, type DiscountType } from "@/api/business";
import type { LocalFile } from "@/api/endpoints";
import { copy } from "@/copy";
import { discountTerms, emptyDraft, formatDateRange, parseAmount, parseDateRange, PERCENT_MAX, PERCENT_MIN, todayIso, validateDiscount, type DiscountField } from "@/lib/discount";
import { formatSom, MINUS } from "@/lib/format";
import { daysText, formatSchedule, hoursFor, outsideHours, parseSchedule, type Range, type WeekSchedule } from "@/lib/hours";
import { pickImage } from "@/lib/pick";
import { useLoad } from "@/lib/use-load";
import { DayChips, TimeRangePicker } from "@/site/time";
import { Button, Choice, mono, SiteField, SiteInput } from "@/site/ui";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Failed, imageUrl, Loading } from "@/ui/app";
import { Icon, isIconName } from "@/ui/icons";
import { KEYBOARD_GAP, Press, Txt } from "@/ui/kit";
import { hoursLabels, UZ_HOURS_LABELS } from "@/ui/time-pickers";

const KINDS: DiscountType[] = ["PERCENT", "FIXED_PRICE", "BOGO"];
const PERCENT_STEP = 5;
const PRICE_STEP = 1000;
const IMAGES_MAX = 4;
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const addDays = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
type Category = { icon: string; tileColor: string; inkColor: string };
const NO_CATEGORY: Category = { icon: "all", tileColor: colors.surface, inkColor: colors.ink };
/** Muharrirdagi rasm: saqlangani (`id`) yoki saqlangandan keyin yuklanadigan yangi fayl */
type EditorImage = { key: string; url: string; id?: string; file?: LocalFile };

/**
 * B2 — chegirma yaratish / tahrirlash, saytdagi telefon muharriri (`EditorMobile`, `useDiscountEditor`): sarlavha va
 * "Qoralama", holat yozuvi, mahsulot (kategoriya plitkasi bilan), rasmlar (4 tagacha), tur, asl narx va qora qiymat qutisi
 * (+/−), kunlar, soat (tayyor oraliqlar / g'ildirak), kunlik son ("60 ta"), muddat ("13.10 – 31.10"), talabaga ko'rinishi;
 * pastda "E'lon qilish" / "Saqlash". Tekshiruv saytdagi `validateDiscount`; rasmlar saqlangandan keyin yuklanadi.
 */
export default function DiscountEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const remote = useLoad(useCallback(() => bizApi.discount(id), [id]), !isNew);
  if (isNew) return <EditorForm key="new" id={null} initial={null} />;
  if (remote.data) return <EditorForm key={id} id={id} initial={remote.data} />;
  return <View style={[styles.root, styles.center]}>{remote.error ? <Failed error={remote.error} onRetry={() => void remote.reload()} /> : <Loading />}</View>;
}

function CategoryTile({ category, size, plus = false, image, children }: { category: Category; size: number; plus?: boolean; image?: string; children?: ReactNode }) {
  const radius = size >= 96 ? 14 : size >= 64 ? 12 : 10;
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: category.tileColor, alignItems: "center", justifyContent: "center" }}>
      {image ? (
        <Image source={{ uri: image }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} accessibilityIgnoresInvertColors />
      ) : size > 52 ? (
        <Icon name={isIconName(category.icon) ? category.icon : "all"} size={Math.round(size / 1.9)} color={category.inkColor} strokeWidth={1.4} />
      ) : null}
      {plus ? (
        <View style={styles.plus}>
          <Icon name="plus" size={12} color={colors.white} strokeWidth={2.6} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

function EditorForm({ id, initial }: { id: string | null; initial: DiscountForm | null }) {
  const e = copy.biz.editor;
  const insets = useSafeAreaInsets();
  const { me } = useApp();
  const today = todayIso();
  const d0: DiscountDraft = initial?.draft ?? emptyDraft();
  const [schedule, setSchedule] = useState<WeekSchedule>([]);
  useEffect(() => {
    // Ish vaqti biznes profilidan (bazada o'zbekcha matn): "Ish vaqti bo'yicha" va ogohlantirish uchun
    void bizApi
      .profile()
      .then((p) => setSchedule(parseSchedule(p.profile.workingHours, UZ_HOURS_LABELS) ?? []))
      .catch(() => undefined);
  }, []);

  const [title, setTitle] = useState(d0.title);
  const [type, setType] = useState<DiscountType>(d0.type);
  const [original, setOriginal] = useState(d0.originalPrice != null ? groupDigits(d0.originalPrice) : "");
  const [percentText, setPercentText] = useState(String(d0.percent ?? 30));
  const [newPrice, setNewPrice] = useState<number | null>(d0.newPrice ?? null);
  const [weekdays, setWeekdays] = useState(d0.weekdays);
  const [range, setRange] = useState<Range>({ from: d0.fromMinute ?? 720, to: d0.toMinute ?? 900 });
  const [limit, setLimit] = useState(d0.dailyLimit != null ? e.dailyLimitValue(d0.dailyLimit) : "");
  const [period, setPeriod] = useState(formatDateRange(initial ? d0.startsOn : today, initial ? d0.endsOn : addDays(today, 30), today));
  const [status, setStatus] = useState<DiscountStatus | null>(initial?.status ?? null);
  const [images, setImages] = useState<EditorImage[]>((initial?.images ?? []).map((i) => ({ key: i.id, url: imageUrl(i.url), id: i.id })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<DiscountField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState(id);

  const ended = status === "ENDED";
  const live = status === "ACTIVE" || status === "PAUSED";
  const category = initial?.category ?? NO_CATEGORY;
  const percent = /^\d{1,3}$/.test(percentText) ? Number(percentText) : null;
  const originalPrice = parseAmount(original);
  // Yangi narx tanlanmagan bo'lsa — asl narxning 70% i (1000 ga yaxlitlab), saytdagidek
  const price = newPrice ?? (originalPrice ? Math.max(PRICE_STEP, Math.floor((originalPrice * 0.7) / PRICE_STEP) * PRICE_STEP) : null);
  const dates = parseDateRange(period, today);
  const draft: DiscountDraft = {
    title,
    type,
    originalPrice,
    percent: type === "PERCENT" ? percent : null,
    newPrice: type === "FIXED_PRICE" ? price : null,
    weekdays,
    fromMinute: range.from,
    toMinute: range.to === 0 ? 1440 : range.to,
    dailyLimit: parseAmount(limit),
    perStudentLimit: d0.perStudentLimit,
    startsOn: dates?.startsOn ?? "",
    endsOn: dates?.endsOn ?? "",
    terms: d0.terms,
  };
  const terms = discountTerms(type === "PERCENT" ? { ...draft, percent: draft.percent ?? 0 } : draft);
  const errorOf = (f: DiscountField) => (errors[f] ? (e.errors[errors[f]!] ?? "") : null);
  const outside = outsideHours(weekdays, range, schedule);
  const outsideText = outside.length ? copy.time.outside(daysText(outside, hoursLabels()), schedule.length ? formatSchedule(schedule, hoursLabels()) : copy.time.noHours) : null;
  const valueText = type === "PERCENT" ? `${MINUS}${percentText || 0}%` : type === "FIXED_PRICE" ? (price !== null ? groupDigits(price) : "—") : "1+1";
  const previewPrice = type === "BOGO" ? e.bogoFree : terms.finalPrice !== null ? `${formatSom(terms.finalPrice)} ${copy.currency}` : "—";
  const previewInstead = type !== "BOGO" && originalPrice ? e.insteadOf(groupDigits(originalPrice)) : null;
  const statusText = status ? (status === "REJECTED" && initial?.rejectReason ? `${e.status.REJECTED} ${initial.rejectReason}` : e.status[status]) : null;
  const businessPending = me?.business?.status === "PENDING";

  const step = (direction: 1 | -1) => {
    if (type === "PERCENT") setPercentText(String(Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, (percent ?? 0) + direction * PERCENT_STEP))));
    if (type === "FIXED_PRICE" && price !== null) {
      const ceiling = originalPrice ? originalPrice - PRICE_STEP : price;
      setNewPrice(Math.min(Math.max(PRICE_STEP, ceiling), Math.max(PRICE_STEP, price + direction * PRICE_STEP)));
    }
  };

  const addImage = async () => {
    setImageError(null);
    try {
      const file = await pickImage(`chegirma-${Date.now()}.jpg`);
      if (file) setImages((list) => [...list, { key: file.uri, url: file.uri, file }]);
    } catch (err) {
      setImageError(errorText(err));
    }
  };
  const removeImage = (key: string) => {
    const image = images.find((i) => i.key === key);
    if (image?.id) setRemoved((list) => [...list, image.id!]);
    setImages((list) => list.filter((i) => i.key !== key));
  };

  /** Saqlangandan keyin: o'chirilganlar, keyin yangi fayllar ketma-ket; xato bo'lsa — to'xtaydi (saytdagidek) */
  const syncImages = async (discountId: string) => {
    for (const imageId of removed) await bizApi.removeDiscountImage(imageId).catch(() => undefined);
    setRemoved([]);
    for (const image of images.filter((i) => i.file)) {
      try {
        const uploaded = await bizApi.uploadDiscountImage(discountId, image.file!);
        setImages((list) => list.map((i) => (i.key === image.key ? { ...i, id: uploaded.id, file: undefined } : i)));
      } catch (err) {
        setImageError(errorText(err));
        return false;
      }
    }
    return true;
  };

  const save = async (intent: "draft" | "publish") => {
    if (busy || ended) return;
    const found = validateDiscount(draft, today);
    // Boshlangan chegirmani tahrirlashda boshlanish sanasi o'tmishda qolishi mumkin (server ham shunday)
    if (initial && found.dates === "startInPast" && draft.startsOn === d0.startsOn) delete found.dates;
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const saved = await bizApi.saveDiscount(savedId, draft, intent);
      setSavedId(saved.id);
      setStatus(saved.status);
      if (await syncImages(saved.id)) router.navigate("/panel/discounts");
    } catch (err) {
      if (err instanceof ApiError && err.details.problems && typeof err.details.problems === "object") setErrors(err.details.problems as Partial<Record<DiscountField, string>>);
      else setFailure(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.head, { paddingTop: insets.top + 54 }]}>
        <Press onPress={() => router.navigate("/panel/discounts")} accessibilityRole="link" accessibilityLabel={copy.back} scale={0.94} style={styles.backBtn}>
          <Icon name="chevronLeft" size={20} />
        </Press>
        <Txt accessibilityRole="header" style={[font(800, 110), styles.title]}>
          {id ? e.editTitle : e.newTitle}
        </Txt>
        {live || ended ? null : (
          <Press onPress={() => void save("draft")} disabled={busy} accessibilityRole="button" scale={0.97} style={styles.draft}>
            <Txt style={[font(600), { fontSize: 14, color: colors.muted }]}>{e.draft}</Txt>
          </Press>
        )}
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={KEYBOARD_GAP} keyboardShouldPersistTaps="handled">
        {statusText ? <Txt style={[styles.note, { backgroundColor: colors.surface, color: colors.muted }]}>{statusText}</Txt> : null}
        {businessPending ? <Txt style={[styles.note, { backgroundColor: colors.warnBg, color: colors.warn }]}>{e.pendingBusiness}</Txt> : null}
        {failure ? (
          <Txt accessibilityRole="alert" style={[font(600), { fontSize: 13, color: colors.danger }]}>
            {failure}
          </Txt>
        ) : null}

        <View style={{ gap: 6 }}>
          <View style={styles.product}>
            <CategoryTile category={category} size={64} plus image={images[0]?.url} />
            <View style={[styles.flex1, { gap: 4 }]}>
              <Txt style={{ fontSize: 12, color: colors.muted }}>{e.product}</Txt>
              <TextInput
                value={title}
                onChangeText={setTitle}
                editable={!ended}
                placeholder={e.productPlaceholder}
                placeholderTextColor={colors.placeholder}
                accessibilityLabel={e.product}
                style={[font(700), styles.bare, { fontSize: 16 }]}
              />
            </View>
          </View>
          {errorOf("title") ? <Txt style={styles.error}>{errorOf("title")}</Txt> : null}
        </View>

        <View style={{ gap: 6 }}>
          <View style={[styles.row, { alignItems: "baseline", justifyContent: "space-between" }]}>
            <Txt style={[font(600), { fontSize: 13 }]}>{e.imagesLabel}</Txt>
            <Txt style={[mono(), { fontSize: 11, color: colors.muted }]}>{e.imagesCount(images.length)}</Txt>
          </View>
          <View style={[styles.row, { flexWrap: "wrap", gap: 8 }]}>
            {images.map((image) => (
              <View key={image.key} style={styles.thumb}>
                <Image source={{ uri: image.url }} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} accessibilityIgnoresInvertColors />
                {!ended ? (
                  <Press onPress={() => removeImage(image.key)} accessibilityRole="button" accessibilityLabel={e.removeImage} hitSlop={8} scale={0.9} style={styles.thumbX}>
                    <Icon name="close" size={12} color={colors.white} strokeWidth={2.6} />
                  </Press>
                ) : null}
              </View>
            ))}
            {images.length < IMAGES_MAX && !ended ? (
              <Press onPress={() => void addImage()} accessibilityRole="button" accessibilityLabel={e.addImage} scale={0.96} style={[styles.thumb, styles.addThumb]}>
                <Icon name="plus" size={20} strokeWidth={2.4} />
              </Press>
            ) : null}
          </View>
          {imageError ? <Txt style={styles.error}>{imageError}</Txt> : null}
        </View>

        <View style={{ gap: 8 }}>
          <Txt style={[font(600), { fontSize: 13 }]}>{e.type}</Txt>
          <Choice label={e.type} value={type} onChange={(t) => !ended && setType(t)} options={KINDS.map((k) => ({ value: k, label: e.types[k] ?? k }))} />
        </View>

        <View style={{ gap: 6 }}>
          <View style={[styles.row, { gap: 10 }]}>
            <View style={styles.priceBox}>
              <Txt style={{ fontSize: 12, color: colors.muted }}>{e.originalPrice}</Txt>
              <TextInput
                value={original}
                onChangeText={setOriginal}
                editable={!ended}
                keyboardType="number-pad"
                accessibilityLabel={e.originalPrice}
                style={[mono(600), styles.bare, { fontSize: 18 }]}
              />
            </View>
            <View style={styles.valueBox}>
              <View style={{ gap: 2, flexShrink: 1 }}>
                <Txt style={{ fontSize: 12, color: colors.fog2 }}>{e.valueLabel[type]}</Txt>
                {type === "PERCENT" ? (
                  <View style={[styles.row, { alignItems: "baseline" }]}>
                    <Txt style={[font(900, 62), styles.value]}>{MINUS}</Txt>
                    <TextInput
                      testID="discount-value"
                      value={percentText}
                      onChangeText={(v) => setPercentText(v.replace(/\D/g, "").slice(0, 3))}
                      editable={!ended}
                      keyboardType="number-pad"
                      accessibilityLabel={e.percentLabel}
                      // Kenglik raqamlar soniga qarab (saytda `width: Nch`); lineHeight'siz — web input matnni kesmasin
                      style={[font(900, 62), styles.bare, styles.percentInput, { width: Math.max(1, percentText.length) * 15 + 2 }]}
                    />
                    <Txt style={[font(900, 62), styles.value]}>%</Txt>
                  </View>
                ) : (
                  <Txt testID="discount-value" style={[font(900, 62), styles.value]}>
                    {valueText}
                  </Txt>
                )}
              </View>
              {type === "BOGO" ? null : (
                <View style={{ gap: 4 }}>
                  <Press onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={e.increase} scale={0.92} style={styles.stepBtn}>
                    <Txt style={[font(700), { fontSize: 16, color: colors.white }]}>+</Txt>
                  </Press>
                  <Press onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={e.decrease} scale={0.92} style={styles.stepBtn}>
                    <Txt style={[font(700), { fontSize: 16, color: colors.white }]}>{MINUS}</Txt>
                  </Press>
                </View>
              )}
            </View>
          </View>
          {errorOf("originalPrice") ? <Txt style={styles.error}>{errorOf("originalPrice")}</Txt> : null}
          {errorOf("percent") ?? errorOf("newPrice") ? <Txt style={styles.error}>{errorOf("percent") ?? errorOf("newPrice")}</Txt> : null}
        </View>

        <View style={{ gap: 8 }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <Txt style={[font(600), { fontSize: 13 }]}>{e.days}</Txt>
            <Txt style={{ fontSize: 13, color: colors.muted }}>{e.daysCount(weekdays.length)}</Txt>
          </View>
          <DayChips value={weekdays} onChange={(days) => !ended && setWeekdays(days)} error={errorOf("weekdays")} />
        </View>

        <View style={{ gap: 8 }}>
          <Txt style={[font(600), { fontSize: 13 }]}>{e.time}</Txt>
          <TimeRangePicker value={range} onChange={(r) => !ended && setRange(r)} workHours={hoursFor(weekdays, schedule)} invalid={Boolean(errorOf("time"))} error={errorOf("time")} />
          {outsideText ? <Txt style={[font(600), styles.note, { backgroundColor: colors.warnBg, color: colors.warn, fontSize: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }]}>{outsideText}</Txt> : null}
        </View>

        <View style={[styles.row, { gap: 10 }]}>
          <SiteField label={e.dailyLimit} error={errorOf("dailyLimit")} style={styles.flex1}>
            <SiteInput
              mono
              compact
              keyboardType="number-pad"
              value={limit}
              editable={!ended}
              onChangeText={setLimit}
              onBlur={() => {
                const n = Number(limit.replace(/\D/g, ""));
                if (n > 0) setLimit(e.dailyLimitValue(n));
              }}
              invalid={Boolean(errorOf("dailyLimit"))}
              style={{ paddingHorizontal: 12 }}
            />
          </SiteField>
          <SiteField label={e.period} error={errorOf("dates")} style={styles.flex1}>
            <SiteInput
              mono
              compact
              keyboardType="numbers-and-punctuation"
              value={period}
              editable={!ended}
              onChangeText={setPeriod}
              placeholder={e.periodPlaceholder}
              invalid={Boolean(errorOf("dates"))}
              style={{ paddingHorizontal: 12 }}
            />
          </SiteField>
        </View>

        <View style={styles.preview}>
          <Txt style={[font(700), { fontSize: 12, letterSpacing: em(12, 0.05), color: colors.muted }]}>{e.previewMobile}</Txt>
          <View style={styles.previewCard}>
            <CategoryTile category={category} size={52} image={images[0]?.url}>
              <View style={styles.previewBadge}>
                <Txt style={[font(900, 70), { fontSize: 13 }]}>{terms.badge}</Txt>
              </View>
            </CategoryTile>
            <View style={[styles.flex1, { gap: 2 }]}>
              <Txt style={{ fontSize: 11, color: colors.muted }}>{me?.business?.name ?? ""}</Txt>
              <Txt style={[font(700), { fontSize: 14 }]}>{title || e.productPlaceholder}</Txt>
              <Txt style={[font(800), { fontSize: 13 }]}>{`${previewPrice}${previewInstead ? `  ·  ${previewInstead}` : ""}`}</Txt>
            </View>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {!ended ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 30 }]}>
          <Button variant="orange" block busy={busy} disabled={busy} onPress={() => void save("publish")}>
            {busy ? e.saving : live ? e.save : e.publish}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row" },
  root: { flex: 1, backgroundColor: colors.paper },
  center: { alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, letterSpacing: em(20, -0.02) },
  draft: { height: 40, paddingHorizontal: 12, justifyContent: "center" },
  body: { padding: 16, gap: 14 },
  note: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, lineHeight: 19 },
  error: { ...font(600), fontSize: 12, color: colors.danger },
  bare: { padding: 0, color: colors.ink, minWidth: 0 },
  product: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: colors.white, padding: 10 },
  plus: { position: "absolute", right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.surface },
  thumbX: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  addThumb: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  priceBox: { flex: 1, gap: 4, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  valueBox: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, backgroundColor: colors.ink, paddingVertical: 10, paddingLeft: 14, paddingRight: 8 },
  value: { fontSize: 30, lineHeight: 30, color: colors.orange },
  percentInput: { fontSize: 30, height: 32, color: colors.orange, textAlign: "center" },
  stepBtn: { width: 32, height: 26, borderRadius: 7, backgroundColor: colors.ink4, alignItems: "center", justifyContent: "center" },
  preview: { gap: 8, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.lineStrong, padding: 12 },
  previewCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, backgroundColor: colors.white, padding: 10 },
  previewBadge: { position: "absolute", top: -6, left: -4, borderRadius: 5, backgroundColor: colors.orange, paddingHorizontal: 5, paddingVertical: 3, transform: [{ rotate: "-6deg" }] },
  footer: { borderTopWidth: 1, borderTopColor: colors.lineSoft, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12 },
});
