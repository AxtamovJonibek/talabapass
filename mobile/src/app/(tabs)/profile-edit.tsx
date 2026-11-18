import { router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { appApi, studentApi, type StudentProfile } from "@/api/endpoints";
import { copy } from "@/copy";
import { initials } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { AvatarEditor } from "@/site/avatar";
import { SubScreen } from "@/site/screen";
import { Button, SiteField, SiteInput } from "@/site/ui";
import { useApp } from "@/state";
import { colors, font } from "@/theme";
import { Failed, Loading, OptionRow, Sheet } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

const COURSES = ["C1", "C2", "C3", "C4", "MASTER"] as const;

/**
 * "Shaxsiy ma'lumotlar" — saytdagi `/profil/tahrir` (`ProfileForm`) telefon ko'rinishi: rasm, ism, familiya, kurs, fakultet,
 * tuman (ixtiyoriy) va izoh, "Saqlash". Kurs va tuman — saytda ro'yxat maydoni, ilovada shu ko'rinishdagi maydon va pastdan
 * tanlov oynasi. Qoidalar `src/lib/profile.ts` (server tekshiradi).
 */
export default function ProfileEdit() {
  const remote = useLoad(useCallback(() => studentApi.profile(), []));
  return (
    <SubScreen title={copy.profileEdit.personalTitle} onBack={() => router.navigate("/profile")}>
      {remote.data ? <EditForm initial={remote.data.profile} /> : remote.error ? <Failed error={remote.error} onRetry={() => void remote.reload()} /> : <Loading />}
    </SubScreen>
  );
}

/** Saytdagi `Select`: 52px, 1.5px chegara, o'ngda pastga o'q — bosilsa tanlov oynasi */
function SelectBox({ value, onPress, invalid = false, label }: { value: string; onPress: () => void; invalid?: boolean; label: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} scale={0.99} style={[styles.select, invalid ? { borderColor: colors.danger } : null]}>
      <Txt style={{ flex: 1, fontSize: 15 }}>{value}</Txt>
      <Icon name="chevronDown" size={18} />
    </Press>
  );
}

function EditForm({ initial }: { initial: StudentProfile }) {
  const p = copy.profileEdit;
  const { restoreMe } = useApp();
  const places = useLoad(useCallback(() => appApi.places(), []));
  const [form, setForm] = useState({
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    course: initial.course,
    faculty: initial.faculty ?? "",
    districtId: initial.districtId ?? "",
  });
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"course" | "district" | null>(null);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setInvalid((list) => list.filter((k) => !(k in patch)));
    setError(null);
    setSaved(false);
  };
  const district = places.data?.districts.find((x) => x.id === form.districtId) ?? null;
  const err = (key: string) => (invalid.includes(key) ? (p.errors[key] ?? "") : null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await studentApi.saveProfile(form);
      restoreMe(user);
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) setInvalid(e.fields);
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <AvatarEditor
        kind="student"
        url={initial.avatarUrl}
        fallback={initials(form.firstName, form.lastName) || "T"}
        onPick={async (file) => {
          await studentApi.uploadAvatar(file);
        }}
        onRemove={async () => {
          await studentApi.removeAvatar();
        }}
      />
      <View style={{ gap: 14 }}>
        <SiteField label={p.firstName} error={err("firstName")}>
          <SiteInput value={form.firstName} onChangeText={(v) => set({ firstName: v })} autoComplete="given-name" textContentType="givenName" maxLength={40} invalid={invalid.includes("firstName")} returnKeyType="next" />
        </SiteField>
        <SiteField label={p.lastName} error={err("lastName")}>
          <SiteInput value={form.lastName} onChangeText={(v) => set({ lastName: v })} autoComplete="family-name" textContentType="familyName" maxLength={40} invalid={invalid.includes("lastName")} returnKeyType="next" />
        </SiteField>
        <SiteField label={p.course} error={err("course")}>
          <SelectBox label={p.course} value={p.courseLong[form.course] ?? form.course} onPress={() => setSheet("course")} invalid={invalid.includes("course")} />
        </SiteField>
        <SiteField label={p.faculty} error={err("faculty")}>
          <SiteInput value={form.faculty} onChangeText={(v) => set({ faculty: v })} maxLength={80} invalid={invalid.includes("faculty")} returnKeyType="done" />
        </SiteField>
        <View style={{ gap: 6 }}>
          <View style={[styles.row, { alignItems: "baseline", justifyContent: "space-between", gap: 8 }]}>
            <Txt style={[font(600), { fontSize: 13 }]}>{p.district}</Txt>
            <Txt style={[font(400), { fontSize: 11, color: colors.muted, fontVariant: ["tabular-nums"] }]}>{p.optional}</Txt>
          </View>
          <SelectBox label={p.district} value={district?.name ?? p.districtNone} onPress={() => setSheet("district")} invalid={invalid.includes("districtId")} />
          {err("districtId") ? <Txt style={[font(600), { fontSize: 12, color: colors.danger }]}>{err("districtId")}</Txt> : null}
        </View>
        <Txt style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>{p.districtHint}</Txt>
        <Button variant="blue" size="lg" block busy={busy} disabled={busy} onPress={() => void save()}>
          {p.save}
        </Button>
        {saved ? (
          <Txt testID="profile-saved" style={[font(700), { fontSize: 13, color: colors.greenSite }]}>
            {p.saved}
          </Txt>
        ) : null}
        {error ? (
          <Txt accessibilityRole="alert" style={[font(700), { fontSize: 13, color: colors.danger }]}>
            {error}
          </Txt>
        ) : null}
      </View>

      <Sheet visible={sheet !== null} onClose={() => setSheet(null)} title={sheet === "course" ? p.course : p.district} scroll>
        {sheet === "course"
          ? COURSES.map((c) => (
              <OptionRow
                key={c}
                label={p.courseLong[c] ?? c}
                selected={form.course === c}
                onPress={() => {
                  set({ course: c });
                  setSheet(null);
                }}
              />
            ))
          : null}
        {sheet === "district" ? (
          <>
            <OptionRow
              label={p.districtNone}
              selected={!form.districtId}
              onPress={() => {
                set({ districtId: "" });
                setSheet(null);
              }}
            />
            {places.error && !places.data ? <Failed error={places.error} onRetry={() => void places.reload()} /> : null}
            {places.data?.districts.map((x) => (
              <OptionRow
                key={x.id}
                label={x.name}
                selected={form.districtId === x.id}
                onPress={() => {
                  set({ districtId: x.id });
                  setSheet(null);
                }}
              />
            ))}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  select: { height: 52, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14 },
});
