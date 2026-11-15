import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { studentApi, type University } from "@/api/endpoints";
import { copy } from "@/copy";
import { searchUniversities } from "@/lib/universities";
import { colors, font } from "@/theme";
import { Icon } from "./icons";
import { ErrorBox, Field, Label, PrimaryButton, Txt } from "./kit";

export type UniversityChoice = { id: string; name: string } | { id: "other"; name: string };

/**
 * OTM tanlash oynasi (dizaynda chizilmagan: RoyxatTalaba maydoni va saytdagi `UniversityPicker look="app"` asosida).
 * Qidiruv — nom, qisqartma yoki viloyat. "Ro'yxatda yo'q" — nomni qo'lda yozish (admin keyin qo'shadi).
 */
export function UniversityPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (choice: UniversityChoice) => void }) {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<University[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [other, setOther] = useState<string | null>(null);
  const s = copy.student;

  useEffect(() => {
    if (!visible || list) return;
    studentApi
      .universities()
      .then((r) => setList(r.universities))
      .catch((e) => setError(errorText(e)));
  }, [visible, list]);

  const found = useMemo(() => (list ? searchUniversities(list, query) : []), [list, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <Txt style={[font(900, 112), { fontSize: 26 }]}>{s.university}</Txt>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.back} style={styles.close} hitSlop={6}>
            <Icon name="x" size={24} strokeWidth={2.4} />
          </Pressable>
        </View>

        {other === null ? (
          <>
            <Field
              value={query}
              onChangeText={setQuery}
              placeholder={s.universitySearch}
              icon={{ name: "search", color: colors.muted2 }}
              text={17}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            <ErrorBox>{error}</ErrorBox>
            {!list && !error ? <ActivityIndicator color={colors.blue} style={styles.loading} /> : null}
            <FlatList
              data={found}
              keyExtractor={(u) => u.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable onPress={() => onPick({ id: item.id, name: item.name })} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
                  <Txt style={[font(800), { fontSize: 16 }]}>{item.shortName}</Txt>
                  <Txt style={{ fontSize: 14, lineHeight: 19, color: colors.muted2 }}>{item.name}</Txt>
                </Pressable>
              )}
              ListEmptyComponent={list ? <Txt style={styles.empty}>{s.universityEmpty}</Txt> : undefined}
              ListFooterComponent={
                list ? (
                  <Pressable onPress={() => setOther(query)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} accessibilityRole="button">
                    <Txt style={[font(800), { fontSize: 16, color: colors.blue }]}>{s.universityOther}</Txt>
                  </Pressable>
                ) : undefined
              }
            />
          </>
        ) : (
          <View>
            <Label>{s.universityOtherLabel}</Label>
            <Field value={other} onChangeText={setOther} placeholder={s.universityOtherPlaceholder} text={17} autoFocus />
            <PrimaryButton
              disabled={other.trim().length < 3}
              onPress={() => onPick({ id: "other", name: other.trim() })}
              style={styles.done}
              icon="tick"
            >
              {s.universityDone}
            </PrimaryButton>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24, paddingTop: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  loading: { marginTop: 24 },
  list: { marginTop: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: colors.line, gap: 2 },
  rowPressed: { opacity: 0.6 },
  empty: { paddingVertical: 16, color: colors.muted2 },
  done: { marginTop: 20 },
});
