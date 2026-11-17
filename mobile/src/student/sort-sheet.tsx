import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { SORTS, type FeedSort } from "@/lib/feed";
import { colors, font } from "@/theme";
import { Radio, Sheet, Toggle } from "@/ui/app";
import { Press, Txt } from "@/ui/kit";

type Choice = { sort: FeedSort; liveOnly: boolean };

/**
 * Saralash (design/app-flow/LentaFiltr.dc.html): tartib (radio), "Faqat hozir ochiqlar" kaliti, "Tozalash" va
 * "Ko'rsatish · N ta". Tanlov oyna ichida qoralama — "Ko'rsatish" bosilganda lentaga qo'llanadi; yopilsa bekor.
 */
export function SortSheet({
  visible,
  onClose,
  sort,
  liveOnly,
  countFor,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  sort: FeedSort;
  liveOnly: boolean;
  /** Shu tanlov bilan nechta chegirma ko'rinadi (qidiruv va kategoriya hisobga olinadi) */
  countFor: (liveOnly: boolean, sort: FeedSort) => number;
  onApply: (choice: Choice) => void;
}) {
  const f = copy.feed;
  const [draft, setDraft] = useState<Choice>({ sort, liveOnly });
  // Har ochilishda joriy tanlovdan boshlanadi
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft({ sort, liveOnly });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={f.sortLabel} titleSize={26}>
      <View style={styles.group} accessibilityRole="radiogroup">
        {SORTS.map((s, i) => {
          const on = draft.sort === s;
          return (
            <Pressable
              key={s}
              onPress={() => setDraft((d) => ({ ...d, sort: s }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.row, i < SORTS.length - 1 ? styles.line : null]}
            >
              <View style={styles.flex1}>
                <Txt style={[font(800), styles.name]}>{f.sort[s]}</Txt>
                <Txt style={[font(600), styles.sub]}>{f.sortHints[s]}</Txt>
              </View>
              <Radio on={on} />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => setDraft((d) => ({ ...d, liveOnly: !d.liveOnly }))}
        accessibilityRole="switch"
        accessibilityState={{ checked: draft.liveOnly }}
        style={styles.switchRow}
      >
        <View style={styles.flex1}>
          <Txt style={[font(800), styles.name]}>{f.liveOnly}</Txt>
          <Txt style={[font(600), styles.sub]}>{f.liveOnlyHint}</Txt>
        </View>
        <Toggle on={draft.liveOnly} size="md" />
      </Pressable>

      <View style={styles.buttons}>
        <Press onPress={() => setDraft({ sort: "near", liveOnly: false })} accessibilityRole="button" style={styles.reset}>
          <Txt style={[font(800), { fontSize: 16 }]}>{f.clearFilters}</Txt>
        </Press>
        <Press onPress={() => onApply(draft)} accessibilityRole="button" style={styles.show}>
          <Txt style={[font(800), styles.showText]}>{f.show(countFor(draft.liveOnly, draft.sort))}</Txt>
        </Press>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  group: { marginTop: 6, backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  line: { borderBottomWidth: 1.5, borderBottomColor: colors.lineSoft },
  name: { fontSize: 16 },
  sub: { marginTop: 2, fontSize: 13, color: colors.muted2 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white },
  buttons: { flexDirection: "row", gap: 10, marginTop: 16 },
  reset: { height: 56, paddingHorizontal: 20, borderRadius: 18, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, justifyContent: "center" },
  show: { flex: 1, height: 56, borderRadius: 18, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  showText: { fontSize: 17, color: colors.white },
});
