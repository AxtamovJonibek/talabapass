import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { studentApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { SubScreen } from "@/site/screen";
import { mono } from "@/site/ui";
import { colors } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Txt } from "@/ui/kit";

/** "2027-06-30" → "30.06.2027" */
const dateText = (iso: string) => iso.slice(0, 10).split("-").reverse().join(".");

/** Talaba guvohnomasi (saytdagi `/profil/guvohnoma` `CardRows`): holat, ID, raqam, muddat — faqat ko'rish */
export default function StudentCard() {
  const c = copy.idCard;
  const data = useLoad(useCallback(() => studentApi.profile(), []), true, "student.profile");
  const p = data.data?.profile;
  const rows: [string, string][] = p
    ? [
        [c.status, c.statusValue],
        [c.id, p.publicId],
        [c.number, p.cardNumber ?? "—"],
        [c.expires, p.cardExpiresAt ? dateText(p.cardExpiresAt) : "—"],
      ]
    : [];
  return (
    <SubScreen title={c.title}>
      {!p ? (
        data.error ? <Failed error={data.error} onRetry={() => void data.reload()} /> : <Loading />
      ) : (
        <>
          <View style={styles.list}>
            {rows.map(([k, v], i) => (
              <View key={k} style={[styles.row, i < rows.length - 1 ? styles.sep : null]}>
                <Txt style={{ fontSize: 14, color: colors.muted }}>{k}</Txt>
                <Txt style={[mono(600), { fontSize: 14 }]}>{v}</Txt>
              </View>
            ))}
          </View>
          <Txt style={styles.note}>{c.note}</Txt>
        </>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 16, backgroundColor: colors.white },
  row: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16 },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  note: { marginTop: 12, fontSize: 13, lineHeight: 19, color: colors.muted },
});
