import { useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { businessApi, type BusinessInfo } from "@/api/endpoints";
import { BusinessTop } from "@/business/header";
import { copy } from "@/copy";
import { pickDocument, pickImage } from "@/lib/pick";
import { displayPhone, localDigits } from "@/lib/phone";
import { resetTo, useApp, type BusinessDraft } from "@/state";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { LEGAL, openSite } from "@/ui/legal";
import { ErrorBox, Eyebrow, Field, FieldBox, Grow, Label, PrimaryButton, Screen, TickDot, Title, Txt } from "@/ui/kit";

const PHOTOS_MAX = 3;

const infoOf = (d: BusinessDraft): BusinessInfo => ({
  name: d.name.trim(),
  kind: d.kind,
  address: d.address.trim(),
  workingHours: d.workingHours.trim(),
  description: d.description.trim(),
  tin: d.tin,
  contactName: d.contactName.trim(),
});

/**
 * B8 · Hujjatlar (3/4): mas'ul shaxs, tasdiqlangan telefon, ro'yxatdan o'tganlik guvohnomasi, 1–3 joy fotosi,
 * rozilik. "Tekshiruvga yuborish": hisob va ariza (`/business/register`, qayta kirganda `PATCH`) → fayllar → yuborish.
 * Yuklangan fayl belgilanadi — xato bo'lsa qayta bosish faqat qolganlarini yuklaydi.
 */
export default function BusinessDocs() {
  const { me, flow, setDraft, signIn, reloadMe } = useApp();
  const d = flow.business;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactInvalid, setContactInvalid] = useState(false);
  const b = copy.business;
  // Tasdiqlangan aloqa: SMS bilan kelgan raqam yoki (Google/Apple bilan kelganda) email
  const phone = me ? (me.phone ? localDigits(me.phone) : null) : flow.phone || null;
  const email = me ? me.email : (flow.social?.email ?? null);
  const verifiedContact = phone ? { label: b.phone, value: displayPhone(phone) } : email ? { label: b.email, value: email } : null;

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const addPhoto = () =>
    guard(async () => {
      const file = await pickImage(`foto-${d.photos.length + 1}.jpg`);
      if (file) setDraft({ photos: [...d.photos, file] });
    });

  const removePhoto = (i: number) =>
    guard(async () => {
      const photo = d.photos[i];
      if (photo?.serverId) await businessApi.removeDocument(photo.serverId);
      setDraft({ photos: d.photos.filter((_, j) => j !== i) });
    });

  const chooseRegistration = () =>
    guard(async () => {
      const file = await pickDocument();
      if (file) setDraft({ registration: file });
    });

  const removeRegistration = () =>
    guard(async () => {
      if (d.registration?.serverId) await businessApi.removeDocument(d.registration.serverId);
      setDraft({ registration: null });
    });

  const submit = async () => {
    if (busy) return;
    const contactOk = d.contactName.trim().length >= 2;
    setContactInvalid(!contactOk);
    if (!contactOk) return setError(copy.student.fieldError);
    if (!d.registration) return setError(b.needRegistration);
    if (d.photos.length === 0) return setError(b.needPhoto);
    if (!d.consent) return setError(b.needConsent);

    setBusy(true);
    setError(null);
    // Yuklanganlarini shu yerda ham kuzatamiz: setDraft keyingi render'gacha `d` ni yangilamaydi
    const draft: BusinessDraft = { ...d, photos: [...d.photos] };
    try {
      if (!me) {
        if (!flow.registrationTicket) throw new ApiError("step_expired", copy.login.stepExpired, 401);
        await signIn(await businessApi.register(flow.registrationTicket, infoOf(draft)));
      } else {
        await businessApi.update(infoOf(draft));
      }

      if (draft.logo && !draft.logo.uploaded) {
        await businessApi.upload("logo", draft.logo);
        draft.logo = { ...draft.logo, uploaded: true };
        setDraft({ logo: draft.logo });
      }
      if (draft.registration && !draft.registration.uploaded) {
        const { id } = await businessApi.upload("registration", draft.registration);
        draft.registration = { ...draft.registration, uploaded: true, serverId: id };
        setDraft({ registration: draft.registration });
      }
      for (let i = 0; i < draft.photos.length; i++) {
        const photo = draft.photos[i]!;
        if (photo.uploaded) continue;
        const { id } = await businessApi.upload("photo", photo);
        draft.photos[i] = { ...photo, uploaded: true, serverId: id };
        setDraft({ photos: [...draft.photos] });
      }

      await businessApi.submit();
      await reloadMe().catch(() => undefined);
      resetTo("/business/review");
    } catch (e) {
      if (e instanceof ApiError && e.fields.includes("contactName")) setContactInvalid(true);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={32}>
      <BusinessTop step={3} />

      <View style={styles.hero}>
        <Eyebrow>{b.eyebrow3}</Eyebrow>
        <Title text={b.title3} size={36} loose tight tone="green" style={styles.title} />
      </View>

      <View style={styles.first}>
        <Label style={styles.label}>{b.contact}</Label>
        <Field
          height={54}
          text={18}
          value={d.contactName}
          onChangeText={(contactName) => setDraft({ contactName })}
          placeholder={b.contactPlaceholder}
          invalid={contactInvalid}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
        />
      </View>

      {verifiedContact ? (
        <View style={styles.block}>
          <Label style={styles.label}>{verifiedContact.label}</Label>
          <FieldBox height={54} muted style={styles.phone}>
            <Txt numberOfLines={1} style={[font(800), styles.phoneText]}>
              {verifiedContact.value}
            </Txt>
            <View style={styles.verified}>
              <TickDot size={18} stroke={4} />
              <Txt style={[font(800), { fontSize: 13, color: colors.greenOk }]}>{b.verified}</Txt>
            </View>
          </FieldBox>
        </View>
      ) : null}

      <View style={styles.block}>
        <Label style={styles.label}>{b.registration}</Label>
        {/* Tanlanmagan — butun qator tugma; tanlangan — oddiy qator va ichida "Olib tashlash" (ichma-ich tugma bo'lmasin) */}
        <DocRow
          onPress={d.registration ? undefined : () => void chooseRegistration()}
          style={[styles.doc, { borderColor: d.registration ? colors.green : colors.ink }]}
        >
          <View style={[styles.docIcon, { backgroundColor: d.registration ? colors.greenTint : colors.track }]}>
            <Icon name="file" size={22} strokeWidth={2.2} />
          </View>
          <View style={styles.docText}>
            <Txt numberOfLines={1} style={[font(800), { fontSize: 15 }]}>
              {d.registration ? (d.registration.uploaded ? b.registrationDone(d.registration.name) : b.registrationSelected(d.registration.name)) : b.registrationPick}
            </Txt>
            <Txt style={{ fontSize: 12, color: colors.muted2 }}>{b.registrationHint}</Txt>
          </View>
          {d.registration ? (
            <Pressable onPress={() => void removeRegistration()} accessibilityRole="button" hitSlop={10}>
              <Txt style={[font(700), styles.remove]}>{b.remove}</Txt>
            </Pressable>
          ) : null}
        </DocRow>
      </View>

      <View style={styles.block}>
        <View style={styles.photosHead}>
          <Txt style={[font(700), { fontSize: 14 }]}>{b.photos}</Txt>
          <Txt style={[font(600), { fontSize: 12, color: colors.muted2 }]}>{b.photosHint}</Txt>
        </View>
        <View style={styles.photos}>
          {Array.from({ length: PHOTOS_MAX }, (_, i) => {
            const photo = d.photos[i];
            if (photo) {
              return (
                <View key={i} style={[styles.photo, photo.uri ? null : styles.photoServer]}>
                  {photo.uri ? <Image source={{ uri: photo.uri }} style={styles.photoImage} /> : <Icon name="tick" size={26} strokeWidth={3} color={colors.greenOk} />}
                  <Pressable onPress={() => void removePhoto(i)} accessibilityRole="button" accessibilityLabel={b.removePhoto} style={styles.photoRemove} hitSlop={8}>
                    <Icon name="x" size={14} strokeWidth={3} color={colors.white} />
                  </Pressable>
                </View>
              );
            }
            return i === d.photos.length ? (
              <Pressable key={i} onPress={() => void addPhoto()} accessibilityRole="button" accessibilityLabel={b.addPhoto} style={[styles.photo, styles.photoAdd]}>
                <Icon name="plus" size={26} strokeWidth={2.4} color={colors.muted} />
              </Pressable>
            ) : (
              <View key={i} style={styles.photoEmpty} />
            );
          })}
        </View>
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      <Pressable onPress={() => setDraft({ consent: !d.consent })} accessibilityRole="checkbox" accessibilityState={{ checked: d.consent }} style={styles.consent}>
        <View style={[styles.check, d.consent ? styles.checkOn : styles.checkOff]}>{d.consent ? <Icon name="tick" size={16} strokeWidth={3.4} color={colors.white} /> : null}</View>
        <Txt style={styles.consentText}>
          <Txt style={[font(700), styles.terms]} onPress={() => openSite(LEGAL.partnerTerms)} accessibilityRole="link">
            {b.consentTerms}
          </Txt>
          {b.consentTail}
        </Txt>
      </Pressable>
      <PrimaryButton tone="orange" onPress={() => void submit()} loading={busy}>
        {busy ? b.submitting : b.submit}
      </PrimaryButton>
    </Screen>
  );
}

function DocRow({ onPress, style, children }: { onPress?: () => void; style: StyleProp<ViewStyle>; children: ReactNode }) {
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={style}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 22 },
  title: { marginTop: 6 },
  first: { marginTop: 18 },
  block: { marginTop: 12 },
  label: { marginBottom: 6 },
  // Dizaynda border-box (54 jami)
  phone: { gap: 10, height: 54 },
  phoneText: { flex: 1, fontSize: 18, color: colors.ink5 },
  verified: { flexDirection: "row", alignItems: "center", gap: 6 },
  doc: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderWidth: 2, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  docIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docText: { flex: 1, minWidth: 0 },
  remove: { fontSize: 13, color: colors.muted, textDecorationLine: "underline" },
  photosHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  photos: { flexDirection: "row", gap: 10 },
  photo: { flex: 1, height: 74, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  photoImage: { width: "100%", height: "100%" },
  photoServer: { backgroundColor: colors.greenTint },
  photoAdd: { backgroundColor: colors.white, borderWidth: 2, borderStyle: "dashed", borderColor: colors.muted2 },
  photoEmpty: { flex: 1, height: 74 },
  photoRemove: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(17, 17, 17, 0.7)", alignItems: "center", justifyContent: "center" },
  consent: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, marginTop: 20, minHeight: 44 },
  check: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.blue },
  checkOff: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink },
  consentText: { flex: 1, fontSize: 14, lineHeight: 19.6, color: colors.ink5 },
  terms: { color: colors.blue, textDecorationLine: "underline" },
});
