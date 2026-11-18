import { useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, View } from "react-native";
import type { LocalFile } from "@/api/endpoints";
import { copy } from "@/copy";
import { pickSquarePhoto } from "@/lib/pick";
import { colors, font } from "@/theme";
import { imageUrl } from "@/ui/app";
import { Txt } from "@/ui/kit";
import { Button } from "./ui";

/**
 * Profil rasmi / logotip — saytdagi `AvatarEditor`: 80px ko'rinish (talaba — doira, biznes — 16 radius), "Rasm tanlash" /
 * "Rasmni almashtirish", "Rasmni o'chirish", izoh. Saytda kesish oynasi, ilovada tizimning kvadrat kesishi (`pickSquarePhoto`,
 * 512×512 JPEG); galereya yoki kamera — tanlov oynasida. Yuklash/o'chirish chaqiruvchida.
 */
export function AvatarEditor({
  kind,
  url,
  fallback,
  onPick,
  onRemove,
}: {
  kind: "student" | "business";
  url: string | null;
  fallback: string;
  onPick: (file: LocalFile) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const p = copy.profileEdit;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const shown = preview === undefined ? (url ? imageUrl(url) : null) : preview;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(p.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const pick = (source: "library" | "camera") =>
    run(async () => {
      const file = await pickSquarePhoto(source, kind === "student" ? "avatar" : "logo");
      if (file === "denied") return setError(p.cameraDenied);
      if (!file) return;
      await onPick(file);
      setPreview(file.uri);
    });

  const choose = () =>
    Alert.alert(shown ? p.photoChange : (p.choose[kind] ?? ""), undefined, [
      { text: p.photoLibrary, onPress: () => void pick("library") },
      { text: p.photoCamera, onPress: () => void pick("camera") },
      { text: copy.deleteAccount.confirmNo, style: "cancel" },
    ]);

  return (
    <View style={styles.root}>
      <View testID="avatar-preview" style={[styles.preview, { borderRadius: kind === "student" ? 40 : 16 }]}>
        {shown ? (
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
        ) : (
          <Txt style={[font(900, 110), { fontSize: 26 }]}>{fallback}</Txt>
        )}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
      </View>
      <View style={styles.side}>
        <Button variant="outline-soft" size="sm" disabled={busy} onPress={choose}>
          {shown ? p.photoChange : (p.choose[kind] ?? "")}
        </Button>
        {shown ? (
          <Button
            variant="danger-ghost"
            size="sm"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await onRemove();
                setPreview(null);
              })
            }
            style={{ paddingHorizontal: 0 }}
          >
            {p.photoRemove}
          </Button>
        ) : null}
        <Txt style={styles.hint}>{p.chooseHint[kind]}</Txt>
        {error ? (
          <Txt accessibilityRole="alert" style={[font(700), { fontSize: 12, color: colors.danger }]}>
            {error}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: 16 },
  preview: { width: 80, height: 80, overflow: "hidden", backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20,20,20,0.4)", alignItems: "center", justifyContent: "center" },
  side: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 6 },
  hint: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
