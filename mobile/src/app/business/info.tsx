import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { businessApi } from "@/api/endpoints";
import { BusinessTop } from "@/business/header";
import { copy } from "@/copy";
import { FileTooLargeError, pickImage } from "@/lib/pick";
import { resetTo, useApp } from "@/state";
import { colors } from "@/theme";
import { Icon } from "@/ui/icons";
import { Choice, ErrorBox, Eyebrow, Field, Grow, Label, PrimaryButton, Screen, Title } from "@/ui/kit";

/**
 * B6 · Biznes haqida (1/4): logo, nom, kategoriya, manzil — serverda tekshiriladi (`/business/validate`, saqlamaydi).
 * Qayta kirgan egasi (ariza yuborilmagan yoki rad etilgan) — maydonlar serverdagi arizadan to'ldiriladi.
 */
export default function BusinessInfo() {
  const { me, flow, setDraft } = useApp();
  const d = flow.business;
  const [invalid, setInvalid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const resuming = me?.role === "BUSINESS_OWNER" && !d.loaded;
  const [loading, setLoading] = useState(resuming);
  const [error, setError] = useState<string | null>(null);
  const b = copy.business;

  // Qayta kirish: ariza bor — undan to'ldirish (fayllar serverda: guvohnoma va fotolar "yuklangan" deb ko'rsatiladi)
  useEffect(() => {
    if (!resuming) return;
    businessApi
      .application()
      .then(({ application: a }) => {
        if (!a.editable) return resetTo("/business/review");
        const registration = a.documents.find((doc) => doc.kind === "REGISTRATION");
        setDraft({
          loaded: true,
          name: a.name,
          kind: a.kind,
          address: a.address,
          workingHours: a.workingHours,
          tin: a.tin,
          description: a.description ?? "",
          contactName: a.contactName ?? "",
          registration: registration ? { uri: "", name: registration.fileName, type: "", uploaded: true, serverId: registration.id } : null,
          photos: a.documents.filter((doc) => doc.kind === "PHOTO").map((doc) => ({ uri: "", name: doc.fileName, type: "", uploaded: true, serverId: doc.id })),
          logo: a.hasLogo ? { uri: "", name: "logo", type: "", uploaded: true } : null,
        });
        if (a.status === "REJECTED" && a.rejectReason) setError(a.rejectReason);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [resuming, setDraft]);

  const chooseLogo = async () => {
    try {
      const file = await pickImage("logo.jpg");
      if (file) setDraft({ logo: file });
    } catch (e) {
      setError(e instanceof FileTooLargeError ? copy.fileTooLarge : errorText(e));
    }
  };

  const next = async () => {
    setBusy(true);
    setError(null);
    try {
      const { fields } = await businessApi.validate("info", { name: d.name, kind: d.kind, address: d.address });
      setInvalid(fields);
      if (fields.length > 0) setError(copy.student.fieldError);
      else router.push("/business/details");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <BusinessTop step={1} />

      <View style={styles.hero}>
        <Eyebrow>{b.eyebrow1}</Eyebrow>
        <Title text={b.title1} size={40} style={styles.title} />
      </View>

      {loading ? <ActivityIndicator color={colors.orange} style={styles.loading} /> : null}

      <View style={styles.nameRow}>
        <View>
          <Label>{b.logo}</Label>
          <Pressable onPress={() => void chooseLogo()} accessibilityRole="button" accessibilityLabel={b.logoUpload} style={styles.logo}>
            {d.logo?.uri ? (
              <Image source={{ uri: d.logo.uri }} style={styles.logoImage} />
            ) : d.logo?.uploaded ? (
              <Icon name="tick" size={24} strokeWidth={3} color={colors.greenOk} />
            ) : (
              <Icon name="plus" size={24} strokeWidth={2.4} color={colors.muted} />
            )}
          </Pressable>
        </View>
        <View style={styles.flex}>
          <Label>{b.name}</Label>
          <Field value={d.name} onChangeText={(name) => setDraft({ name })} placeholder={b.namePlaceholder} invalid={invalid.includes("name")} maxLength={60} boxStyle={styles.nameBox} />
        </View>
      </View>

      <View style={styles.block}>
        <Label>{b.kind}</Label>
        <View style={styles.kinds} accessibilityRole="radiogroup">
          {b.kinds.map((k) => (
            <Choice key={k.value} shape="pill" selected={d.kind === k.value} onPress={() => setDraft({ kind: k.value })}>
              {k.label}
            </Choice>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <Label>{b.address}</Label>
        <Field
          value={d.address}
          onChangeText={(address) => setDraft({ address })}
          placeholder={b.addressPlaceholder}
          icon={{ name: "pin", color: colors.orange }}
          text={17}
          invalid={invalid.includes("address")}
          maxLength={160}
        />
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      <PrimaryButton tone="orange" onPress={() => void next()} loading={busy} style={styles.cta}>
        {copy.next}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 26 },
  title: { marginTop: 8 },
  loading: { marginTop: 16 },
  nameRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 22 },
  flex: { flex: 1, minWidth: 0 },
  // Dizaynda bu maydon border-box (58 jami), logo katagi bilan bir balandlikda
  nameBox: { height: 58 },
  logo: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.white, borderWidth: 2, borderStyle: "dashed", borderColor: colors.muted2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  block: { marginTop: 18 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cta: { marginTop: 24 },
});
