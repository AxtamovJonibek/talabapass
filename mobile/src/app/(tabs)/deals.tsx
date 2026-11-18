import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { appApi, type FeedDeal } from "@/api/endpoints";
import { copy } from "@/copy";
import { filterDeals, sortDeals, type FeedSort } from "@/lib/feed";
import { useLocation } from "@/lib/location";
import { useLoad } from "@/lib/use-load";
import { LocationSheet } from "@/student/location-sheet";
import { SortSheet } from "@/student/sort-sheet";
import { colors, font } from "@/theme";
import { DealCard, Failed, Loading, RoundButton, TabScreen, Toggle } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Press, Title, Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

/** Lenta va sahifa har daqiqa yangilanadi (saytdagidek: holat va qoldiq o'zgaradi) */
const REFRESH_MS = 60_000;

/**
 * Chegirmalar (design/app-flow/Lenta.dc.html): joy va qo'ng'iroq, "Bugun arzon.", qidiruv (ichida saralash tugmasi),
 * matnli kategoriya chiplari bitta gorizontal qatorda, "N ta chegirma · Hozir ochiq · Eng yaqin ▾" bitta qatorda;
 * saralash — pastdan oyna (LentaFiltr.dc.html). Filtr va saralash qurilmada (`src/lib/feed.ts`, saytdagi bilan bir xil),
 * holatda turadi — tarixga yozilmaydi (Android "orqaga" ularni bekor qilmaydi, tabdan chiqaradi).
 */
export default function Deals() {
  const f = copy.feed;
  const { origin, label, ready } = useLocation();
  const feed = useLoad(useCallback(() => appApi.deals(origin), [origin]), ready, "deals");
  const inbox = useLoad(useCallback(() => appApi.notifications(), []));
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  // Bildirishnomadan kategoriya bilan kelganda (`/deals?category=kofe`) — o'sha kategoriya tanlanadi
  const { category: linked } = useLocalSearchParams<{ category?: string }>();
  const [seenLink, setSeenLink] = useState<string | undefined>(undefined);
  if (linked !== seenLink) {
    setSeenLink(linked);
    if (linked) setCategory(linked);
  }
  const [liveOnly, setLiveOnly] = useState(false);
  const [sort, setSort] = useState<FeedSort>("near");
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

  const filtered = q.trim() !== "" || category !== "all" || liveOnly;
  const reset = () => {
    setQ("");
    setCategory("all");
    setLiveOnly(false);
  };

  const header = (
    <View>
      <View style={styles.top}>
        <Pressable onPress={() => setSheet("place")} accessibilityRole="button" accessibilityLabel={`${f.location.label}: ${label}`} style={styles.place} hitSlop={6}>
          <Icon name="pin" size={18} strokeWidth={2.4} color={colors.blue} />
          <Txt numberOfLines={1} style={[font(800), styles.placeText]}>
            {label}
          </Txt>
          <Icon name="chevronDown" size={16} strokeWidth={2.6} color={colors.muted} />
        </Pressable>
        <RoundButton icon="bell" label={f.notifications} dot={(inbox.data?.unread ?? 0) > 0} onPress={() => router.push("/notifications")} />
      </View>

      <Title text={`${f.titleTop} <hl>${f.titleBottom}</hl>`} size={34} tight="feed" style={styles.title} />

      <View style={styles.search}>
        <Icon name="search" size={20} strokeWidth={2.4} color={colors.muted2} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={f.search}
          placeholderTextColor={colors.muted2}
          selectionColor={colors.blue}
          accessibilityLabel={f.search}
          returnKeyType="search"
          autoCorrect={false}
          maxFontSizeMultiplier={1.25}
          style={[font(600), styles.searchInput]}
        />
        {q ? (
          <Pressable onPress={() => setQ("")} accessibilityRole="button" accessibilityLabel={f.clearSearch} style={styles.clear} hitSlop={4}>
            <Icon name="close" size={18} strokeWidth={2.4} color={colors.muted} />
          </Pressable>
        ) : null}
        <Press onPress={() => setSheet("sort")} accessibilityRole="button" accessibilityLabel={f.sortOpen} scale={0.94} style={styles.sortButton}>
          <Icon name="sliders" size={20} strokeWidth={2.4} />
        </Press>
      </View>

      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" accessibilityRole="tablist">
          {[{ slug: "all", name: f.categoryAll }, ...categories].map((c) => {
            const on = category === c.slug;
            return (
              <Press
                key={c.slug}
                onPress={() => setCategory(c.slug)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                scale={0.96}
                style={[styles.chip, on ? styles.chipOn : null]}
              >
                <Txt style={[font(800), styles.chipText, on ? styles.chipTextOn : null]}>{c.name}</Txt>
              </Press>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.filters}>
        <Txt style={[font(700), styles.count]}>{feed.data ? f.count(list.length) : ""}</Txt>
        <Pressable onPress={() => setLiveOnly((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: liveOnly }} style={styles.live} hitSlop={4}>
          <Toggle on={liveOnly} />
          <Txt style={[font(800), styles.filterText]}>{f.liveNow}</Txt>
        </Pressable>
        <Pressable onPress={() => setSheet("sort")} accessibilityRole="button" accessibilityLabel={`${f.sortLabel}: ${f.sort[sort]}`} style={styles.sortLink} hitSlop={4}>
          <Txt style={[font(800), styles.filterText, { color: colors.blue }]}>{f.sort[sort]}</Txt>
          <Icon name="chevronDown" size={14} strokeWidth={2.8} color={colors.blue} />
        </Pressable>
      </View>
      <StaleNote at={feed.staleAt} style={styles.stale} />
    </View>
  );

  const empty = feed.loading ? (
    <Loading />
  ) : feed.error ? (
    <Failed error={feed.error} onRetry={() => void feed.reload()} />
  ) : (
    <View style={styles.empty}>
      <Txt style={[font(800), styles.emptyText]}>{filtered ? f.emptyFilter : f.empty}</Txt>
      {filtered ? (
        <Press onPress={reset} accessibilityRole="button" style={styles.emptyButton}>
          <Txt style={[font(800), { fontSize: 15 }]}>{f.resetFilters}</Txt>
        </Press>
      ) : null}
    </View>
  );

  return (
    <TabScreen>
      <FlatList<FeedDeal>
        data={list}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DealCard deal={item} now={now} categoryName={names.get(item.category)} onPress={() => router.push(`/deal/${item.id}`)} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={styles.header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      />

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
    </TabScreen>
  );
}

const Separator = () => <View style={styles.gap} />;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  header: { marginHorizontal: -24, marginBottom: 10 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 24 },
  place: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, marginLeft: -2, flexShrink: 1 },
  placeText: { fontSize: 15, flexShrink: 1 },
  title: { marginTop: 6, marginHorizontal: 24 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    marginTop: 14,
    marginHorizontal: 24,
    paddingLeft: 14,
    paddingRight: 6,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  searchInput: { flex: 1, minWidth: 0, padding: 0, fontSize: 16, color: colors.ink },
  clear: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  sortButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  chips: { gap: 8, paddingHorizontal: 24, paddingTop: 12 },
  chip: { height: 38, paddingHorizontal: 15, borderRadius: 19, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, justifyContent: "center" },
  chipOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  chipText: { fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.white },
  filters: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 2 },
  count: { flex: 1, fontSize: 13, color: colors.muted2 },
  live: { flexDirection: "row", alignItems: "center", gap: 8, height: 36 },
  filterText: { fontSize: 13 },
  sortLink: { flexDirection: "row", alignItems: "center", gap: 4, height: 36 },
  stale: { marginLeft: 24, marginTop: 4 },
  gap: { height: 26 },
  empty: { backgroundColor: colors.white, borderRadius: 22, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center" },
  emptyText: { fontSize: 17, textAlign: "center" },
  emptyButton: { marginTop: 12, height: 44, paddingHorizontal: 18, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white, justifyContent: "center" },
});
