import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { bizApi, type BusinessProfile, type ProfileEdit } from "@/api/business";
import { copy } from "@/copy";
import { WorkingHoursField } from "@/ui/time-pickers";
import { displayPhone, localDigits } from "@/lib/phone";
import { useLoad } from "@/lib/use-load";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, font } from "@/theme";
import { Card, Failed, Loading, RoundButton } from "@/ui/app";
import { ErrorBox, Field, Label, Note, PrimaryButton, Screen, Title, TopBar, Txt } from "@/ui/kit";
import { PhotoField } from "@/ui/photo-field";

/**
 * Biznes ma'lumotlari (saytdagi `/biznes/profil/tahrir`): logotip (kvadrat kesiladi, 512×512), nom, manzil, mo'ljal,
 * ish vaqti, tavsif va talabalar uchun aloqa. Nom yoki manzil o'zgargan bo'lsa — saqlashdan OLDIN ogohlantiriladi:
 * biznes qayta tekshiruvga tushadi (server `rereview`), ilova tekshiruv ekraniga o'tadi.
 */
export default function BusinessEdit() {
  const remote = useLoad(useCallback(() => bizApi.profile(), []));
  if (remote.data) return <EditForm initial={remote.data.profile} />;
  return <Screen scroll={false}>{remote.error ? <Failed error={remote.error} onRetry={() => void remote.reload()} /> : <Loading />}</Screen>;
}

function EditForm({ initial: b }: { initial: BusinessProfile }) {
  const ed = copy.biz.edit;
  const { reloadMe } = useApp();
  const [form, setForm] = useState<ProfileEdit>({
    name: b.name,
    address: b.address,
    landmark: b.landmark ?? "",
    workingHours: b.workingHours,
    description: b.description ?? "",
    phone: b.publicPhone ? displayPhone(localDigits(b.publicPhone)) : "",
    telegram: b.telegram ? `@${b.telegram}` : "",
    instagram: b.instagram ? `@${b.instagram}` : "",
  });
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<ProfileEdit>) => {
    setForm({ ...form, ...patch });
    setError(null);
  };
  const field = (key: keyof ProfileEdit, label: string, placeholder?: string, extra: Partial<React.ComponentProps<typeof Field>> = {}) => (
    <View style={styles.block}>
      <Label>{label}</Label>
      <Field value={form[key]} onChangeText={(v) => set({ [key]: v })} placeholder={placeholder} invalid={invalid.includes(key)} text={17} returnKeyType="next" {...extra} />
      {invalid.includes(key) ? <Note error>{ed.errors[key] ?? ""}</Note> : null}
    </View>
  );

  // Saytdagi `editBusinessInfo` bilan bir xil taqqoslash: bo'shliqlarsiz nom yoki manzil o'zgarsa — qayta tekshiruv
  const rereview = form.name.trim() !== b.name.trim() || form.address.trim() !== b.address.trim();

  const confirmSave = () => {
    if (!rereview) {
      void save();
      return;
    }
    Alert.alert(ed.rereviewTitle, ed.rereviewText, [
      { text: ed.cancel, style: "cancel" },
      { text: ed.rereviewConfirm, onPress: () => void save() },
    ]);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInvalid([]);
    try {
      const result = await bizApi.editProfile(form);
      if (result.rereview) {
        Alert.alert(ed.savedRereview);
        resetTo(routeFor(await reloadMe()));
      } else {
        Alert.alert(ed.saved);
        router.back();
      }
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) {
        setInvalid(e.fields);
        setError(ed.errors[e.fields[0]!] ?? errorText(e));
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => router.back()} />
      </TopBar>
      <Title text={ed.title} size={34} style={styles.title} />
      <Card style={styles.note}>
        <Txt style={styles.noteText}>{ed.note}</Txt>
      </Card>

      <View style={styles.block}>
        <PhotoField
          url={b.logoUrl}
          fallback={b.name.trim().charAt(0).toUpperCase() || "B"}
          label={ed.logo}
          hint={ed.logoHint}
          tone="orange"
          onPick={async (file) => {
            await bizApi.uploadLogo(file);
          }}
          onRemove={async () => {
            await bizApi.removeLogo();
          }}
        />
      </View>

      {field("name", ed.name)}
      {field("address", ed.address)}
      {field("landmark", ed.landmark, ed.landmarkPlaceholder)}
      <View style={styles.block}>
        <Label>{ed.hours}</Label>
        <WorkingHoursField value={form.workingHours} onChange={(workingHours) => set({ workingHours })} invalid={invalid.includes("workingHours")} />
        {invalid.includes("workingHours") ? <Note error>{ed.errors.workingHours ?? ""}</Note> : null}
      </View>
      {field("description", ed.description, undefined, { multiline: true, height: 64, returnKeyType: "default" })}

      <Txt style={[font(900, 112), styles.section]}>{copy.biz.profile.contacts}</Txt>
      <Note>{ed.contactHint}</Note>
      {field("phone", ed.phone, ed.phonePlaceholder, { keyboardType: "phone-pad" })}
      {field("telegram", ed.telegram, ed.telegramPlaceholder, { autoCapitalize: "none", autoCorrect: false })}
      {field("instagram", ed.instagram, ed.instagramPlaceholder, { autoCapitalize: "none", autoCorrect: false, returnKeyType: "done" })}

      <ErrorBox>{error}</ErrorBox>
      <PrimaryButton tone="orange" icon="tick" onPress={confirmSave} loading={busy} style={styles.cta}>
        {ed.save}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 18 },
  note: { marginTop: 14, padding: 14 },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.ink5 },
  block: { marginTop: 16 },
  section: { marginTop: 26, fontSize: 20 },
  cta: { marginTop: 24 },
});
