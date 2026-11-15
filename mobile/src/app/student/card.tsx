import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useCanGoBack } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { studentApi, type LocalFile } from "@/api/endpoints";
import { copy } from "@/copy";
import { pickDocument } from "@/lib/pick";
import { resetTo, useApp } from "@/state";
import { colors, font } from "@/theme";
import { Icon, type IconName } from "@/ui/icons";
import { BackArrow, ErrorBox, Eyebrow, Grow, Lead, Note, RoleChip, Screen, StepBars, TickRow, Title, TopBar, TopBarSpacer, Txt } from "@/ui/kit";

/**
 * Guvohnoma (2/3): ramkadagi kamera (expo-camera), "Fayl" (PDF/JPG) va chiroq. Rasm/fayl darhol yuklanadi
 * (`POST /student/card`, serverda EXIF/GPS tozalanadi), keyin tekshiruv holati.
 * Dizayndan chetlanish: ramkadagi yozuv statik ("Ramkaga to'g'rilab…") — avtomatik aniqlash yo'q.
 */
export default function StudentCard() {
  const { reloadMe } = useApp();
  const canGoBack = useCanGoBack();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = copy.student;
  const granted = permission?.granted === true;

  const upload = async (file: LocalFile) => {
    setBusy(true);
    setError(null);
    try {
      await studentApi.uploadCard(file);
      await reloadMe().catch(() => undefined);
      resetTo("/student/review");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const shoot = async () => {
    if (busy) return;
    if (!granted) {
      const res = await requestPermission();
      if (!res.granted && !res.canAskAgain) void Linking.openSettings();
      return;
    }
    if (!ready || !camera.current) return;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      setTorch(false);
      await upload({ uri: photo.uri, name: "guvohnoma.jpg", type: "image/jpeg" });
    } catch (e) {
      setError(errorText(e));
    }
  };

  const chooseFile = async () => {
    if (busy) return;
    try {
      const file = await pickDocument();
      if (file) await upload(file);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Screen>
      <TopBar>
        {canGoBack ? <BackArrow label={copy.back} onPress={() => router.back()} /> : <TopBarSpacer />}
        <StepBars total={3} current={2} label={s.steps(2)} />
        <RoleChip tone="student">{copy.role.student}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <Eyebrow>{s.eyebrow2}</Eyebrow>
        <Title text={s.title2} size={38} loose style={styles.title} />
        <Lead text={s.lead2} size={15} style={styles.lead} />
      </View>

      <View style={styles.frame}>
        {granted ? <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} /> : null}
        <View style={styles.cardOutline}>{granted ? null : <Icon name="idCard" size={64} strokeWidth={1.6} color="rgba(255,255,255,0.35)" />}</View>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        {granted || permission === null ? (
          <View style={styles.hint}>
            <Txt style={[font(800), { fontSize: 12 }]}>{s.frameHint}</Txt>
          </View>
        ) : (
          <Pressable onPress={() => void shoot()} style={styles.hint} accessibilityRole="button">
            <Txt style={[font(800), { fontSize: 12 }]}>{s.cameraAllow}</Txt>
          </Pressable>
        )}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.white} />
            <Txt style={[font(700), { color: colors.white, marginTop: 8 }]}>{s.uploading}</Txt>
          </View>
        ) : null}
      </View>
      {permission && !granted && !permission.canAskAgain ? <Note>{s.cameraDenied}</Note> : null}

      <View style={styles.tips}>
        <TickRow tone="peach" size={22}>
          {s.tipLight}
        </TickRow>
        <TickRow tone="peach" size={22}>
          {s.tipValid}
        </TickRow>
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      <View style={styles.controls}>
        <RoundAction icon="file" label={s.file} onPress={() => void chooseFile()} />
        <Pressable
          onPress={() => void shoot()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={s.shoot}
          style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <RoundAction icon="bolt" label={s.torch} active={torch} disabled={!granted} onPress={() => setTorch((t) => !t)} />
      </View>
      <Note style={styles.formats}>{s.formats}</Note>
    </Screen>
  );
}

function RoundAction({ icon, label, onPress, active = false, disabled = false }: { icon: IconName; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ selected: active, disabled }} style={[styles.round, disabled && { opacity: 0.45 }]}>
      <View style={[styles.roundCircle, active && { backgroundColor: colors.orange }]}>
        <Icon name={icon} size={24} strokeWidth={2.2} />
      </View>
      <Txt style={[font(700), { fontSize: 13 }]}>{label}</Txt>
    </Pressable>
  );
}

const CORNER = 30;

const styles = StyleSheet.create({
  hero: { marginTop: 28 },
  title: { marginTop: 8 },
  lead: { marginTop: 12 },
  frame: { marginTop: 20, height: 230, borderRadius: 28, backgroundColor: colors.frame, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardOutline: { width: 250, height: 158, borderRadius: 16, borderWidth: 3, borderStyle: "dashed", borderColor: "rgba(255, 255, 255, 0.55)", alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.green },
  tl: { top: 14, left: 14, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 14, right: 14, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 14, right: 14, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  hint: { position: "absolute", bottom: 16, alignSelf: "center", backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 5 },
  busy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(17, 17, 17, 0.6)", alignItems: "center", justifyContent: "center" },
  tips: { gap: 10, marginTop: 18 },
  controls: { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  round: { minWidth: 64, minHeight: 44, alignItems: "center", gap: 6 },
  roundCircle: { width: 52 + 4, height: 52 + 4, borderRadius: 28, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  shutter: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.blue, borderWidth: 6, borderColor: colors.blueTint, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white },
  formats: { marginTop: 16, textAlign: "center" },
});
