import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appApi, type FeedDeal } from "@/api/endpoints";
import { copy } from "@/copy";
import { filterDeals, isLowStock, sortDeals, type FeedSort } from "@/lib/feed";
import { dealNote, formatKm, formatSom, statusPill } from "@/lib/format";
import { TASHKENT, useLocation } from "@/lib/location";
import { useLoad } from "@/lib/use-load";
import { BellButton, CategoryPill, CategoryRow, DealTag, FeedCard, FloatButton, StatusPill, SearchUnderline } from "@/site/ui";
import { LocationSheet } from "@/student/location-sheet";
import { SortSheet } from "@/student/sort-sheet";
import { colors, em, font } from "@/theme";
import { DealsMap } from "@/ui/deals-map";
import { Failed, imageUrl, Loading, Toggle } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

/** Lenta har daqiqa yangilanadi (saytdagidek: holat va qoldiq o'zgaradi) */
const REFRESH_MS = 60_000;

/** Kartadagi belgilar (saytdagi `useDealMarks`): holat pilyulkasi, oz qolganda zaxira yorlig'i, pastda qoldiq */
function marksOf(deal: FeedDeal, now: Date) {
  const low = isLowStock(deal, now);
  return {
    pill: statusPill(deal, now),
    stock: low ? copy.deal.hot(deal.left, deal.total) : null,
    status: low ? copy.deal.leftLow(deal.left, deal.total) : copy.deal.left(deal.left, deal.total),
    tone: low ? ("hot" as const) : ("later" as const),
  };
}

/**
 * T4 — chegirmalar lentasi, saytning telefon ko'rinishi bilan bir xil (`student/feed/feed-phone.tsx`, "Lenta B · Jurnal"):
 * sana va joy, "Bugun arzon.", tagchiziqli qidiruv, kategoriya chiplari, boshqaruv qatori (soni, "Hozir ochiq", saralash,
 * "Ro'yxat | Xarita"), kartalar, pastda suzuvchi "Xarita". Filtr va saralash `src/lib/feed.ts` (sayt bilan bir xil).
 */
export default function Deals() {
  const f = copy.feed;
  const insets = useSafeAreaInsets();
  const { origin, label, ready } = useLocation();
  const feed = useLoad(useCallback(() => appApi.deals(origin), [origin]), ready, "deals");
  const inbox = useLoad(useCallback(() => appApi.notifications(), []));
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const { category: linked } = useLocalSearchParams<{ category?: string }>();
  const [seenLink, setSeenLink] = useState<string | undefined>(undefined);
  if (linked !== seenLink) {
    setSeenLink(linked);
    if (linked) setCategory(linked);
  }
  const [liveOnly, setLiveOnly] = useState(false);
  const [sort, setSort] = useState<FeedSort>("near");
  const [view, setView] = useState<"list" | "map">("list");
  const [sheet, setSheet] = useState<"sort" | "place" | null>(null);
  const [now, setNow] = useState(() => new Date());

  const { refresh: refreshFeed } = feed;
  const { refresh: refreshInbox } = inbox;
  useFocusEffect(
    useCallback(() => {
      void refreshInbox();
      const id = setInterval(() => {
        setNow(new Date());
        void refreshFeed();
      }, REFRESH_MS);
      return () => clearInterval(id);
    }, [refreshFeed, refreshInbox]),
  );

  const categories = useMemo(() => feed.data?.categories ?? [], [feed.data]);
  const names = useMemo(() => new Map(categories.map((c) => [c.slug, c.name])), [categories]);
  const listFor = useCallback(
    (live: boolean, by: FeedSort) => (feed.data ? sortDeals(filterDeals(feed.data.deals, { q, category, liveOnly: live }, (slug) => names.get(slug) ?? ""), by) : []),
    [feed.data, q, category, names],
  );
  const list = useMemo(() => listFor(liveOnly, sort), [listFor, liveOnly, sort]);
  const allTile = { icon: "all", tileColor: colors.surface, inkColor: colors.ink };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 0) + 50, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      >
        <View style={styles.header}>
          <View style={styles.dateRow}>
            <Press onPress={() => setSheet("place")} accessibilityRole="button" accessibilityLabel={`${f.location.label}: ${label}`} scale={0.97} style={styles.place}>
              <Icon name="pin" size={20} strokeWidth={2.4} />
              <Txt numberOfLines={1} style={[font(800), styles.placeText]}>
                {label}
              </Txt>
              <Icon name="chevronDown" size={16} strokeWidth={2.6} color={colors.muted} />
            </Press>
            <BellButton unread={(inbox.data?.unread ?? 0) > 0} onPress={() => router.push("/notifications")} label={f.notifications} />
          </View>
          <View style={styles.titleRow}>
            <Txt accessibilityRole="header" style={[font(900, 125), styles.title]}>
              {f.titleTop}
              {"\n"}
              {f.titleBottom}
              <Txt style={[font(900, 125), styles.title, { color: colors.orange }]}>.</Txt>
            </Txt>
          </View>
          <View style={styles.searchWrap}>
            <SearchUnderline value={q} onChange={setQ} placeholder={f.search} label={f.search} />
          </View>
        </View>

        <View style={styles.cats}>
          <CategoryRow>
            {[{ slug: "all", name: f.categoryAll, ...allTile }, ...categories].map((c) => (
              <CategoryPill key={c.slug} selected={category === c.slug} label={c.name} icon={c.icon} tileColor={c.tileColor} inkColor={c.inkColor} onPress={() => setCategory(c.slug)} />
            ))}
          </CategoryRow>
        </View>

        <View style={styles.controls}>
          <Txt style={[font(800), styles.count]}>{feed.data ? f.count(list.length) : ""}</Txt>
          <Press onPress={() => setLiveOnly(!liveOnly)} accessibilityRole="switch" accessibilityState={{ checked: liveOnly }} scale={0.97} style={styles.live}>
            <Toggle on={liveOnly} />
            <Txt style={[font(700), styles.controlText]}>{f.liveNow}</Txt>
          </Press>
          <Press onPress={() => setSheet("sort")} accessibilityRole="button" accessibilityLabel={`${f.sortLabel}: ${f.sort[sort]}`} scale={0.97} style={styles.sortLink}>
            <Txt style={[font(700), styles.controlText, { color: colors.blue }]}>{f.sort[sort]}</Txt>
            <Icon name="chevronDown" size={14} strokeWidth={2.8} color={colors.blue} />
          </Press>
        </View>
        <StaleNote at={feed.staleAt} style={styles.stale} />

        {feed.loading ? (
          <Loading />
        ) : feed.error ? (
          <Failed error={feed.error} onRetry={() => void feed.reload()} />
        ) : view === "map" ? (
          <View style={styles.map}>
            <DealsMap center={origin && "lat" in origin ? origin : (list.find((d) => d.point)?.point ?? TASHKENT)} radiusKm={0} deals={list} showsUser={false} onOpen={(id) => router.push(`/deal/${id}`)} />
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((deal) => {
              const m = marksOf(deal, now);
              return (
                <FeedCard
                  key={deal.id}
                  badge={deal.badge}
                  store={deal.store}
                  where={[deal.district, deal.distanceKm !== null ? formatKm(deal.distanceKm) : null].filter(Boolean).join(" · ")}
                  title={deal.title}
                  price={deal.price ? { now: formatSom(deal.price.now), old: deal.price.old ? formatSom(deal.price.old) : undefined, currency: copy.currency } : undefined}
                  note={deal.price ? undefined : dealNote(deal)}
                  saves={deal.price?.old ? copy.deal.saves(formatSom(deal.price.old - deal.price.now)) : null}
                  marks={
                    <View style={styles.marks}>
                      <StatusPill tone={m.pill.tone} onImage>
                        {m.pill.text}
                      </StatusPill>
                      {m.stock ? <DealTag hot>{m.stock}</DealTag> : null}
                    </View>
                  }
                  status={m.status}
                  statusTone={m.tone}
                  image={deal.images[0] ? imageUrl(deal.images[0]) : undefined}
                  pendingLabel={copy.deal.pending}
                  tileColor={deal.tile}
                  inkColor={deal.ink}
                  onPress={() => router.push(`/deal/${deal.id}`)}
                />
              );
            })}
            {list.length === 0 ? <Txt style={styles.empty}>{q || category !== "all" || liveOnly ? f.emptyFilter : f.empty}</Txt> : null}
          </View>
        )}
      </ScrollView>

      <FloatButton icon={view === "map" ? undefined : "map"} label={view === "map" ? f.viewList : f.viewMap} onPress={() => setView(view === "map" ? "list" : "map")} bottom={16} />

      <SortSheet
        visible={sheet === "sort"}
        onClose={() => setSheet(null)}
        sort={sort}
        liveOnly={liveOnly}
        countFor={(live, by) => listFor(live, by).length}
        onApply={(next) => {
          setSort(next.sort);
          setLiveOnly(next.liveOnly);
          setSheet(null);
        }}
      />
      <LocationSheet visible={sheet === "place"} onClose={() => setSheet(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: 16 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  place: { height: 44, flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  placeText: { fontSize: 16, flexShrink: 1 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  title: { marginTop: 2, fontSize: 50, lineHeight: 44, letterSpacing: em(50, -0.05) },
  // Saytda sarlavha qatorlari line-height 0.88 bilan siqiladi — RN qator qutisi 11px balandroq, shuni qoplaydi
  // saytda mt-3.5
  searchWrap: { marginTop: 14 },
  cats: { marginTop: 16, paddingVertical: 4 },
  controls: { height: 48, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 },
  count: { flex: 1, fontSize: 15 },
  live: { flexDirection: "row", alignItems: "center", gap: 8, height: 44 },
  sortLink: { flexDirection: "row", alignItems: "center", gap: 4, height: 44 },
  controlText: { fontSize: 14 },
  stale: { marginLeft: 16 },
  list: { gap: 18, paddingHorizontal: 16, paddingTop: 12 },
  marks: { position: "absolute", top: 12, left: 12, zIndex: 2, gap: 6, maxWidth: "70%" },
  map: { marginHorizontal: 16, marginTop: 4, height: 420, borderRadius: 16, overflow: "hidden" },
  empty: { paddingHorizontal: 20, paddingVertical: 40, textAlign: "center", fontSize: 14, color: colors.muted },
});
