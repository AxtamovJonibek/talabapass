import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Linking, RefreshControl, StyleSheet, View } from "react-native";
import { appApi, type FeedDeal, type Point } from "@/api/endpoints";
import { copy } from "@/copy";
import { formatKm, statusPill } from "@/lib/format";
import { TASHKENT, useLocation } from "@/lib/location";
import { useLoad } from "@/lib/use-load";
import { colors, em, font } from "@/theme";
import { Card, Chip, Empty, Failed, Loading, PctBadge, TabScreen } from "@/ui/app";
import { DealsMap } from "@/ui/deals-map";
import { Icon } from "@/ui/icons";
import { Note, PrimaryButton, Press, TextAction, Title, Txt } from "@/ui/kit";

const RADII = [1, 3, 5, 10] as const;
const MAP_HEIGHT = 300;

type Perm = "unknown" | "granted" | "ask" | "blocked";

/**
 * Yaqin (`GET /deals/nearby`): xarita (react-native-maps) va ro'yxat — yaqini oldin, radius 1–10 km. Joylashuv ruxsati
 * so'raladi; berilmasa — tanlangan tuman/viloyat yoki Toshkent markazidan. Marker yoki qator bosilsa — tafsilot.
 */
export default function Nearby() {
  const n = copy.nearby;
  const { choice, locate } = useLocation();
  const [perm, setPerm] = useState<Perm>("unknown");
  const [gps, setGps] = useState<Point | null>(null);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(5);
  const [now, setNow] = useState(() => new Date());

  // Fokusga kelganda: ruxsat bo'lsa — joriy joy (sukut bilan, oyna chiqarmasdan)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setNow(new Date());
      void Location.getForegroundPermissionsAsync()
        .then(async (p) => {
          if (cancelled) return;
          if (p.status !== "granted") {
            setPerm(p.canAskAgain ? "ask" : "blocked");
            return;
          }
          setPerm("granted");
          const r = await locate(false);
          if (!cancelled && r.ok) setGps({ lat: r.lat, lng: r.lng });
        })
        .catch(() => setPerm("ask"));
      return () => {
        cancelled = true;
      };
    }, [locate]),
  );

  const allow = async () => {
    const r = await locate(false);
    if (r.ok) {
      setPerm("granted");
      setGps({ lat: r.lat, lng: r.lng });
    } else setPerm(r.reason === "denied" && !r.canAskAgain ? "blocked" : "ask");
  };

  // Markaz: GPS → tanlangan tuman/viloyat → Toshkent
  const fallback = choice && choice.kind !== "gps" ? choice.place : null;
  const center: Point = gps ?? (choice?.kind === "gps" ? { lat: choice.lat, lng: choice.lng } : fallback ? { lat: fallback.lat, lng: fallback.lng } : TASHKENT);
  const { lat, lng } = center;
  const ready = perm !== "unknown";
  const near = useLoad(
    useCallback(() => appApi.nearby({ lat, lng }, radius), [lat, lng, radius]),
    ready,
  );
  const deals = useMemo(() => near.data?.deals ?? [], [near.data]);
  const open = (id: string) => router.push(`/deal/${id}`);

  const header = (
    <View>
      <View style={styles.map}>
        <DealsMap center={center} radiusKm={radius} deals={deals} showsUser={perm === "granted"} onOpen={open} />
      </View>
      <View style={styles.pad}>
        {perm !== "granted" && perm !== "unknown" ? (
          <Card style={styles.permission}>
            <Txt style={[font(800), { fontSize: 16, marginTop: 14 }]}>{n.permissionTitle}</Txt>
            <Note>{n.permissionText}</Note>
            <Note>{n.fallback(fallback?.name ?? copy.feed.location.city)}</Note>
            {perm === "ask" ? (
              <PrimaryButton icon={null} onPress={() => void allow()} style={styles.allow}>
                {n.allow}
              </PrimaryButton>
            ) : (
              <TextAction onPress={() => void Linking.openSettings()}>{copy.feed.location.openSettings}</TextAction>
            )}
            <View style={styles.cardEnd} />
          </Card>
        ) : null}
        <View style={styles.radii}>
          <Txt style={[font(800), styles.radiusLabel]}>{n.radius.toUpperCase()}</Txt>
          {RADII.map((r) => (
            <Chip key={r} selected={radius === r} onPress={() => setRadius(r)}>
              {`${r} km`}
            </Chip>
          ))}
        </View>
        {near.data ? <Txt style={[font(700), styles.count]}>{n.count(deals.length)}</Txt> : null}
      </View>
    </View>
  );

  return (
    <TabScreen>
      <View style={styles.head}>
        <Title text={n.title} size={38} />
      </View>
      <FlatList<FeedDeal>
        data={deals}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <NearRow deal={item} now={now} onPress={() => open(item.id)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !ready || near.loading ? (
            <Loading />
          ) : near.error ? (
            <Failed error={near.error} onRetry={() => void near.reload()} style={styles.pad} />
          ) : (
            <Empty icon="map" title={n.empty(radius)} style={styles.pad} />
          )
        }
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={near.refreshing} onRefresh={() => void near.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      />
    </TabScreen>
  );
}

/** Ro'yxat qatori: biznes, nom, masofa va holat, foiz */
function NearRow({ deal, now, onPress }: { deal: FeedDeal; now: Date; onPress: () => void }) {
  const pill = statusPill(deal, now);
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={`${deal.store}, ${deal.title}`} scale={0.98} style={styles.row}>
      <View style={[styles.tile, { backgroundColor: deal.tile }]}>
        <Txt style={[font(900, 112), { fontSize: 24, color: deal.ink }]}>{deal.store.trim().charAt(0).toUpperCase()}</Txt>
      </View>
      <View style={styles.flex1}>
        <Txt numberOfLines={1} style={[font(700), { fontSize: 13, color: colors.muted }]}>
          {deal.store}
        </Txt>
        <Txt numberOfLines={1} style={[font(800), { fontSize: 17, marginTop: 1 }]}>
          {deal.title}
        </Txt>
        <View style={styles.meta}>
          <Icon name="pin" size={14} strokeWidth={2.4} color={colors.blue} />
          <Txt numberOfLines={1} style={[styles.flex1, { fontSize: 13, color: pill.tone === "open" ? colors.greenOk : colors.muted2 }]}>
            {deal.distanceKm !== null ? `${formatKm(deal.distanceKm)} · ` : ""}
            {pill.text}
          </Txt>
        </View>
      </View>
      <PctBadge size={26}>{deal.badge}</PctBadge>
    </Press>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  head: { paddingHorizontal: 24, paddingBottom: 12 },
  content: { paddingBottom: 24 },
  map: { height: MAP_HEIGHT, marginHorizontal: 24, borderRadius: 24, overflow: "hidden", backgroundColor: colors.track },
  pad: { paddingHorizontal: 24 },
  permission: { marginTop: 14 },
  allow: { marginTop: 14 },
  cardEnd: { height: 14 },
  radii: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 14 },
  radiusLabel: { fontSize: 12, letterSpacing: em(12, 0.08), color: colors.muted2, marginRight: 4 },
  count: { fontSize: 13, color: colors.muted2, marginTop: 14, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 12, marginHorizontal: 24, marginTop: 10 },
  tile: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
});
