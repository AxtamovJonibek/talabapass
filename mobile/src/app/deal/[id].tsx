import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, errorText } from "@/api/client";
import { appApi, type DealDetail } from "@/api/endpoints";
import { copy } from "@/copy";
import { isLowStock } from "@/lib/feed";
import { formatKm, formatMinute, formatSom, formatUntil, formatWeekdays, statusPill } from "@/lib/format";
import { useLocation } from "@/lib/location";
import { rememberCoupon } from "@/lib/offline";
import { useLoad } from "@/lib/use-load";
import { DirectionsSheet } from "@/student/directions-sheet";
import { colors, em, font } from "@/theme";
import { Card, CardLabel, DealImage, Failed, imageUrl, InfoRow, Loading, PctBadge, PriceLine, RoundButton, SecondaryButton, StatusPill, StockTag } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { ErrorBox, Note, PrimaryButton, Press, Txt } from "@/ui/kit";

const HERO = 300;

/**
 * Chegirma tafsiloti (saytdagi T5): rasmlar, holat, narx, qachon/qoldiq/limit/muddat, tavsif va shartlar, joy
 * ("Borish" — xarita ilovalari), aloqa, yaqin atrofdagi joylar. Pastda: "Chegirmani olish" → kupon (QR) yoki
 * mavjud kuponni ko'rsatish; olib bo'lmasa — sababi. Saqlash (Saralangan) — tepada o'ngda.
 */
export default function DealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { origin } = useLocation();
  const insets = useSafeAreaInsets();
  const detail = useLoad(useCallback(() => appApi.deal(id, origin), [id, origin]));
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [directions, setDirections] = useState(false);
  const [now] = useState(() => new Date());
  const d = copy.deal;

  const data = detail.data;
  const { setData } = detail;

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

  const back = (
    <View style={[styles.topBar, { top: insets.top + 8 }]}>
      <RoundButton icon="arrowLeft" label={copy.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/deals"))} />
      {data ? <RoundButton icon="bookmark" label={data.saved ? d.unsave : d.save} active={data.saved} onPress={() => void toggleSave()} /> : null}
    </View>
  );

  if (!data) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + 64 }]}>
        {detail.error ? (
          <View style={styles.pad}>
            <Failed error={detail.code === "not_found" ? d.notFound : detail.error} onRetry={() => void detail.reload()} />
          </View>
        ) : (
          <Loading />
        )}
        {back}
      </View>
    );
  }

  const { deal, business } = data;
  const low = isLowStock(deal, now);
  const saves = deal.price?.old ? d.saves(formatSom(deal.price.old - deal.price.now)) : null;
  const hours = `${formatMinute(data.fromMinute)}–${formatMinute(data.toMinute % 1440)}`;
  const contacts = [
    business.phone ? { icon: "phone" as const, label: d.call, url: `tel:${business.phone.replace(/[^\d+]/g, "")}` } : null,
    business.telegram ? { icon: "send" as const, label: d.telegram, url: `https://t.me/${business.telegram.replace(/^@/, "")}` } : null,
    business.instagram ? { icon: "camera" as const, label: d.instagram, url: `https://instagram.com/${business.instagram.replace(/^@/, "")}` } : null,
  ].filter((c) => c !== null);

  const soldOut = deal.live && deal.left <= 0 && !data.coupon;
  const closed = !deal.live && !data.coupon;

  return (
    <View style={styles.fill}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={() => void detail.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      >
        <Gallery deal={deal} />
        <View style={styles.heroMarks}>
          <StatusPill deal={deal} now={now} />
          {low ? <StockTag>{d.hot(deal.left, deal.total)}</StockTag> : null}
        </View>

        <View style={styles.body}>
          <PctBadge size={46} style={styles.pct}>
            {deal.badge}
          </PctBadge>
          <View style={styles.storeRow}>
            {business.logoUrl ? <Image source={{ uri: imageUrl(business.logoUrl) }} style={styles.logo} /> : null}
            <Txt numberOfLines={1} style={[font(700), styles.flex1, { fontSize: 14, color: colors.muted }]}>
              {[business.name, business.typeLabel].filter(Boolean).join(" · ")}
            </Txt>
          </View>
          <Txt style={[font(900, 112), styles.title]}>{deal.title}</Txt>
          <View style={styles.price}>
            <PriceLine deal={deal} big />
            {saves ? <Txt style={[font(700), { fontSize: 14, color: colors.greenOk, marginTop: 4 }]}>{saves}</Txt> : null}
          </View>

          <Card style={styles.card}>
            <InfoRow icon="clock" label={d.when} value={`${formatWeekdays(data.weekdays)} · ${hours}`} />
            <InfoRow icon="ticket" label={deal.live ? d.leftToday : d.leftNext} value={d.leftValue(deal.left, deal.total)} />
            <InfoRow icon="user" label={d.limit} value={d.limits[data.perStudentLimit] ?? data.perStudentLimit} />
            <InfoRow icon="doc" label={d.until} value={formatUntil(data.endsOn)} last />
          </Card>

          {data.description || data.terms ? (
            <Card style={styles.card}>
              {data.description ? (
                <>
                  <CardLabel>{d.about}</CardLabel>
                  <Txt style={styles.para}>{data.description}</Txt>
                </>
              ) : null}
              {data.terms ? (
                <>
                  <CardLabel>{d.terms}</CardLabel>
                  <Txt style={styles.para}>{data.terms}</Txt>
                </>
              ) : null}
            </Card>
          ) : null}

          <Card style={styles.card}>
            <CardLabel>{d.place}</CardLabel>
            <View style={styles.verified}>
              <Txt style={[font(800), { fontSize: 17, flexShrink: 1 }]}>{business.name}</Txt>
              <Icon name="shieldCheck" size={18} color={colors.greenOk} strokeWidth={2.4} />
            </View>
            <Txt style={[styles.para, { color: colors.muted2 }]}>{[business.district, business.address].filter(Boolean).join(", ")}</Txt>
            {business.landmark ? <Txt style={[styles.para, { color: colors.muted2 }]}>{d.landmark(business.landmark)}</Txt> : null}
            {business.workingHours ? (
              <Txt style={[styles.para, { color: colors.muted2 }]}>
                {d.hours}: {business.workingHours}
              </Txt>
            ) : null}
            <SecondaryButton
              icon="navigate"
              onPress={() => setDirections(true)}
              style={styles.directions}
            >
              {deal.distanceKm !== null ? d.directionsWith(formatKm(deal.distanceKm)) : d.directions}
            </SecondaryButton>
            {contacts.length ? (
              <View style={styles.contacts}>
                {contacts.map((c) => (
                  <Press key={c.label} onPress={() => void Linking.openURL(c.url)} accessibilityRole="link" style={styles.contact}>
                    <Icon name={c.icon} size={18} strokeWidth={2.4} color={colors.blue} />
                    <Txt style={[font(800), { fontSize: 14, color: colors.blue }]}>{c.label}</Txt>
                  </Press>
                ))}
              </View>
            ) : null}
            <View style={styles.cardEnd} />
          </Card>

          {data.nearby.length ? (
            <>
              <Txt style={[font(900, 112), styles.section]}>{d.nearby}</Txt>
              <Card>
                {data.nearby.map((n, i) => (
                  <Press key={n.id} onPress={() => router.push(`/deal/${n.id}`)} accessibilityRole="button" scale={0.98} style={[styles.near, i < data.nearby.length - 1 ? styles.nearLine : null]}>
                    <View style={styles.flex1}>
                      <Txt numberOfLines={1} style={[font(800), { fontSize: 16 }]}>
                        {n.store}
                      </Txt>
                      <Txt style={{ fontSize: 13, color: n.live ? colors.greenOk : colors.muted2, marginTop: 2 }}>
                        {formatKm(n.distanceKm)} · {statusPill({ live: n.live, closesAt: null, opensAt: n.opensAt }, now).text}
                      </Txt>
                    </View>
                    <Txt style={[font(900, 62), { fontSize: 26 }]}>{n.badge}</Txt>
                    <Icon name="chevronRight" size={20} color={colors.muted2} strokeWidth={2.4} />
                  </Press>
                ))}
              </Card>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <ErrorBox>{claimError}</ErrorBox>
        <PrimaryButton
          icon={data.coupon ? "arrow" : null}
          loading={claiming}
          disabled={soldOut || closed}
          onPress={() => void claim()}
          style={claimError ? styles.ctaGap : null}
        >
          {data.coupon ? d.showCoupon : claiming ? d.claiming : soldOut ? d.soldOut : closed ? statusPill(deal, now).text : d.claim}
        </PrimaryButton>
        {!soldOut && !closed ? <Note style={styles.hint}>{d.claimHint}</Note> : null}
      </View>

      {back}
      <DirectionsSheet
        visible={directions}
        onClose={() => setDirections(false)}
        target={{ store: business.name, address: [business.district, business.address].filter(Boolean).join(", "), landmark: business.landmark, point: business.point, distanceKm: deal.distanceKm }}
      />
    </View>
  );
}

/** Rasmlar — gorizontal varaqlash; bitta yoki yo'q bo'lsa oddiy plita */
function Gallery({ deal }: { deal: DealDetail["deal"] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  if (deal.images.length <= 1) return <DealImage deal={deal} height={HERO} />;
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {deal.images.map((src, i) => (
          <View key={src} style={{ width }} accessible accessibilityLabel={copy.deal.photo(i + 1, deal.images.length)}>
            <DealImage deal={{ ...deal, images: [src] }} height={HERO} />
          </View>
        ))}
      </ScrollView>
      <View style={styles.counter}>
        <Txt style={[font(800), { fontSize: 12, color: colors.white }]}>{copy.deal.photo(index + 1, deal.images.length)}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  flex1: { flex: 1 },
  pad: { paddingHorizontal: 24 },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  heroMarks: { position: "absolute", top: HERO - 64, left: 16, right: 120, gap: 6 },
  counter: { position: "absolute", right: 16, top: HERO - 40, backgroundColor: "rgba(17,17,17,0.6)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  body: { paddingHorizontal: 24, paddingTop: 18 },
  pct: { position: "absolute", right: 20, top: -34 },
  storeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 110 },
  logo: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.track },
  title: { fontSize: 32, lineHeight: 34, letterSpacing: em(32, -0.02), marginTop: 10 },
  price: { marginTop: 14 },
  card: { marginTop: 16 },
  para: { fontSize: 15, lineHeight: 22, color: colors.ink5, marginBottom: 6 },
  verified: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  directions: { marginTop: 10 },
  contacts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  contact: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.blueTint },
  cardEnd: { height: 14 },
  section: { fontSize: 24, letterSpacing: em(24, -0.02), marginTop: 26, marginBottom: 10 },
  near: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  nearLine: { borderBottomWidth: 1.5, borderBottomColor: colors.lineSoft },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.paper, paddingHorizontal: 24, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: colors.lineSoft },
  ctaGap: { marginTop: 10 },
  hint: { textAlign: "center" },
});
