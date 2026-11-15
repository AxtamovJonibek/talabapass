import { useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { copy } from "@/copy";
import { colors, font } from "@/theme";
import { Icon, QrGlyph } from "./icons";
import { Txt } from "./kit";

/*
 * Tanishtiruv rasmlari: Main, Biz1, Biz2 (design/app-flow) va Slide2–4 (dizayn fayli yo'q — saytdagi
 * `intro-art.tsx` bilan bir xil, Main uslubida). Hammasi bezak: ekran o'quvchidan yashirin.
 */

/** Tabiiy balandlik (360 doira + chiqib turgan stikerlar). Joy kam bo'lsa rasm proportsional kichrayadi. */
const ART_HEIGHT = 380;

export function ArtStage({ children, gap = 0 }: { children: ReactNode; gap?: number }) {
  const [scale, setScale] = useState(1);
  return (
    <View
      style={styles.stage}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => setScale(Math.min(1, e.nativeEvent.layout.height / ART_HEIGHT))}
    >
      <View style={[styles.center, { gap, transform: [{ scale }] }]}>
        <View style={styles.circle} />
        {children}
      </View>
    </View>
  );
}

function GreenSticker({ style, children }: { style: StyleProp<ViewStyle>; children: string }) {
  return (
    <View style={[styles.greenSticker, style]}>
      <View style={styles.greenStickerDot}>
        <Icon name="tick" size={16} strokeWidth={3.2} color={colors.white} />
      </View>
      <Txt style={[font(800), { fontSize: 16 }]}>{children}</Txt>
    </View>
  );
}

function DealRow({ tile, badge, place, title, rotate = "0deg" }: { tile: string; badge: string; place: string; title: string; rotate?: string }) {
  return (
    <View style={[styles.dealRow, { transform: [{ rotate }] }]}>
      <View style={[styles.dealTile, { backgroundColor: tile }]}>
        <View style={styles.dealBadge}>
          <Txt style={[font(900), { fontSize: 15 }]}>{badge}</Txt>
        </View>
      </View>
      <View style={styles.dealText}>
        <Txt style={[font(500), { fontSize: 12, color: colors.muted2 }]}>{place}</Txt>
        <Txt style={[font(800), { fontSize: 17 }]}>{title}</Txt>
      </View>
    </View>
  );
}

const a = copy.intro.art;
const b = copy.bizIntro.art;

/** 1 · Arzonroq (Main) */
export function MainArt() {
  return (
    <ArtStage gap={14}>
      <View style={[styles.card312, { transform: [{ rotate: "-4deg" }] }]}>
        <View style={styles.blueCard}>
          <Txt style={[font(500), styles.cardKicker, { opacity: 0.85 }]}>{a.bookstore}</Txt>
          <Txt style={[font(900, 62), styles.bigNumber]}>−25%</Txt>
          <Txt style={[font(700), { fontSize: 19, color: colors.white }]}>{a.books}</Txt>
        </View>
        <View style={styles.bogoSticker}>
          <Txt style={[font(900, 62), { fontSize: 52, lineHeight: 52 }]}>1+1</Txt>
        </View>
      </View>
      <View style={styles.chips}>
        {a.chips.map((chip, i) => (
          <View key={chip} style={[styles.chip, { backgroundColor: i === 0 ? colors.ink : colors.white }]}>
            <Txt style={[font(700), { fontSize: 14, color: i === 0 ? colors.white : colors.ink }]}>{chip}</Txt>
          </View>
        ))}
      </View>
      <DealRow tile={colors.blueTint} badge="−40%" place={a.printPlace} title={a.printTitle} />
    </ArtStage>
  );
}

/** 2 · Guvohnoma */
export function CardArt() {
  return (
    <ArtStage>
      <View style={[styles.card312, { transform: [{ rotate: "3deg" }] }]}>
        <View style={styles.whiteCard}>
          <Txt style={[font(700), { fontSize: 12, letterSpacing: 1.2, color: colors.muted2 }]}>{a.cardTitle}</Txt>
          <View style={styles.idRow}>
            <View style={styles.idPhoto}>
              <Icon name="user" size={34} strokeWidth={2} color={colors.blue} />
            </View>
            <View style={styles.idLines}>
              <Txt style={[font(800), { fontSize: 19 }]}>{a.cardName}</Txt>
              <Txt style={[font(500), { fontSize: 14, color: colors.muted2 }]}>{a.cardMeta}</Txt>
              <View style={[styles.idLine, { width: "80%", marginTop: 6 }]} />
              <View style={[styles.idLine, { width: "55%" }]} />
            </View>
          </View>
        </View>
        <GreenSticker style={{ bottom: -28, left: -16 }}>{a.approved}</GreenSticker>
      </View>
    </ArtStage>
  );
}

/** 3 · QR kupon */
export function QrArt() {
  return (
    <ArtStage>
      <View style={[styles.card300, { transform: [{ rotate: "-3deg" }] }]}>
        <View style={[styles.inkCard, { boxShadow: "0 20px 36px rgba(17, 17, 17, 0.25)" }]}>
          <View style={styles.qrWell}>
            <QrGlyph />
          </View>
          <View style={styles.inkFooter}>
            <Txt style={[font(800), { fontSize: 18, color: colors.white }]}>{a.couponPlace}</Txt>
            <Txt style={[font(500), { fontSize: 14, color: colors.white, opacity: 0.8 }]}>{a.couponCode}</Txt>
          </View>
        </View>
        <View style={styles.qrBadge}>
          <Txt style={[font(900, 62), { fontSize: 40, lineHeight: 40 }]}>−25%</Txt>
        </View>
      </View>
    </ArtStage>
  );
}

/** 4 · Yaqin joylar */
export function NearArt() {
  const tiles = [colors.tileKofe, colors.tileSport, colors.tileBogo];
  const tilt = ["-2deg", "1deg", "-1deg"];
  return (
    <ArtStage gap={12}>
      {a.near.map((n, i) => (
        <DealRow key={n.place} tile={tiles[i]!} badge={n.badge} place={n.place} title={n.title} rotate={tilt[i]} />
      ))}
      <View style={styles.pinBadge}>
        <Icon name="pin" size={34} strokeWidth={2.2} color={colors.white} />
      </View>
    </ArtStage>
  );
}

const BARS = ["30%", "44%", "38%", "62%", "52%"] as const;

/** B1 · Yangi mijozlar */
export function GrowthArt() {
  return (
    <ArtStage>
      <View style={[styles.card312, { transform: [{ rotate: "-3deg" }] }]}>
        <View style={[styles.inkCard, { boxShadow: "0 18px 32px rgba(17, 17, 17, 0.25)" }]}>
          <Txt style={[font(500), styles.cardKicker, { opacity: 0.8 }]}>{b.weekNew}</Txt>
          <View style={styles.growthRow}>
            <Txt style={[font(900, 62), { fontSize: 76, lineHeight: 76, color: colors.white }]}>{b.weekCount}</Txt>
            <View style={styles.growthBadge}>
              <Txt style={[font(800), { fontSize: 14 }]}>{b.weekGrowth}</Txt>
            </View>
          </View>
          <View style={styles.bars}>
            {BARS.map((h, i) => (
              <View key={i} style={[styles.bar, { height: h, backgroundColor: colors.ink5 }]} />
            ))}
            <View style={[styles.bar, { height: "78%", backgroundColor: colors.blue }]} />
            <View style={[styles.bar, { height: "100%", backgroundColor: colors.orange }]} />
          </View>
        </View>
        <View style={styles.slotSticker}>
          <View style={styles.slotBadge}>
            <Txt style={[font(900), { fontSize: 13, color: colors.blue }]}>{b.slotBadge}</Txt>
          </View>
          <Txt style={[font(800), { fontSize: 14, lineHeight: 17 }]}>
            {b.slotTime}
            {"\n"}
            <Txt style={[font(500), { color: colors.muted2 }]}>{b.slotNote}</Txt>
          </Txt>
        </View>
      </View>
    </ArtStage>
  );
}

/** B2 · Skaner va statistika */
export function ScannerArt() {
  const corner = (pos: ViewStyle, radius: ViewStyle) => <View style={[styles.corner, pos, radius]} />;
  return (
    <ArtStage>
      <View style={[styles.card300, { transform: [{ rotate: "3deg" }] }]}>
        <View style={[styles.inkCard, { borderRadius: 32, boxShadow: "0 20px 36px rgba(17, 17, 17, 0.25)" }]}>
          <View style={styles.qrWell}>
            <QrGlyph opacity={0.9} />
            {corner({ top: 14, left: 14, borderTopWidth: 4, borderLeftWidth: 4 }, { borderTopLeftRadius: 10 })}
            {corner({ top: 14, right: 14, borderTopWidth: 4, borderRightWidth: 4 }, { borderTopRightRadius: 10 })}
            {corner({ bottom: 14, left: 14, borderBottomWidth: 4, borderLeftWidth: 4 }, { borderBottomLeftRadius: 10 })}
            {corner({ bottom: 14, right: 14, borderBottomWidth: 4, borderRightWidth: 4 }, { borderBottomRightRadius: 10 })}
            <View style={styles.scanLine} />
          </View>
          <View style={styles.inkFooter}>
            <Txt style={[font(500), { fontSize: 14, color: colors.white, opacity: 0.8 }]}>{b.today}</Txt>
            <Txt style={[font(800), { fontSize: 18, color: colors.white }]}>{b.todayTotal}</Txt>
          </View>
        </View>
        <GreenSticker style={{ bottom: -28, left: -22 }}>{b.applied}</GreenSticker>
      </View>
    </ArtStage>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 200, alignItems: "center", justifyContent: "center" },
  center: { width: "100%", alignItems: "center", justifyContent: "center" },
  circle: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.line,
    top: "50%",
    left: "50%",
    transform: [{ translateX: -180 }, { translateY: -187 }],
  },
  card312: { width: 312, maxWidth: "100%" },
  card300: { width: 300, maxWidth: "100%" },
  blueCard: { backgroundColor: colors.blue, borderRadius: 30, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24, boxShadow: "0 18px 32px rgba(36, 50, 214, 0.25)" },
  cardKicker: { fontSize: 14, color: colors.white },
  bigNumber: { fontSize: 84, lineHeight: 84, marginTop: 6, marginBottom: 2, letterSpacing: -0.84, color: colors.white },
  bogoSticker: {
    position: "absolute",
    top: -26,
    right: -22,
    backgroundColor: colors.orange,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    transform: [{ rotate: "9deg" }],
    boxShadow: "0 10px 20px rgba(255, 90, 31, 0.3)",
  },
  chips: { flexDirection: "row", gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  dealRow: { width: 312, maxWidth: "100%", backgroundColor: colors.white, borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 14 },
  dealTile: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dealBadge: { backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  dealText: { flex: 1, gap: 2 },
  whiteCard: { backgroundColor: colors.white, borderRadius: 30, padding: 22, boxShadow: "0 18px 32px rgba(17, 17, 17, 0.2)" },
  idRow: { flexDirection: "row", gap: 14, marginTop: 14 },
  idPhoto: { width: 74, height: 96, borderRadius: 14, backgroundColor: colors.blueTint, alignItems: "center", justifyContent: "center" },
  idLines: { flex: 1, gap: 6, paddingTop: 4 },
  idLine: { height: 8, borderRadius: 99, backgroundColor: colors.track },
  greenSticker: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.green,
    borderRadius: 999,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 18,
    transform: [{ rotate: "-5deg" }],
    boxShadow: "0 10px 20px rgba(59, 209, 111, 0.3)",
  },
  greenStickerDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  inkCard: { backgroundColor: colors.ink, borderRadius: 30, padding: 22 },
  qrWell: { height: 210, borderRadius: 20, backgroundColor: colors.frame, alignItems: "center", justifyContent: "center" },
  inkFooter: { marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qrBadge: { position: "absolute", top: -24, right: -20, width: 96, height: 96, borderRadius: 48, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", transform: [{ rotate: "10deg" }] },
  pinBadge: { position: "absolute", top: 12, right: 0, width: 72, height: 72, borderRadius: 36, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center", transform: [{ rotate: "10deg" }] },
  growthRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 4 },
  growthBadge: { marginBottom: 10, backgroundColor: colors.green, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 2 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 84, marginTop: 14 },
  bar: { flex: 1, borderRadius: 6 },
  slotSticker: {
    position: "absolute",
    right: -16,
    bottom: -34,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 20,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 16,
    transform: [{ rotate: "5deg" }],
    boxShadow: "6px 6px 0 #111111",
  },
  slotBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.blueTint, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 34, height: 34, borderColor: colors.orange },
  scanLine: { position: "absolute", left: 20, right: 20, top: "50%", height: 3, borderRadius: 99, backgroundColor: colors.orange, boxShadow: "0 0 14px #FF5A1F" },
});
