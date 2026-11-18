import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { errorText } from "@/api/client";
import { businessApi } from "@/api/endpoints";
import { BusinessTop } from "@/business/header";
import { copy } from "@/copy";
import { useApp } from "@/state";
import { WorkingHoursField } from "@/ui/time-pickers";
import { colors, em, font } from "@/theme";
import { ErrorBox, Eyebrow, Field, Grow, Label, Note, PrimaryButton, Screen, Title, Txt } from "@/ui/kit";

const DESCRIPTION_MAX = 120;

/** B7 · Tafsilotlar (2/4): ish vaqti, STIR, qisqacha tavsif (mas'ul shaxs — keyingi qadamda). */
export default function BusinessDetails() {
  const { flow, setDraft } = useApp();
  const d = flow.business;
  const [invalid, setInvalid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const b = copy.business;

  const next = async () => {
    setBusy(true);
    setError(null);
    try {
      // Mas'ul shaxs 3-qadamda (B8) — bu yerda uning xatosi hisobga olinmaydi
      const fields = (await businessApi.validate("details", { workingHours: d.workingHours, tin: d.tin, description: d.description })).fields.filter((f) => f !== "contactName");
      setInvalid(fields);
      if (fields.length > 0) setError(copy.student.fieldError);
      else router.push("/business/docs");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BusinessTop step={2} />

      <View style={styles.hero}>
        <Eyebrow>{b.eyebrow2}</Eyebrow>
        <Title text={b.title2} size={40} tone="blue" style={styles.title} />
      </View>

      <View style={styles.first}>
        <Label>{b.hours}</Label>
        <WorkingHoursField value={d.workingHours} onChange={(workingHours) => setDraft({ workingHours })} invalid={invalid.includes("workingHours")} />
      </View>

      <View style={styles.block}>
        <Label>{b.tin}</Label>
        <Field
          value={d.tin}
          onChangeText={(tin) => setDraft({ tin: tin.replace(/[^\d ]/g, "") })}
          placeholder={b.tinPlaceholder}
          keyboardType="number-pad"
          invalid={invalid.includes("tin")}
          maxLength={11}
          returnKeyType="next"
          inputStyle={{ letterSpacing: em(19, 0.06) }}
        />
        <Note>{b.tinNote}</Note>
      </View>

      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Label style={styles.noMargin}>{b.description}</Label>
          <Txt style={[font(600), { fontSize: 13, color: colors.muted2 }]}>
            {d.description.length}/{DESCRIPTION_MAX}
          </Txt>
        </View>
        <View style={[styles.area, focused && styles.areaFocus, invalid.includes("description") && { borderColor: colors.danger }]}>
          <TextInput
            value={d.description}
            onChangeText={(description) => setDraft({ description })}
            multiline
            maxLength={DESCRIPTION_MAX}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            selectionColor={colors.blue}
            maxFontSizeMultiplier={1.25}
            accessibilityLabel={b.description}
            style={[font(600), styles.areaInput]}
          />
        </View>
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      <PrimaryButton tone="orange" onPress={() => void next()} loading={busy} style={styles.cta}>
        {b.nextDocs}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 26 },
  title: { marginTop: 8 },
  first: { marginTop: 24 },
  block: { marginTop: 18 },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  noMargin: { marginBottom: 0 },
  area: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
  areaFocus: { borderColor: colors.blue, boxShadow: "0 0 0 1px #2432D6, 0 0 0 5px rgba(36, 50, 214, 0.15)" },
  areaInput: { minHeight: 72, padding: 0, fontSize: 17, lineHeight: 24, color: colors.ink, textAlignVertical: "top" },
  cta: { marginTop: 24 },
});
