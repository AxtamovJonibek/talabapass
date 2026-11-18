import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, errorText } from "@/api/client";
import { bizApi, type BusinessProfile, type ProfileEdit } from "@/api/business";
import { copy } from "@/copy";
import { displayPhone, localDigits } from "@/lib/phone";
import { useLoad } from "@/lib/use-load";
import { AvatarEditor } from "@/site/avatar";
import { WorkingHoursField } from "@/site/time";
import { Button, SiteField, SiteInput } from "@/site/ui";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { KEYBOARD_GAP, Press, Txt } from "@/ui/kit";

/**
 * Biznes ma'lumotlari — saytdagi `/biznes/profil/tahrir` telefon ko'rinishi: "← Biznes profili", logotip, nom, manzil,
 * mo'ljal, ish vaqti, tavsif, talabalar uchun aloqa, izoh va "Saqlash". Nom yoki manzil o'zgarsa — saqlashdan oldin
 * ogohlantiriladi (biznes qayta tekshiruvga tushadi, ilova tekshiruv ekraniga o'tadi).
 */
export default function BusinessEdit() {
  const insets = useSafeAreaInsets();
  const remote = useLoad(useCallback(() => bizApi.profile(), []));
  const [round, setRound] = useState(0);
  const { reload } = remote;

  // Tab ekrani joyida qoladi: har kirishda saqlangan ma'lumotdan yangi forma
  useFocusEffect(
    useCallback(() => {
      void reload().then(() => setRound((r) => r + 1));
    }, [reload]),
  );

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 50 }]}
      bottomOffset={KEYBOARD_GAP}
      keyboardShouldPersistTaps="handled"
    >
      <Press onPress={() => router.navigate("/panel/profile")} accessibilityRole="link" scale={0.98} style={styles.back}>
        <Txt style={[font(700), { fontSize: 14, color: colors.rust }]}>{`← ${copy.biz.edit.back}`}</Txt>
      </Press>
      <Txt accessibilityRole="header" style={[font(900, 110), styles.title]}>
        {copy.biz.edit.title}
      </Txt>
      {remote.data ? <EditForm key={round} initial={remote.data.profile} /> : remote.error ? <Failed error={remote.error} onRetry={() => void remote.reload()} /> : <Loading />}
    </KeyboardAwareScrollView>
  );
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
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<ProfileEdit>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
    setSaved(false);
  };
  const bad = (key: keyof ProfileEdit) => invalid.includes(key);
  const err = (key: keyof ProfileEdit) => (bad(key) ? (ed.errors[key] ?? "") : null);

  // Saytdagi `editBusinessInfo` bilan bir xil taqqoslash: bo'shliqlarsiz nom yoki manzil o'zgarsa — qayta tekshiruv
  const rereview = form.name.trim() !== b.name.trim() || form.address.trim() !== b.address.trim();

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
      } else setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) {
        setInvalid(e.fields);
        setError(ed.errors[e.fields[0]!] ?? errorText(e));
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmSave = () => {
    if (!rereview) return void save();
    Alert.alert(ed.rereviewTitle, ed.rereviewText, [
      { text: ed.cancel, style: "cancel" },
      { text: ed.rereviewConfirm, onPress: () => void save() },
    ]);
  };

  return (
    <View style={{ gap: 16 }}>
      <AvatarEditor
        kind="business"
        url={b.logoUrl}
        fallback={b.name.trim().charAt(0).toUpperCase()}
        onPick={async (file) => {
          await bizApi.uploadLogo(file);
        }}
        onRemove={async () => {
          await bizApi.removeLogo();
        }}
      />
      <View style={{ gap: 14 }}>
        <SiteField label={ed.name} error={err("name")}>
          <SiteInput value={form.name} onChangeText={(name) => set({ name })} maxLength={60} invalid={bad("name")} returnKeyType="next" />
        </SiteField>
        <SiteField label={ed.address} error={err("address")}>
          <SiteInput value={form.address} onChangeText={(address) => set({ address })} maxLength={160} invalid={bad("address")} returnKeyType="next" />
        </SiteField>
        <SiteField label={ed.landmark} error={err("landmark")}>
          <SiteInput value={form.landmark} onChangeText={(landmark) => set({ landmark })} maxLength={140} placeholder={ed.landmarkPlaceholder} invalid={bad("landmark")} />
        </SiteField>
        {/* saytda `legend` (fieldset gap'iga kirmaydi) + mb-1.5 */}
        <View>
          <Txt style={[font(600), { fontSize: 13, marginBottom: 6 }]}>{ed.hours}</Txt>
          <WorkingHoursField value={form.workingHours} onChange={(workingHours) => set({ workingHours })} error={err("workingHours")} />
        </View>
        <SiteField label={ed.description} error={err("description")}>
          <SiteInput multiline value={form.description} onChangeText={(description) => set({ description })} invalid={bad("description")} style={styles.textarea} />
        </SiteField>
        <View style={{ gap: 14 }}>
          <Txt style={[font(800), { fontSize: 15, marginBottom: 4 }]}>{copy.biz.profile.contacts}</Txt>
          <Txt style={styles.small}>{ed.contactHint}</Txt>
          <SiteField label={ed.phone} error={err("phone")}>
            <SiteInput mono keyboardType="phone-pad" value={form.phone} onChangeText={(phone) => set({ phone })} placeholder={ed.phonePlaceholder} invalid={bad("phone")} style={{ fontSize: 14 }} />
          </SiteField>
          <SiteField label={ed.telegram} error={err("telegram")}>
            <SiteInput autoCapitalize="none" autoCorrect={false} value={form.telegram} onChangeText={(telegram) => set({ telegram })} placeholder={ed.telegramPlaceholder} invalid={bad("telegram")} />
          </SiteField>
          <SiteField label={ed.instagram} error={err("instagram")}>
            <SiteInput autoCapitalize="none" autoCorrect={false} value={form.instagram} onChangeText={(instagram) => set({ instagram })} placeholder={ed.instagramPlaceholder} invalid={bad("instagram")} />
          </SiteField>
        </View>
        <Txt style={styles.small}>{ed.note}</Txt>
        <Button variant="orange" size="lg" block busy={busy} disabled={busy} onPress={confirmSave}>
          {ed.save}
        </Button>
        {saved ? (
          <Txt testID="business-saved" style={[font(700), { fontSize: 13, color: colors.greenSite }]}>
            {ed.saved}
          </Txt>
        ) : null}
        {error ? (
          <Txt accessibilityRole="alert" style={[font(700), { fontSize: 13, color: colors.danger }]}>
            {error}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { height: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { marginBottom: 16, fontSize: 28, letterSpacing: em(28, -0.03) },
  textarea: { height: 88, paddingTop: 12, textAlignVertical: "top" },
  small: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
