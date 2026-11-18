import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { Txt } from "@/ui/kit";
import { mono } from "./ui";

/*
 * Chek (saytdagi `ui/receipt.tsx` + `receipt/receipt-view.tsx` `HistoryReceipt`): oq blok, mono qatorlar, pastda arra chet
 * (`receipt-edge`: 12×10 tishlar, oq).
 */

/** Pastki arra chet: kenglik bo'ylab takrorlanadigan uchburchaklar (12px qadam, 10px balandlik) */
export function ReceiptEdge({ width }: { width: number }) {
  const n = Math.ceil(width / 12);
  let d = "";
  for (let i = 0; i < n; i++) d += `M${i * 12} 0 L${i * 12 + 6} 6 L${i * 12 + 12} 0 Z `;
  return (
    <Svg width={width} height={10} viewBox={`0 0 ${width} 10`}>
      <Path d={`M0 0 H${width} V4 H0 Z`} fill={colors.white} />
      <Path d={d} fill={colors.white} transform="translate(0 4)" />
    </Svg>
  );
}

export function ReceiptRow({ label, value, kind = "default" }: { label: string; value: string; kind?: "default" | "discount" | "total" | "grand" | "plain" }) {
  const color = kind === "discount" ? colors.rust : colors.ink;
  // total — 16 (T7), grand — 18 (B4 "JAMI"); plain — yorliq ham qora
  const big = kind === "total" || kind === "grand";
  const size = kind === "grand" ? 18 : kind === "total" ? 16 : 13;
  return (
    <View style={[s.row, big ? { marginTop: kind === "grand" ? 4 : 2 } : null]}>
      <Txt style={[mono(big ? 600 : 400), { fontSize: size, color: kind === "default" ? colors.muted : color }]}>{label}</Txt>
      <Txt style={[mono(big ? 600 : 400), { fontSize: size, color, flexShrink: 1, textAlign: "right" }]}>{value}</Txt>
    </View>
  );
}

export const ReceiptDivider = ({ wide = false }: { wide?: boolean }) => <View style={[s.divider, wide ? { marginVertical: 6 } : null]} />;

/** B4 — kassada chiqarilgan chek (`PrintReceipt`, "print" ko'rinishi): biznes nomi, manzil · STIR, qatorlar */
export function PrintReceipt({ business, address, children, width }: { business: string; address: string; children: ReactNode; width: number }) {
  return (
    <View>
      <View style={s.print}>
        <View style={{ gap: 7 }}>
          <Txt style={[mono(600), { fontSize: 13, textAlign: "center" }]}>{business.toUpperCase()}</Txt>
          <Txt style={[mono(), { fontSize: 12, textAlign: "center", color: colors.muted }]}>{address}</Txt>
          <ReceiptDivider wide />
        </View>
        <View style={{ gap: 7 }}>{children}</View>
      </View>
      <ReceiptEdge width={width} />
    </View>
  );
}

/** T7 chek kartasi: "✓ Sotuv tasdiqlandi" va "CHEK № …", keyin qatorlar */
export function Receipt({ status, number, children, width }: { status: string; number: string; children: ReactNode; width: number }) {
  return (
    <View>
      <View style={s.paper}>
        <View style={s.head}>
          <View style={s.status}>
            <Icon name="check" size={14} color={colors.greenSite} />
            <Txt style={[font(700), { fontSize: 12, color: colors.greenSite }]}>{status}</Txt>
          </View>
          <Txt style={[mono(), { fontSize: 12, color: colors.muted }]}>{number}</Txt>
        </View>
        <View style={s.rows}>{children}</View>
      </View>
      <ReceiptEdge width={width} />
    </View>
  );
}

const s = StyleSheet.create({
  paper: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  rows: { marginTop: 12, gap: 6 },
  print: { backgroundColor: colors.white, borderTopLeftRadius: 4, borderTopRightRadius: 4, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  divider: { marginVertical: 4, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.dash },
});
