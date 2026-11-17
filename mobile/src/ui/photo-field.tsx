import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import type { LocalFile } from "@/api/endpoints";
import { copy } from "@/copy";
import { pickSquarePhoto } from "@/lib/pick";
import { colors, font } from "@/theme";
import { Card, imageUrl, MenuRow, Sheet } from "./app";
import { Note, Press, Txt } from "./kit";

/**
 * Profil rasmi / logotip (dizaynda chizilmagan — profil avatari uslubida): kvadrat ko'rinish, "Rasmni almashtirish" →
 * oyna (galereya, kamera, o'chirish). Tanlangan rasm tizim oynasida kvadrat kesiladi va 512×512 JPEG bo'ladi
 * (`pickSquarePhoto`); yuklash va o'chirish — chaqiruvchida (`onPick`, `onRemove`), xatosi shu yerda ko'rinadi.
 */
export function PhotoField({
  url,
  fallback,
  label,
  hint,
  tone = "blue",
  onPick,
  onRemove,
}: {
  url: string | null;
  /** Rasm yo'q bo'lsa — bosh harflar */
  fallback: string;
  label: string;
  hint: string;
  tone?: "blue" | "orange";
  onPick: (file: LocalFile) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const p = copy.profileEdit;
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? (url ? imageUrl(url) : null);

  const run = async (action: () => Promise<void>) => {
    setSheet(false);
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      console.warn("[photo] xato:", e);
      setError(p.photoFailed);
    } finally {
      setBusy(false);
    }
  };

  const pick = (source: "library" | "camera") =>
    run(async () => {
      const file = await pickSquarePhoto(source, "avatar");
      if (file === "denied") {
        setError(p.cameraDenied);
        return;
      }
      if (!file) return;
      await onPick(file);
      setPreview(file.uri);
    });

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: tone === "blue" ? colors.blue : colors.orange }]}>
          {shown ? (
            <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          ) : (
            <Txt style={[font(900, 112), styles.initials, { color: tone === "blue" ? colors.white : colors.ink }]}>{fallback}</Txt>
          )}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : null}
        </View>
        <View style={styles.flex1}>
          <Txt style={[font(800), { fontSize: 16 }]}>{label}</Txt>
          <Press onPress={() => setSheet(true)} disabled={busy} accessibilityRole="button" style={styles.change}>
            <Txt style={[font(800), styles.changeText]}>{shown ? p.photoChange : p.photoAdd}</Txt>
          </Press>
        </View>
      </View>
      <Note error={Boolean(error)}>{error ?? hint}</Note>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={label}>
        <Card style={styles.menu}>
          <MenuRow icon="image" label={p.photoLibrary} onPress={() => void pick("library")} />
          <MenuRow icon="camera" label={p.photoCamera} onPress={() => void pick("camera")} last={!shown} />
          {shown ? (
            <MenuRow
              icon="trash"
              label={p.photoRemove}
              danger
              last
              onPress={() =>
                void run(async () => {
                  await onRemove();
                  setPreview(null);
                })
              }
            />
          ) : null}
        </Card>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 88, height: 88, borderRadius: 28, overflow: "hidden", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-4deg" }] },
  initials: { fontSize: 32 },
  busy: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(17,17,17,0.45)", alignItems: "center", justifyContent: "center" },
  change: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center", marginTop: 2 },
  changeText: { fontSize: 15, color: colors.blue },
  menu: { marginTop: 6 },
});
