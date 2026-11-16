import { router, useCanGoBack } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { studentApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { resetTo, useApp } from "@/state";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { BackArrow, Choice, ErrorBox, Eyebrow, Field, FieldBox, Grow, Label, Note, PrimaryButton, RoleChip, Screen, StepBars, Title, TopBar, TopBarSpacer, Txt } from "@/ui/kit";
import { UniversityPicker, type UniversityChoice } from "@/ui/university-picker";

/**
 * RoyxatTalaba (1/3): ism, familiya, OTM, kurs → hisob ochiladi (DRAFT), keyin guvohnoma. Google/Apple bilan kelganda
 * (SMS va parolsiz) ism provayderdan oldindan to'ldiriladi.
 */
export default function StudentRegister() {
  const { flow, signIn } = useApp();
  const canGoBack = useCanGoBack();
  const [firstName, setFirstName] = useState(flow.social?.firstName ?? "");
  const [lastName, setLastName] = useState(flow.social?.lastName ?? "");
  const [university, setUniversity] = useState<UniversityChoice | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = copy.student;

  const submit = async () => {
    if (!flow.registrationTicket) return setError(copy.login.stepExpired);
    const missing = [
      !firstName.trim() && "firstName",
      !lastName.trim() && "lastName",
      !university && "universityId",
      !course && "course",
    ].filter((f): f is string => Boolean(f));
    setInvalid(missing);
    if (missing.length > 0 || !university || !course) return setError(s.fieldError);
    setBusy(true);
    setError(null);
    try {
      await signIn(
        await studentApi.register({
          registrationTicket: flow.registrationTicket,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          universityId: university.id,
          universityOther: university.id === "other" ? university.name : undefined,
          course,
        }),
      );
      resetTo("/student/card");
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) setInvalid(e.fields);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const bad = (field: string) => invalid.includes(field) || (field === "universityId" && invalid.includes("universityOther"));

  return (
    <Screen>
      <TopBar>
        {canGoBack ? <BackArrow label={copy.back} onPress={() => router.back()} /> : <TopBarSpacer />}
        <StepBars total={3} current={1} label={s.steps(1)} />
        <RoleChip tone="student">{copy.role.student}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <Eyebrow>{s.eyebrow1}</Eyebrow>
        <Title text={s.title1} size={42} tone="green" style={styles.title} />
      </View>

      <View style={styles.names}>
        <View style={styles.half}>
          <Label>{s.firstName}</Label>
          <Field value={firstName} onChangeText={setFirstName} placeholder={s.firstNamePlaceholder} invalid={bad("firstName")} autoComplete="given-name" textContentType="givenName" autoCapitalize="words" />
        </View>
        <View style={styles.half}>
          <Label>{s.lastName}</Label>
          <Field value={lastName} onChangeText={setLastName} placeholder={s.lastNamePlaceholder} invalid={bad("lastName")} autoComplete="family-name" textContentType="familyName" autoCapitalize="words" />
        </View>
      </View>

      <View style={styles.block}>
        <Label>{s.university}</Label>
        <Pressable onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel={university?.name ?? s.universityPlaceholder}>
          <FieldBox invalid={bad("universityId")} style={styles.select}>
            <Icon name="search" size={22} strokeWidth={2.4} color={colors.muted2} />
            <Txt numberOfLines={1} style={[university ? font(700) : font(600), styles.selectText, { color: university ? colors.ink : colors.muted2 }]}>
              {university?.name ?? s.universityPlaceholder}
            </Txt>
            <Icon name="chevronDown" size={20} strokeWidth={2.6} />
          </FieldBox>
        </Pressable>
        <Note>
          {s.universityNoteLead}
          <Txt style={[font(700), { color: colors.blue }]}>{s.universityNoteAction}</Txt>
          {s.universityNoteTail}
        </Note>
      </View>

      <View style={styles.block}>
        <Label>{s.course}</Label>
        <View style={styles.courses} accessibilityRole="radiogroup">
          {s.courses.map((c) => (
            <Choice key={c.value} shape={c.value === "MASTER" ? "wide" : "square"} selected={course === c.value} onPress={() => setCourse(c.value)}>
              {c.label}
            </Choice>
          ))}
        </View>
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      <PrimaryButton onPress={() => void submit()} loading={busy} style={styles.cta}>
        {copy.next}
      </PrimaryButton>

      <UniversityPicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(choice) => {
          setUniversity(choice);
          setPicker(false);
          setInvalid((f) => f.filter((x) => x !== "universityId" && x !== "universityOther"));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 28 },
  title: { marginTop: 8 },
  names: { flexDirection: "row", gap: 12, marginTop: 24 },
  half: { flex: 1, minWidth: 0 },
  block: { marginTop: 18 },
  select: { gap: 12 },
  selectText: { flex: 1, fontSize: 17 },
  courses: { flexDirection: "row", gap: 8 },
  cta: { marginTop: 24 },
});
