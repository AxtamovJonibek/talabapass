import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { ApiError, errorText } from "@/api/client";
import { appApi, type DealDetail } from "@/api/endpoints";
import { copy } from "@/copy";
import { formatKm, formatMinute, formatUntil, formatWeekdays, opensWhen, statusPill, toTashkent, upperFirst } from "@/lib/format";
import { useLocation } from "@/lib/location";
import { rememberCoupon } from "@/lib/offline";
import { useLoad } from "@/lib/use-load";
import { DirectionsSheet } from "@/student/directions-sheet";
import { colors, em, font } from "@/theme";
import { DealPhoto, Failed, imageUrl, Loading, PctSticker, PriceTag, RoundButton } from "@/ui/app";
import { BRAND_LOGOS } from "@/ui/brands";
import { Icon } from "@/ui/icons";
import { ErrorBox, Press, Txt } from "@/ui/kit";

/** Dizayndagi o'lchamlar (390×844): rasm 330, matn bloki rasmdan 62 pastda, pastki panel ~102 */
const HERO = 330;
const BELOW_HERO = 62;
const MIN_HERO = 220;
/** Rasmdan pastdagi qism (do'kon, sarlavha, holat, 4 qator) va pastki panel uchun kerakli balandlik */
const REST = 514;

/**
 * Chegirma (design/app-flow/Chegirma.dc.html, yopiq holat — ChegirmaYopiq.dc.html). Bitta ekranga sig'adi (kichik
 * ekranda rasm pasayadi): rasm (varaqlanadi, nuqtalar), rasm chetiga osilgan katta narx yorlig'i va qiyshiq foiz stikeri;
 * do'kon qatori (logo, tasdiq belgisi, Qo'ng'iroq / Telegram / Instagram — borlari); sarlavha; holat; chekdagidek nuqtali
 * 4 qator. Pastda doimiy panel: xarita tugmasi ("Qanday borasiz?") va asosiy tugma — olish (ko'k), faol kupon (qora),
 * yopiq yoki tugagan (kulrang, ikki qatorli sabab). Shartlar, joy va manzil bloklari yo'q (dizayn bo'yicha).
 */
export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { origin } = useLocation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const detail = useLoad(useCallback(() => appApi.deal(id, origin), [id, origin]), true, `deal.${id}`);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [directions, setDirections] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const d = copy.deal;

  const data = detail.data;
  const { setData, refresh } = detail;

  // Kupon ekranidan qaytganda (sotildi / bekor qilindi) — holat yangilanadi
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

  const top = insets.top + 8;

  if (!data) {
    return (
      <View style={[styles.fill, { paddingTop: top + 56 }]}>
        {detail.error ? (
          <View style={styles.pad}>
            <Failed error={detail.code === "not_found" ? d.notFound : detail.error} onRetry={() => void detail.reload()} />
          </View>
        ) : (
          <Loading />
        )}
        <View style={[styles.topBar, { top }]}>
          <RoundButton icon="arrowLeft" label={copy.back} onPress={back} />
        </View>
      </View>
    );
  }

  const { deal, business } = data;
  const hero = Math.max(MIN_HERO, Math.min(HERO, height - REST));
  const hours = `${formatMinute(data.fromMinute)}–${formatMinute(data.toMinute % 1440)}`;
  const categoryName = deal.typeLabel ?? "";
  const km = deal.distanceKm !== null ? formatKm(deal.distanceKm) : null;

  const pill = statusPill(deal, now);
  const when = deal.live ? null : opensWhen(deal, now);
  const status = deal.live ? { text: pill.text, color: colors.greenOk, dot: colors.green } : { text: when ? d.closedStatus(when) : d.ended, color: colors.muted, dot: colors.idle };

  const soldOut = deal.live && deal.left <= 0 && !data.coupon;
  const closed = !deal.live && !data.coupon;
  const nextDay = soldOut ? nextOpenDay(data, now) : null;
  const blocked = soldOut
    ? { title: d.soldOut, sub: nextDay ? upperFirst(d.soldOutHint(nextDay, deal.total)) : null }
    : closed
      ? { title: when ? upperFirst(d.opens(when)) : d.ended, sub: when ? d.closedHint : null }
      : null;

  const contacts = [
    business.phone ? { key: "phone", label: d.call, url: `tel:${business.phone.replace(/[^\d+]/g, "")}`, logo: null } : null,
    business.telegram ? { key: "telegram", label: d.telegram, url: `https://t.me/${business.telegram.replace(/^@/, "")}`, logo: BRAND_LOGOS.telegram } : null,
    business.instagram ? { key: "instagram", label: d.instagram, url: `https://instagram.com/${business.instagram.replace(/^@/, "")}`, logo: BRAND_LOGOS.instagram } : null,
  ].filter((c) => c !== null);

  const rows = [
    { label: formatWeekdays(data.weekdays), value: hours },
    { label: deal.live ? d.leftToday : d.leftNext, value: d.leftOf(deal.left, deal.total) },
    { label: d.perStudent, value: d.perStudentValues[data.perStudentLimit] ?? data.perStudentLimit },
    { label: d.promo, value: formatUntil(data.endsOn) },
  ];

  return (
    <View style={styles.fill}>
      <Gallery deal={deal} width={width} height={hero} categoryName={categoryName} />

      <PriceTag deal={deal} size="hero" style={[styles.tag, { top: hero - BELOW_HERO }]}>
        <PctSticker size="hero" style={styles.sticker}>
          {deal.badge}
        </PctSticker>
      </PriceTag>

      <View style={[styles.body, { top: hero + BELOW_HERO }]}>
        <View style={styles.storeRow}>
          {business.logoUrl ? (
            <Image source={{ uri: imageUrl(business.logoUrl) }} style={styles.logo} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.logo, { backgroundColor: deal.ink }]} importantForAccessibility="no-hide-descendants">
              <Txt style={[font(900), styles.logoLetter]}>{business.name.trim().charAt(0).toUpperCase()}</Txt>
            </View>
          )}
          <View style={styles.storeName}>
            <Txt numberOfLines={1} style={[font(800), styles.storeText]}>
              {business.name}
            </Txt>
            <VerifiedSeal label={d.verifiedLabel} />
          </View>
          {contacts.map((c) => (
            <Press key={c.key} onPress={() => void Linking.openURL(c.url)} accessibilityRole="link" accessibilityLabel={c.label} scale={0.94} hitSlop={2} style={styles.contact}>
              {c.logo ? <Image source={c.logo} style={styles.contactLogo} resizeMode="contain" resizeMethod="resize" /> : <Icon name="phone" size={18} strokeWidth={2.2} />}
            </Press>
          ))}
        </View>

        <Txt accessibilityRole="header" numberOfLines={2} style={[font(900, 112), styles.title]}>
          {deal.title}
        </Txt>
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
          <Txt numberOfLines={1} style={[font(800), styles.statusText, { color: status.color }]}>
            {status.text}
          </Txt>
        </View>

        <View style={styles.rows}>
          {rows.map((r) => (
            <View key={r.label} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
              <Txt style={[font(600), styles.dt]}>{r.label}</Txt>
              <View style={styles.dots} />
              <Txt style={[font(800), styles.dd]}>{r.value}</Txt>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom + 12, 26) }]}>
        <ErrorBox>{claimError}</ErrorBox>
        <View style={[styles.panelRow, claimError ? styles.panelGap : null]}>
          <Press onPress={() => setDirections(true)} accessibilityRole="button" accessibilityLabel={km ? d.directionsLabel(km) : copy.directions.title} scale={0.95} style={styles.map}>
            <MapThumb km={km} />
          </Press>
          {blocked ? (
            <View style={styles.blocked} accessible accessibilityRole="text" accessibilityState={{ disabled: true }}>
              <Txt numberOfLines={1} style={[font(800), styles.blockedTitle]}>
                {blocked.title}
              </Txt>
              {blocked.sub ? (
                <Txt numberOfLines={1} style={[font(600), styles.blockedSub]}>
                  {blocked.sub}
                </Txt>
              ) : null}
            </View>
          ) : (
            <Press
              onPress={() => void claim()}
              disabled={claiming}
              accessibilityRole="button"
              accessibilityState={{ busy: claiming }}
              style={[styles.cta, { backgroundColor: data.coupon ? colors.ink : colors.blue }]}
            >
              <Txt numberOfLines={1} style={[font(800), styles.ctaText]}>
                {data.coupon ? d.showCoupon : claiming ? d.claiming : d.claim}
              </Txt>
              {claiming ? <ActivityIndicator color={colors.white} /> : <Icon name="arrowRight" size={22} strokeWidth={2.4} color={colors.white} />}
            </Press>
          )}
        </View>
      </View>

      <View style={[styles.topBar, { top }]}>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={back} />
        <RoundButton icon="bookmark" label={data.saved ? d.unsave : d.save} active={data.saved} onPress={() => void toggleSave()} />
      </View>

      <DirectionsSheet
        visible={directions}
        onClose={() => setDirections(false)}
        target={{ address: business.address, district: business.district, landmark: business.landmark, point: business.point, distanceKm: deal.distanceKm }}
      />
    </View>
  );
}

/** Tugagan kundan keyingi ochilish: chegirma kunlaridan eng yaqini (ertaga yoki hafta kuni), muddat ichida. */
function nextOpenDay(data: DealDetail, now: Date): string | null {
  const today = toTashkent(now);
  const time = formatMinute(data.fromMinute);
  const end = Date.parse(`${data.endsOn}T00:00:00Z`);
  for (let i = 1; i <= 7; i++) {
    const day = new Date(today.date.getTime() + i * 86_400_000);
    if (day.getTime() > end) return null;
    const weekday = ((today.weekday - 1 + i) % 7) + 1;
    if (!data.weekdays.includes(weekday)) continue;
    return i === 1 ? copy.deal.opensWhen.tomorrow(time) : copy.deal.opensWhen.weekday(copy.weekdays[weekday - 1]!, time);
  }
  return null;
}

/** Rasmlar — gorizontal varaqlash, pastki o'ngda nuqtalar; rasm yo'q — kategoriya plitasi */
function Gallery({ deal, width, height, categoryName }: { deal: DealDetail["deal"]; width: number; height: number; categoryName: string }) {
  const [index, setIndex] = useState(0);
  const images = deal.images.length ? deal.images : [undefined];
  return (
    <View style={{ height, backgroundColor: deal.tile }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={images.length > 1}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {images.map((src, i) => (
          <View key={src ?? "tile"} style={{ width, height }} accessible={Boolean(src)} accessibilityLabel={src ? copy.deal.photo(i + 1, images.length) : undefined}>
            <DealPhoto src={src} tile={deal.tile} ink={deal.ink} name={categoryName} size="hero" />
          </View>
        ))}
      </ScrollView>
      {images.length > 1 ? (
        <View style={styles.pager} importantForAccessibility="no-hide-descendants">
          {images.map((src, i) => (
            <View key={src ?? i} style={[styles.pagerDot, i === index ? styles.pagerOn : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Tasdiqlangan hamkor muhri (Chegirma.dc.html) */
function VerifiedSeal({ label }: { label: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" accessibilityRole="image" accessibilityLabel={label}>
      <Path
        d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z"
        fill={colors.greenOk}
      />
      <Path d="M8.3 12.2l2.5 2.5 4.9-5" fill="none" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Xarita tugmasi (74×64): yo'llar, ko'k pin va qora masofa yorlig'i */
function MapThumb({ km }: { km: string | null }) {
  return (
    <>
      <Svg width={70} height={60} viewBox="0 0 70 60" style={StyleSheet.absoluteFill}>
        <Path d="M-4 22 L80 10" stroke={colors.white} strokeWidth={7} />
        <Path d="M22 -4 L30 70" stroke={colors.white} strokeWidth={5} />
        <Path d="M-4 48 C20 40, 46 56, 80 44" stroke={colors.white} strokeWidth={5} fill="none" />
        <Path d="M56 -4 L50 70" stroke={colors.tileBogo} strokeWidth={4} />
      </Svg>
      <Svg width={22} height={28} viewBox="0 0 22 28" style={styles.pin}>
        <Path d="M11 27s9-8.4 9-15.5A9 9 0 0 0 2 11.5C2 18.6 11 27 11 27z" fill={colors.blue} stroke={colors.ink} strokeWidth={2} />
        <Circle cx={11} cy={11.5} r={3.4} fill={colors.white} />
      </Svg>
      {km ? (
        <View style={styles.kmTag}>
          <Txt numberOfLines={1} style={[font(800), styles.kmText]}>
            {km}
          </Txt>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  pad: { paddingHorizontal: 24 },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  pager: { position: "absolute", right: 18, bottom: 18, flexDirection: "row", gap: 5 },
  pagerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(17,17,17,0.3)" },
  pagerOn: { width: 18, backgroundColor: colors.ink },
  tag: { left: 20 },
  sticker: { right: -54, top: -26 },
  body: { position: "absolute", left: 0, right: 0, paddingHorizontal: 24 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.track },
  logoLetter: { fontSize: 14, color: colors.white },
  storeName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 },
  storeText: { fontSize: 15, flexShrink: 1 },
  contact: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  contactLogo: { width: 22, height: 22 },
  title: { marginTop: 14, fontSize: 34, lineHeight: 35, letterSpacing: em(34, -0.025) },
  status: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: 14, flexShrink: 1 },
  rows: { marginTop: 20, gap: 12 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  dt: { fontSize: 15, color: colors.muted2 },
  dots: { flex: 1, marginBottom: 4, borderBottomWidth: 2, borderStyle: "dotted", borderColor: colors.dot },
  dd: { fontSize: 15, fontVariant: ["tabular-nums"] },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 20, backgroundColor: colors.paper },
  panelRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  panelGap: { marginTop: 10 },
  map: { width: 74, height: 64, borderRadius: 20, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.mapTile, overflow: "hidden" },
  pin: { position: "absolute", left: 26, top: 8 },
  kmTag: { position: "absolute", bottom: 5, alignSelf: "center", backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 6, paddingTop: 1, paddingBottom: 2 },
  kmText: { fontSize: 11, color: colors.white },
  cta: { flex: 1, height: 64, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 12 },
  ctaText: { fontSize: 18, color: colors.white, flexShrink: 1 },
  blocked: { flex: 1, height: 64, borderRadius: 20, backgroundColor: colors.track, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 12 },
  blockedTitle: { fontSize: 16, color: colors.ink5 },
  blockedSub: { fontSize: 12, color: colors.muted2 },
});
