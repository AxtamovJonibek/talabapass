import { router, useCanGoBack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { businessApi, type BusinessInfo } from "@/api/endpoints";
import { copy } from "@/copy";
import { localDigits } from "@/lib/phone";
import { pickImage } from "@/lib/pick";
import { resetTo, useApp, type BusinessDraft } from "@/state";
import { colors, em } from "@/theme";
import { Icon } from "@/ui/icons";
import { BackArrow, ErrorBox, Eyebrow, Field, Grow, Label, PhoneBox, PrimaryButton, RoleChip, Screen, Title, TopBar, TopBarSpacer, Txt } from "@/ui/kit";

const TELEGRAM = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

const infoOf = (d: BusinessDraft): BusinessInfo => ({ name: d.name.trim(), address: d.address.trim(), tin: d.tin, phone: `+998${d.phone}`, telegram: d.telegram.trim() });

/** Telefondagi tekshiruv — server baribir qayta tekshiradi (`validateQuickApplication`). */
function invalidFields(d: BusinessDraft): string[] {
  const out: string[] = [];
  if (d.name.trim().length < 2) out.push("name");
  if (d.address.trim().length < 5) out.push("address");
  if (d.tin.replace(/\D/g, "").length !== 9) out.push("tin");
  if (d.phone.length !== 9) out.push("phone");
  if (!TELEGRAM.test(d.telegram.trim())) out.push("telegram");
  return out;
}

/**
 * Biznes arizasi — bitta ekran: nom, manzil, STIR, telefon, Telegram, rasm (ixtiyoriy). Yuborilganda hisob va ariza ochiladi
 * (qayta kirganda — mavjud ariza tuzatiladi), rasm yuklanadi, ariza tekshiruvga ketadi. Kategoriya, ish vaqti va joylashuvni admin to'ldiradi.
 * Qayta kirgan egasi (ariza yuborilmagan yoki rad etilgan) — maydonlar serverdagi arizadan to'ldiriladi.
 */
export default function BusinessInfoScreen() {
  const { me, flow, setDraft, signIn, reloadMe } = useApp();
  const d = flow.business;
  const canGoBack = useCanGoBack();
  const [invalid, setInvalid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const resuming = me?.role === "BUSINESS_OWNER" && !d.loaded;
  const [loading, setLoading] = useState(resuming);
  const [error, setError] = useState<string | null>(null);
  const b = copy.business;

  useEffect(() => {
    if (!resuming) return;
    businessApi
      .application()
      .then(({ application: a }) => {
        if (!a.editable) return resetTo("/business/review");
        setDraft({
          loaded: true,
          name: a.name,
          address: a.address,
          tin: a.tin ?? "",
          phone: a.phone ? localDigits(a.phone) : "",
          telegram: a.telegram ? `@${a.telegram}` : "",
          logo: a.hasLogo ? { uri: "", name: "logo", type: "", uploaded: true } : null,
        });
        if (a.status === "REJECTED" && a.rejectReason) setError(a.rejectReason);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, [resuming, setDraft]);

  const choosePhoto = async () => {
    try {
      const file = await pickImage("logo.jpg");
      if (file) setDraft({ logo: file });
    } catch (e) {
      setError(errorText(e));
    }
  };

  const submit = async () => {
    if (busy) return;
    const bad = invalidFields(d);
    setInvalid(bad);
    if (bad.length > 0) return setError(copy.student.fieldError);

    setBusy(true);
    setError(null);
    try {
      if (!me) {
        if (!flow.registrationTicket) throw new ApiError("step_expired", copy.login.stepExpired, 401);
        // Hisob ochilgach qayta urinish serverdagi arizani qayta o'qib, kiritilganini bosib ketmasin
        setDraft({ loaded: true });
        await signIn(await businessApi.register(flow.registrationTicket, infoOf(d)));
      } else {
        await businessApi.update(infoOf(d));
      }
      if (d.logo && !d.logo.uploaded) {
        await businessApi.uploadLogo(d.logo);
        setDraft({ logo: { ...d.logo, uploaded: true } });
      }
      await businessApi.submit();
      await reloadMe().catch(() => undefined);
      resetTo("/business/review");
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) setInvalid(e.fields);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar>
        {canGoBack ? <BackArrow label={copy.back} onPress={() => router.back()} /> : <TopBarSpacer />}
        <RoleChip tone="business">{copy.role.business}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <Eyebrow>{b.eyebrow}</Eyebrow>
        <Title text={b.title} size={40} style={styles.title} />
      </View>

      {loading ? <ActivityIndicator color={colors.orange} style={styles.loading} /> : null}

      <View style={styles.block}>
        <Label>{b.name}</Label>
        <Field value={d.name} onChangeText={(name) => setDraft({ name })} placeholder={b.namePlaceholder} invalid={invalid.includes("name")} maxLength={60} returnKeyType="next" />
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
          returnKeyType="next"
        />
      </View>

      <View style={styles.block}>
        <Label>{b.tin}</Label>
        <Field
          value={d.tin}
          onChangeText={(tin) => setDraft({ tin: tin.replace(/\D/g, "").slice(0, 9) })}
          placeholder={b.tinPlaceholder}
          keyboardType="number-pad"
          invalid={invalid.includes("tin")}
          maxLength={9}
          inputStyle={{ letterSpacing: em(19, 0.06) }}
        />
      </View>

      <View style={styles.block}>
        <Label>{b.phone}</Label>
        <PhoneBox value={d.phone} onChange={(phone) => setDraft({ phone })} invalid={invalid.includes("phone")} />
      </View>

      <View style={styles.block}>
        <Label>{b.telegram}</Label>
        <Field
          value={d.telegram}
          onChangeText={(telegram) => setDraft({ telegram })}
          placeholder={b.telegramPlaceholder}
          invalid={invalid.includes("telegram")}
          maxLength={33}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>

      <View style={styles.block}>
        <Label>{b.photo}</Label>
        <Pressable onPress={() => void choosePhoto()} accessibilityRole="button" accessibilityLabel={b.photoPick} style={styles.photoRow}>
          <View style={styles.photo}>
            {d.logo?.uri ? (
              <Image source={{ uri: d.logo.uri }} style={styles.photoImage} />
            ) : d.logo?.uploaded ? (
              <Icon name="tick" size={24} strokeWidth={3} color={colors.greenOk} />
            ) : (
              <Icon name="plus" size={24} strokeWidth={2.4} color={colors.muted} />
            )}
          </View>
          <Txt style={styles.photoHint}>{b.photoHint}</Txt>
        </Pressable>
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      <PrimaryButton tone="orange" onPress={() => void submit()} loading={busy} style={styles.cta}>
        {busy ? b.submitting : b.submit}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 26 },
  title: { marginTop: 8 },
  loading: { marginTop: 16 },
  block: { marginTop: 18 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 58, height: 58, borderRadius: 18, backgroundColor: colors.white, borderWidth: 2, borderStyle: "dashed", borderColor: colors.muted2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoImage: { width: "100%", height: "100%" },
  photoHint: { fontSize: 14, color: colors.muted2 },
  cta: { marginTop: 24 },
});
