import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Linking, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, ApiError, errorText } from "@/api/client";
import { appApi } from "@/api/endpoints";
import { copy } from "@/copy";
import { dealNote, formatKm, formatMinute, formatSom, formatUntil, statusPill, toTashkent, webStatus } from "@/lib/format";
import { isLowStock } from "@/lib/feed";
import { useLocation } from "@/lib/location";
import { rememberCoupon } from "@/lib/offline";
import { useLoad } from "@/lib/use-load";
import { Button, DealTag, mono, PctBadge, StatusPill, weekdaysLabel } from "@/site/ui";
import { DirectionsSheet } from "@/student/directions-sheet";
import { colors, em, font } from "@/theme";
import { Failed, imageUrl, Loading } from "@/ui/app";
import { Icon, isIconName } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";

const HERO = 286;

/** 44px oq doira tugma (saytdagi `ROUND`: orqaga, ulashish, saqlash) */
function Round({ icon, label, onPress, filled = false }: { icon: "chevronLeft" | "share" | "bookmark" | "check"; label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} scale={0.9} style={styles.round}>
      <Icon name={icon} size={19} fill={filled ? colors.ink : "none"} />
    </Press>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fact}>
      <Txt style={{ fontSize: 12, color: colors.muted }}>{label}</Txt>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

/**
 * T5 — chegirma tafsiloti, saytning telefon ko'rinishi (`student/deal/deal-detail.tsx` `DealPhone`): 286px rasm (varaqlanadi,
 * ←, ulashish, saqlash, foiz, holat pilyulkasi), biznes qatori, sarlavha, narx bloki, 4 ta fakt, manzil va "Borish",
 * aloqa tugmalari, shartlar; pastda "Chegirmani olish" (yoki "Kuponni ko'rsatish") va izoh.
 */
export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { origin } = useLocation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detail = useLoad(useCallback(() => appApi.deal(id, origin), [id, origin]), true, `deal.${id}`);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [directions, setDirections] = useState(false);
  const [shared, setShared] = useState(false);
  const [photo, setPhoto] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const d = copy.deal;
  const data = detail.data;
  const { setData, refresh } = detail;

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void refresh();
    }, [refresh]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace("/deals"));

  const toggleSave = async () => {
    if (!data) return;
    const next = !data.saved;
    setData((v) => (v ? { ...v, saved: next } : v));
    try {
      await appApi.setSaved(data.deal.id, next);
    } catch {
      setData((v) => (v ? { ...v, saved: !next } : v));
    }
  };

  const share = async () => {
    if (!data) return;
    await Share.share({ message: `${data.deal.title} — ${API_URL}/uz/chegirmalar/${data.deal.id}` }).catch(() => undefined);
    setShared(true);
  };

  const claim = async () => {
    if (!data || claiming) return;
    if (data.coupon) {
      void rememberCoupon(data.coupon);
      router.push(`/coupon/${data.coupon.id}`);
      return;
    }
    setClaiming(true);
    setClaimError(null);
    try {
      const { coupon } = await appApi.claim(data.deal.id);
      await rememberCoupon(coupon);
      setData((v) => (v ? { ...v, coupon } : v));
      router.push(`/coupon/${coupon.id}`);
    } catch (e) {
      setClaimError(e instanceof ApiError && copy.coupon.claimErrors[e.code] ? copy.coupon.claimErrors[e.code]! : errorText(e));
      void detail.refresh();
    } finally {
      setClaiming(false);
    }
  };

  if (!data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 110 }]}>
        {detail.error ? <Failed error={detail.code === "not_found" ? d.notFound : detail.error} onRetry={() => void detail.reload()} /> : <Loading />}
        <View style={[styles.topLeft, { top: insets.top + 54 }]}>
          <Round icon="chevronLeft" label={copy.back} onPress={back} />
        </View>
      </View>
    );
  }

  const { deal, business } = data;
  const today = toTashkent(now).date.getTime();
  const opensToday = deal.opensAt !== null && toTashkent(new Date(deal.opensAt)).date.getTime() === today;
  const pill = statusPill(deal, now);
  const low = isLowStock(deal, now);
  const icon = isIconName(deal.icon) ? deal.icon : "bowl";
  const letter = business.name.trim().charAt(0).toUpperCase();
  const pct = deal.total > 0 ? Math.round((deal.left / deal.total) * 100) : 0;
  const days = weekdaysLabel(data.weekdays, (n) => copy.weekdaysShort[n - 1]!, d.everyDay);
  const hours = `${formatMinute(data.fromMinute)}–${formatMinute(data.toMinute % 1440)}`;
  const saves = deal.price?.old ? d.saves(formatSom(deal.price.old - deal.price.now)) : null;
  const available = deal.live && deal.left > 0;
  const closedText = deal.live && deal.closesAt ? pill.text : deal.opensAt ? d.opensAt(webStatus(deal, now)) : d.ended;
  const contacts = [
    business.telegram ? { key: "telegram", label: d.telegram, url: `https://t.me/${business.telegram.replace(/^@/, "")}` } : null,
    business.instagram ? { key: "instagram", label: d.instagram, url: `https://instagram.com/${business.instagram.replace(/^@/, "")}` } : null,
  ].filter((c): c is { key: string; label: string; url: string } => c !== null);

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={[styles.hero, { height: HERO + insets.top, backgroundColor: deal.tile }]}>
          {deal.images.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhoto(Math.round(e.nativeEvent.contentOffset.x / width))}
              style={StyleSheet.absoluteFill}
            >
              {deal.images.map((src, i) => (
                <Image key={src} source={{ uri: imageUrl(src) }} style={{ width, height: HERO + insets.top }} resizeMode="cover" accessibilityLabel={d.photo(i + 1, deal.images.length)} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ marginTop: 30 + insets.top }}>
              <Icon name={icon} size={190} color={deal.ink} />
            </View>
          )}
          {deal.images.length > 1 ? (
            <View style={[styles.photoCount, { top: insets.top + 236 }]}>
              <Txt style={[mono(), { fontSize: 11, color: deal.ink }]}>{d.photo(photo + 1, deal.images.length)}</Txt>
            </View>
          ) : null}
          <View style={[styles.topLeft, { top: insets.top + 54 }]}>
            <Round icon="chevronLeft" label={copy.back} onPress={back} />
          </View>
          <View style={[styles.topRight, { top: insets.top + 54 }]}>
            <Round icon={shared ? "check" : "share"} label={d.share} onPress={() => void share()} />
            <Round icon="bookmark" label={data.saved ? d.unsave : d.save} onPress={() => void toggleSave()} filled={data.saved} />
          </View>
          <View style={[styles.marks, { top: insets.top + 12 }]}>
            <StatusPill tone={pill.tone} onImage>
              {pill.text}
            </StatusPill>
            {low ? <DealTag hot>{d.hot(deal.left, deal.total)}</DealTag> : null}
          </View>
          <PctBadge style={styles.pct}>{deal.badge}</PctBadge>
        </View>

        <View style={styles.body}>
          <View style={styles.bizRow}>
            <View style={styles.logo}>
              {business.logoUrl ? (
                <Image source={{ uri: imageUrl(business.logoUrl) }} style={StyleSheet.absoluteFill} />
              ) : (
                <Txt style={[font(900, 125), { fontSize: 18, color: colors.paper }]}>{letter}</Txt>
              )}
            </View>
            <View style={styles.flex1}>
              <View style={styles.nameRow}>
                <Txt style={[font(700), { fontSize: 15 }]}>{business.name}</Txt>
                <Icon name="verified" size={16} color={colors.blue} fill={colors.blue} />
              </View>
              <Txt style={{ fontSize: 13, color: colors.muted }}>{[business.typeLabel, business.district, deal.distanceKm !== null ? formatKm(deal.distanceKm) : null].filter(Boolean).join(" · ")}</Txt>
            </View>
          </View>

          <Txt accessibilityRole="header" style={[font(800, 108), styles.title]}>
            {deal.title}
          </Txt>

          <View style={styles.priceBox}>
            {deal.price ? (
              <View style={{ gap: 2 }}>
                {deal.price.old ? (
                  <Txt style={[mono(), { fontSize: 13, color: colors.muted2, textDecorationLine: "line-through" }]}>
                    {formatSom(deal.price.old)} {copy.currency}
                  </Txt>
                ) : null}
                <Txt style={[font(900), { fontSize: 32, lineHeight: 32, letterSpacing: em(32, -0.02) }]}>
                  {formatSom(deal.price.now)} <Txt style={[font(700), { fontSize: 15 }]}>{copy.currency}</Txt>
                </Txt>
              </View>
            ) : (
              <Txt style={[font(900), { fontSize: 20, lineHeight: 22, letterSpacing: em(20, -0.02) }]}>{dealNote(deal)}</Txt>
            )}
            {saves ? (
              <View style={styles.saves}>
                <Txt style={[font(700), { fontSize: 13, color: colors.greenSite }]}>{saves}</Txt>
              </View>
            ) : null}
          </View>

          <View style={styles.facts}>
            <Fact label={d.when}>
              <Txt style={[font(700), { fontSize: 14 }]}>
                {days}
                {"\n"}
                <Txt style={[mono(), { fontSize: 14 }]}>{hours}</Txt>
              </Txt>
            </Fact>
            <Fact label={deal.live || opensToday ? d.leftToday : d.leftNext}>
              <Txt style={[font(700), { fontSize: 14 }]}>{d.leftValue(deal.left, deal.total)}</Txt>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
            </Fact>
            <Fact label={d.limit}>
              <Txt style={[font(700), { fontSize: 14 }]}>{d.limits[data.perStudentLimit] ?? ""}</Txt>
            </Fact>
            <Fact label={d.until}>
              <Txt style={[font(700), { fontSize: 14 }]}>{formatUntil(data.endsOn)}</Txt>
            </Fact>
          </View>

          <View style={styles.place}>
            <View style={styles.flex1}>
              <Txt style={[font(600), { fontSize: 14 }]}>{business.address}</Txt>
              {business.landmark ? <Txt style={{ fontSize: 12, color: colors.muted }}>{d.landmark(business.landmark)}</Txt> : null}
              {business.workingHours ? <Txt style={{ fontSize: 12, color: colors.muted }}>{d.openHours(business.workingHours)}</Txt> : null}
            </View>
            <Press onPress={() => setDirections(true)} accessibilityRole="button" scale={0.96} style={styles.go}>
              <Icon name="navigate" size={16} />
              <Txt style={[font(700), { fontSize: 13 }]}>{deal.distanceKm !== null ? d.directionsWith(formatKm(deal.distanceKm)) : d.directions}</Txt>
            </Press>
          </View>

          {business.phone || contacts.length ? (
            <View style={styles.contacts}>
              {business.phone ? (
                <Press onPress={() => void Linking.openURL(`tel:${business.phone!.replace(/[^\d+]/g, "")}`)} accessibilityRole="link" scale={0.96} style={[styles.contact, styles.call]}>
                  <Txt style={[font(700), { fontSize: 14, color: colors.white }]}>{d.call}</Txt>
                  <Txt style={[mono(), { fontSize: 13, color: colors.white }]}>{business.phone}</Txt>
                </Press>
              ) : null}
              {contacts.map((c) => (
                <Press key={c.key} onPress={() => void Linking.openURL(c.url)} accessibilityRole="link" scale={0.96} style={[styles.contact, styles.quiet]}>
                  <Txt style={[font(700), { fontSize: 14 }]}>{c.label}</Txt>
                </Press>
              ))}
            </View>
          ) : null}
          {data.terms ? <Txt style={styles.terms}>{data.terms}</Txt> : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 30) }]}>
        {data.coupon ? (
          <Button size="cta" variant="blue" strong block icon="qr" onPress={() => void claim()}>
            {d.showCoupon}
          </Button>
        ) : (
          <Button size="cta" variant={available ? "blue" : "idle"} strong block icon="qr" disabled={!available} busy={claiming} onPress={() => void claim()}>
            {claiming ? d.claiming : d.claim}
          </Button>
        )}
        {claimError ? <Txt style={[font(600), styles.error]}>{claimError}</Txt> : null}
        {available || data.coupon ? (
          <Txt style={styles.hint}>{d.claimHint}</Txt>
        ) : deal.live && deal.left <= 0 ? (
          <Txt style={[font(600), styles.error]}>{d.soldOut}</Txt>
        ) : (
          <View style={styles.closed} testID="claim-closed">
            <Icon name="clock" size={15} />
            <Txt style={[font(700), { fontSize: 13 }]}>{closedText}</Txt>
          </View>
        )}
      </View>

      <DirectionsSheet
        visible={directions}
        onClose={() => setDirections(false)}
        target={{ address: business.address, district: business.district, landmark: business.landmark, point: business.point, distanceKm: deal.distanceKm }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex1: { flex: 1, minWidth: 0 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoCount: { position: "absolute", left: 16, borderRadius: 6, backgroundColor: colors.white, paddingHorizontal: 8, paddingVertical: 4 },
  topLeft: { position: "absolute", left: 16 },
  topRight: { position: "absolute", right: 16, flexDirection: "row", gap: 8 },
  marks: { position: "absolute", left: 12, gap: 6, zIndex: 2 },
  pct: { position: "absolute", right: 12, bottom: 26 },
  body: { marginTop: -18, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.paper, paddingHorizontal: 20, paddingTop: 20 },
  bizRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  title: { marginTop: 16, fontSize: 28, lineHeight: 29, letterSpacing: em(28, -0.03) },
  priceBox: { marginTop: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 14 },
  saves: { borderRadius: 8, backgroundColor: colors.greenBg, paddingHorizontal: 10, paddingVertical: 7 },
  facts: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: { width: "48.5%", flexGrow: 1, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  bar: { marginTop: 8, height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: "#E7E5DE" },
  barFill: { height: 5, backgroundColor: colors.orange },
  place: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  go: { height: 40, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, backgroundColor: colors.paper, paddingHorizontal: 12 },
  contacts: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  contact: { height: 44, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 14 },
  call: { backgroundColor: colors.ink },
  quiet: { borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  terms: { marginHorizontal: 2, marginTop: 14, marginBottom: 24, fontSize: 13, lineHeight: 19.5, color: colors.muted },
  footer: { gap: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, backgroundColor: colors.paper, paddingHorizontal: 16, paddingTop: 12 },
  hint: { textAlign: "center", fontSize: 12, color: colors.muted },
  error: { textAlign: "center", fontSize: 12, color: colors.danger },
  closed: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});
