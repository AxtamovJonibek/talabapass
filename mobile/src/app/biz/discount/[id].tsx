import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { bizApi, type DiscountDraft, type DiscountForm, type DiscountStatus, type DiscountType, type StudentLimit } from "@/api/business";
import type { LocalFile } from "@/api/endpoints";
import { StatusBadge } from "@/business/ui";
import { copy } from "@/copy";
import { dateField, emptyDraft, parseAmount, parseDate, parseTime, priceAfterPercent, todayIso, validateDiscount, type DiscountField } from "@/lib/discount";
import { formatMinute, formatSom } from "@/lib/format";
import { pickImage } from "@/lib/pick";
import { useLoad } from "@/lib/use-load";
import { colors, font } from "@/theme";
import { Card, Failed, imageUrl, Loading, RoundButton, SecondaryButton } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Choice, ErrorBox, Field, Label, Note, PrimaryButton, Press, Screen, Title, TopBar, Txt } from "@/ui/kit";

type Form = {
  title: string;
  type: DiscountType;
  originalPrice: string;
  percent: string;
  newPrice: string;
  weekdays: number[];
  from: string;
  to: string;
  dailyLimit: string;
  perStudentLimit: StudentLimit;
  startsOn: string;
  endsOn: string;
  terms: string;
};

const num = (n: number | null) => (n === null ? "" : formatSom(n));
const toForm = (d: DiscountDraft): Form => ({
  title: d.title,
  type: d.type,
  originalPrice: num(d.originalPrice),
  percent: d.percent === null ? "" : String(d.percent),
  newPrice: num(d.newPrice),
  weekdays: d.weekdays,
  from: d.fromMinute === null ? "" : formatMinute(d.fromMinute),
  to: d.toMinute === null ? "" : formatMinute(d.toMinute),
  dailyLimit: d.dailyLimit === null ? "" : String(d.dailyLimit),
  perStudentLimit: d.perStudentLimit,
  startsOn: dateField(d.startsOn),
  endsOn: dateField(d.endsOn),
  terms: d.terms,
});
const toDraft = (f: Form): DiscountDraft => ({
  title: f.title,
  type: f.type,
  originalPrice: parseAmount(f.originalPrice),
  percent: f.type === "PERCENT" ? parseAmount(f.percent) : null,
  newPrice: f.type === "FIXED_PRICE" ? parseAmount(f.newPrice) : null,
  weekdays: f.weekdays,
  fromMinute: parseTime(f.from),
  toMinute: parseTime(f.to),
  dailyLimit: parseAmount(f.dailyLimit),
  perStudentLimit: f.perStudentLimit,
  startsOn: parseDate(f.startsOn),
  endsOn: parseDate(f.endsOn),
  terms: f.terms,
});

/**
 * Chegirma muharriri (saytdagi B2 / WB2): nom, tur (foiz / yangi narx / 1+1), narx, kunlar, soat, kunlik son, bir
 * talabaga limit, muddat, shartlar, rasmlar (4 tagacha). Tekshiruv saytdagi `validateDiscount` bilan; "Qoralama" yoki
 * "E'lon qilish" (admin tekshiruvi). Faol chegirmada mazmun yoki rasm o'zgarsa — qayta tekshiruv. Yangi rasmlar
 * saqlangandan keyin yuklanadi (saytdagidek). `id = "new"` — yangi chegirma.
 */
export default function DiscountEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const remote = useLoad(useCallback(() => bizApi.discount(id), [id]), !isNew);
  if (isNew) return <EditorForm key="new" id={null} initial={null} />;
  if (remote.data) return <EditorForm key={id} id={id} initial={remote.data} />;
  return <Screen scroll={false}>{remote.error ? <Failed error={remote.error} onRetry={() => void remote.reload()} /> : <Loading />}</Screen>;
}

function EditorForm({ id, initial }: { id: string | null; initial: DiscountForm | null }) {
  const isNew = id === null;
  const e = copy.biz.editor;
  const [form, setForm] = useState<Form>(() => toForm(initial?.draft ?? emptyDraft()));
  const [status, setStatus] = useState<DiscountStatus | null>(initial?.status ?? null);
  const rejectReason = initial?.rejectReason ?? null;
  const [images, setImages] = useState<{ id: string; url: string }[]>(initial?.images ?? []);
  const [pending, setPending] = useState<LocalFile[]>([]);
  const [errors, setErrors] = useState<Partial<Record<DiscountField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);

  const set = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch });
    setError(null);
  };
  const ended = status === "ENDED";
  const draftNow = toDraft(form);
  const total = images.length + pending.length;
  const bad = (f: DiscountField) => Boolean(errors[f]);
  const fieldError = (f: DiscountField) => (errors[f] ? <Note error>{e.errors[errors[f]!] ?? ""}</Note> : null);

  const calc = (() => {
    const o = draftNow.originalPrice;
    if (form.type === "BOGO") return e.calcBogo;
    if (form.type === "PERCENT" && o && draftNow.percent) {
      const paid = priceAfterPercent(o, Math.min(100, draftNow.percent));
      return e.calcPercent(`${formatSom(paid)} ${copy.currency}`, `${formatSom(o - paid)} ${copy.currency}`);
    }
    if (form.type === "FIXED_PRICE" && o && draftNow.newPrice && draftNow.newPrice < o) return e.calcFixed(`${formatSom(o - draftNow.newPrice)} ${copy.currency}`);
    return null;
  })();
  const overnight = draftNow.fromMinute !== null && draftNow.toMinute !== null && draftNow.toMinute < draftNow.fromMinute;

  const addImage = async () => {
    try {
      const file = await pickImage(`chegirma-${Date.now()}.jpg`);
      if (file) setPending((p) => [...p, file]);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const removeServerImage = (imageId: string) =>
    Alert.alert(e.removeImage, status === "ACTIVE" || status === "PAUSED" ? e.status.ACTIVE : undefined, [
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
      {
        text: e.removeImage,
        style: "destructive",
        onPress: () =>
          void bizApi
            .removeDiscountImage(imageId)
            .then(() => {
              setImages((list) => list.filter((i) => i.id !== imageId));
              if (status === "ACTIVE" || status === "PAUSED") setStatus("PENDING_REVIEW");
            })
            .catch((err: unknown) => setError(errorText(err))),
      },
    ]);

  const save = async (intent: "draft" | "publish") => {
    if (busy || ended) return;
    const draft = toDraft(form);
    const found = validateDiscount(draft, todayIso());
    // Tahrirlashda allaqachon boshlangan chegirmaning boshlanish sanasi o'tmishda bo'lishi tabiiy (server ham shunday)
    if (!isNew && found.dates === "startInPast") delete found.dates;
    setErrors(found);
    if (Object.keys(found).length > 0) return setError(e.errors[Object.values(found)[0]!] ?? null);
    setBusy(intent);
    setError(null);
    try {
      const saved = await bizApi.saveDiscount(id, draft, intent);
      let failed = 0;
      for (const file of pending) {
        try {
          await bizApi.uploadDiscountImage(saved.id, file);
        } catch {
          failed++;
        }
      }
      setPending([]);
      const done = e.saved[saved.status] ?? e.saved.ACTIVE!;
      Alert.alert(failed > 0 ? `${done} ${e.imageFailed(failed)}` : done);
      if (failed > 0 && isNew) router.replace(`/biz/discount/${saved.id}`);
      else router.back();
    } catch (err) {
      if (err instanceof ApiError && err.details.problems && typeof err.details.problems === "object") {
        const problems = err.details.problems as Partial<Record<DiscountField, string>>;
        setErrors(problems);
        setError(e.errors[Object.values(problems)[0] ?? ""] ?? errorText(err));
      } else setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const approved = status === "ACTIVE" || status === "PAUSED";

  return (
    <Screen>
      <TopBar>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => router.back()} />
        {status ? <StatusBadge status={status} /> : null}
      </TopBar>
      <Title text={isNew ? e.newTitle : e.editTitle} size={36} style={styles.title} />
      {status ? (
        <Card style={styles.statusCard}>
          <Txt style={styles.statusText}>{status === "REJECTED" && rejectReason ? `${e.status.REJECTED} ${rejectReason}` : e.status[status]}</Txt>
        </Card>
      ) : null}

      <View style={styles.block}>
        <Label>{e.product}</Label>
        <Field value={form.title} onChangeText={(title) => set({ title })} placeholder={e.productPlaceholder} invalid={bad("title")} text={17} editable={!ended} />
        {fieldError("title")}
      </View>

      <View style={styles.block}>
        <Label>{e.type}</Label>
        <View style={styles.row}>
          {(["PERCENT", "FIXED_PRICE", "BOGO"] as const).map((t) => (
            <Choice key={t} shape="wide" selected={form.type === t} onPress={() => !ended && set({ type: t })}>
              {e.types[t] ?? t}
            </Choice>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Label>{form.type === "BOGO" ? e.originalPriceBogo : e.originalPrice}</Label>
        <Field value={form.originalPrice} onChangeText={(v) => set({ originalPrice: v })} keyboardType="number-pad" placeholder="38 000" invalid={bad("originalPrice")} text={17} editable={!ended} />
        {fieldError("originalPrice")}
      </View>

      {form.type === "PERCENT" ? (
        <View style={styles.block}>
          <Label>{e.percent}</Label>
          <Field value={form.percent} onChangeText={(v) => set({ percent: v })} keyboardType="number-pad" placeholder="30" invalid={bad("percent")} text={17} editable={!ended} />
          {fieldError("percent")}
        </View>
      ) : null}
      {form.type === "FIXED_PRICE" ? (
        <View style={styles.block}>
          <Label>{e.newPrice}</Label>
          <Field value={form.newPrice} onChangeText={(v) => set({ newPrice: v })} keyboardType="number-pad" placeholder="26 600" invalid={bad("newPrice")} text={17} editable={!ended} />
          {fieldError("newPrice")}
        </View>
      ) : null}
      {calc ? <Txt style={[font(700), styles.calc]}>{calc}</Txt> : null}

      <View style={styles.block}>
        <Label>{e.days}</Label>
        <View style={styles.days}>
          {copy.weekdaysShort.map((label, i) => {
            const day = i + 1;
            const on = form.weekdays.includes(day);
            return (
              <Choice
                key={label}
                shape="square"
                selected={on}
                label={copy.weekdays[i]}
                onPress={() => !ended && set({ weekdays: on ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort((a, b) => a - b) })}
              >
                {label}
              </Choice>
            );
          })}
        </View>
        {fieldError("weekdays")}
      </View>

      <View style={[styles.block, styles.row]}>
        <View style={styles.half}>
          <Label>{e.from}</Label>
          <Field value={form.from} onChangeText={(v) => set({ from: v })} placeholder={e.timePlaceholder} keyboardType="numbers-and-punctuation" invalid={bad("time")} text={17} editable={!ended} />
        </View>
        <View style={styles.half}>
          <Label>{e.to}</Label>
          <Field value={form.to} onChangeText={(v) => set({ to: v })} placeholder={e.timePlaceholder} keyboardType="numbers-and-punctuation" invalid={bad("time")} text={17} editable={!ended} />
        </View>
      </View>
      {fieldError("time")}
      {overnight && !errors.time ? <Note>{e.overnight(form.to)}</Note> : null}

      <View style={styles.block}>
        <Label>{e.dailyLimit}</Label>
        <Field value={form.dailyLimit} onChangeText={(v) => set({ dailyLimit: v })} keyboardType="number-pad" placeholder="30" invalid={bad("dailyLimit")} text={17} editable={!ended} />
        {fieldError("dailyLimit")}
      </View>

      <View style={styles.block}>
        <Label>{e.perStudent}</Label>
        <View style={styles.wrap}>
          {(["DAILY", "WEEKLY", "UNLIMITED"] as const).map((l) => (
            <Choice key={l} shape="pill" selected={form.perStudentLimit === l} onPress={() => !ended && set({ perStudentLimit: l })}>
              {e.perStudentOptions[l] ?? l}
            </Choice>
          ))}
        </View>
      </View>

      <View style={[styles.block, styles.row]}>
        <View style={styles.half}>
          <Label>{e.starts}</Label>
          <Field value={form.startsOn} onChangeText={(v) => set({ startsOn: v })} placeholder={e.datePlaceholder} keyboardType="numbers-and-punctuation" invalid={bad("dates")} text={17} editable={!ended} />
        </View>
        <View style={styles.half}>
          <Label>{e.ends}</Label>
          <Field value={form.endsOn} onChangeText={(v) => set({ endsOn: v })} placeholder={e.datePlaceholder} keyboardType="numbers-and-punctuation" invalid={bad("dates")} text={17} editable={!ended} />
        </View>
      </View>
      {fieldError("dates")}

      <View style={styles.block}>
        <Label>{e.terms}</Label>
        <Field value={form.terms} onChangeText={(terms) => set({ terms })} placeholder={e.termsPlaceholder} invalid={bad("terms")} text={17} editable={!ended} maxLength={220} />
        {fieldError("terms")}
      </View>

      <View style={styles.block}>
        <Label>{e.images(total)}</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {images.map((img) => (
            <View key={img.id}>
              <Image source={{ uri: imageUrl(img.url) }} style={styles.image} accessibilityIgnoresInvertColors />
              {!ended ? (
                <Press onPress={() => removeServerImage(img.id)} accessibilityRole="button" accessibilityLabel={e.removeImage} style={styles.remove} hitSlop={6}>
                  <Icon name="x" size={16} color={colors.white} strokeWidth={3} />
                </Press>
              ) : null}
            </View>
          ))}
          {pending.map((file, i) => (
            <View key={file.uri}>
              <Image source={{ uri: file.uri }} style={[styles.image, styles.imagePending]} accessibilityIgnoresInvertColors />
              <Press onPress={() => setPending((p) => p.filter((_, k) => k !== i))} accessibilityRole="button" accessibilityLabel={e.removeImage} style={styles.remove} hitSlop={6}>
                <Icon name="x" size={16} color={colors.white} strokeWidth={3} />
              </Press>
            </View>
          ))}
          {total < 4 && !ended ? (
            <Press onPress={() => void addImage()} accessibilityRole="button" accessibilityLabel={e.addImage} style={[styles.image, styles.addImage]}>
              <Icon name="plus" size={28} color={colors.muted} strokeWidth={2.4} />
            </Press>
          ) : null}
        </ScrollView>
        {pending.length > 0 ? <Note>{e.imagesAfterSave}</Note> : null}
      </View>

      <ErrorBox>{error}</ErrorBox>

      {!ended ? (
        <View style={styles.actions}>
          {approved ? (
            <PrimaryButton tone="orange" onPress={() => void save("publish")} loading={busy === "publish"}>
              {e.save}
            </PrimaryButton>
          ) : (
            <>
              <PrimaryButton tone="orange" onPress={() => void save("publish")} loading={busy === "publish"}>
                {e.publish}
              </PrimaryButton>
              <SecondaryButton onPress={() => void save("draft")} disabled={busy !== null}>
                {e.draft}
              </SecondaryButton>
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 18 },
  statusCard: { marginTop: 14, padding: 14 },
  statusText: { fontSize: 14, lineHeight: 20, color: colors.ink5 },
  block: { marginTop: 18 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  days: { flexDirection: "row", gap: 6 },
  calc: { fontSize: 14, color: colors.greenOk, marginTop: 10 },
  images: { gap: 10, paddingVertical: 2 },
  image: { width: 92, height: 92, borderRadius: 18 },
  imagePending: { opacity: 0.7 },
  addImage: { borderWidth: 2, borderStyle: "dashed", borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  remove: { position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(17,17,17,0.7)", alignItems: "center", justifyContent: "center" },
  actions: { marginTop: 24, gap: 10 },
});
