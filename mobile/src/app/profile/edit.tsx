import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { appApi, studentApi, type StudentProfile } from "@/api/endpoints";
import { copy } from "@/copy";
import { initials } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { useApp } from "@/state";
import { colors, font } from "@/theme";
import { Card, Failed, InfoRow, Loading, OptionRow, RoundButton, Sheet } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Choice, ErrorBox, Field, FieldBox, Label, Note, PrimaryButton, Screen, Title, TopBar, Txt } from "@/ui/kit";
import { PhotoField } from "@/ui/photo-field";

/** "2027-06-30" → "30.06.2027" */
const dateText = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/**
 * Ma'lumotlarni tahrirlash (saytdagi `/profil/tahrir`, qoidalar `src/lib/profile.ts`): rasm (kvadrat kesiladi, 512×512),
 * ism, familiya, kurs, fakultet, tuman. Universitet, ID va guvohnoma — faqat ko'rish uchun. Dizaynda chizilmagan ekran —
 * ilova primitivlaridan (RoyxatTalaba maydonlari).
 */
export default function ProfileEdit() {
  const remote = useLoad(useCallback(() => studentApi.profile(), []));
  if (remote.data) return <EditForm initial={remote.data.profile} />;
  return (
    <Screen scroll={false}>
      <TopBar>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => router.back()} />
      </TopBar>
      {remote.error ? <Failed error={remote.error} onRetry={() => void remote.reload()} /> : <Loading />}
    </Screen>
  );
}

function EditForm({ initial }: { initial: StudentProfile }) {
  const p = copy.profileEdit;
  const s = copy.student;
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
  const [busy, setBusy] = useState(false);
  const [districtSheet, setDistrictSheet] = useState(false);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setInvalid((list) => list.filter((k) => !(k in patch)));
    setError(null);
  };
  const district = places.data?.districts.find((x) => x.id === form.districtId) ?? null;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await studentApi.saveProfile(form);
      restoreMe(user);
      Alert.alert(p.saved);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) {
        setInvalid(e.fields);
        setError(p.errors[e.fields[0]!] ?? errorText(e));
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key: string) => (invalid.includes(key) ? <Note error>{p.errors[key] ?? s.fieldError}</Note> : null);

  return (
    <Screen>
      <TopBar>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => router.back()} />
      </TopBar>
      <Title text={p.title} size={34} style={styles.title} />

      <View style={styles.block}>
        <PhotoField
          url={initial.avatarUrl}
          fallback={initials(form.firstName, form.lastName) || "T"}
          label={p.photo}
          hint={p.photoHint}
          onPick={async (file) => {
            await studentApi.uploadAvatar(file);
          }}
          onRemove={async () => {
            await studentApi.removeAvatar();
          }}
        />
      </View>

      <View style={styles.block}>
        <Label>{p.firstName}</Label>
        <Field
          value={form.firstName}
          onChangeText={(v) => set({ firstName: v })}
          invalid={invalid.includes("firstName")}
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          text={17}
        />
        {fieldError("firstName")}
      </View>
      <View style={styles.block}>
        <Label>{p.lastName}</Label>
        <Field
          value={form.lastName}
          onChangeText={(v) => set({ lastName: v })}
          invalid={invalid.includes("lastName")}
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="next"
          text={17}
        />
        {fieldError("lastName")}
      </View>

      <View style={styles.block}>
        <Label>{p.course}</Label>
        <View style={styles.courses} accessibilityRole="radiogroup">
          {s.courses.map((c) => (
            <Choice key={c.value} shape={c.value === "MASTER" ? "wide" : "square"} selected={form.course === c.value} onPress={() => set({ course: c.value })}>
              {c.label}
            </Choice>
          ))}
        </View>
        {fieldError("course")}
      </View>

      <View style={styles.block}>
        <Label>{p.faculty}</Label>
        <Field value={form.faculty} onChangeText={(v) => set({ faculty: v })} placeholder={p.facultyPlaceholder} invalid={invalid.includes("faculty")} maxLength={80} returnKeyType="done" text={17} />
        {fieldError("faculty")}
      </View>

      <View style={styles.block}>
        <Label>{p.district}</Label>
        <Pressable onPress={() => setDistrictSheet(true)} accessibilityRole="button" accessibilityLabel={`${p.district}: ${district?.name ?? p.districtNone}`}>
          <FieldBox invalid={invalid.includes("districtId")} style={styles.select}>
            <Txt style={[font(700), styles.selectText, district ? null : { color: colors.muted2 }]}>{district?.name ?? p.districtNone}</Txt>
            <Icon name="chevronDown" size={20} strokeWidth={2.4} color={colors.muted} />
          </FieldBox>
        </Pressable>
        {invalid.includes("districtId") ? fieldError("districtId") : <Note>{p.districtHint}</Note>}
      </View>

      <Txt style={[font(900, 112), styles.section]}>{p.readOnly}</Txt>
      <Card style={styles.card}>
        <InfoRow icon="student" label={p.university} value={initial.university.shortName || initial.university.name} />
        <InfoRow icon="idCard" label={copy.profile.id} value={initial.publicId} last={!initial.cardNumber && !initial.cardExpiresAt} />
        {initial.cardNumber ? <InfoRow icon="doc" label={p.cardNumber} value={initial.cardNumber} last={!initial.cardExpiresAt} /> : null}
        {initial.cardExpiresAt ? <InfoRow icon="clock" label={p.cardExpires} value={dateText(initial.cardExpiresAt)} last /> : null}
      </Card>
      <Note>{p.readOnlyHint}</Note>

      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton icon="tick" onPress={() => void save()} loading={busy} style={styles.cta}>
        {p.save}
      </PrimaryButton>

      <Sheet visible={districtSheet} onClose={() => setDistrictSheet(false)} title={p.district} scroll>
        <OptionRow
          label={p.districtNone}
          selected={!form.districtId}
          onPress={() => {
            set({ districtId: "" });
            setDistrictSheet(false);
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
              setDistrictSheet(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 18 },
  block: { marginTop: 20 },
  courses: { flexDirection: "row", gap: 8 },
  select: { justifyContent: "space-between", gap: 12 },
  selectText: { flex: 1, fontSize: 17 },
  section: { marginTop: 28, fontSize: 20 },
  card: { marginTop: 12 },
  cta: { marginTop: 24 },
});
