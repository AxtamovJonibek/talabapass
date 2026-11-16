import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { appApi, type FeedDeal } from "@/api/endpoints";
import { copy } from "@/copy";
import { filterDeals, SORTS, sortDeals, type FeedSort } from "@/lib/feed";
import { useLocation } from "@/lib/location";
import { useLoad } from "@/lib/use-load";
import { LocationSheet } from "@/student/location-sheet";
import { colors, em, font } from "@/theme";
import { Chip, DealCard, Empty, Failed, Loading, OptionRow, RoundButton, Sheet, TabScreen } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Field, Title, Txt } from "@/ui/kit";
import { StaleNote } from "@/ui/offline";

/** Lenta va sahifa har daqiqa yangilanadi (saytdagidek: holat va qoldiq o'zgaradi) */
const REFRESH_MS = 60_000;

/**
 * Chegirmalar (saytdagi T4 "Bugun arzon."): joy, qidiruv, kategoriya chiplari, "Hozir ochiq", saralash — filtr va
 * saralash qurilmada (`src/lib/feed.ts`, saytdagi bilan bir xil), server bir marta hammasini beradi.
 * Pull-to-refresh; yuklanish / bo'sh / xato holatlari. Qo'ng'iroq — bildirishnomalar (o'qilmagani bo'lsa nuqta).
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
  const list = useMemo(() => {
    if (!feed.data) return [];
    const names = new Map(categories.map((c) => [c.slug, c.name]));
    return sortDeals(filterDeals(feed.data.deals, { q, category, liveOnly }, (slug) => names.get(slug) ?? ""), sort);
  }, [feed.data, categories, q, category, liveOnly, sort]);

  const filtered = q.trim() !== "" || category !== "all" || liveOnly;
  const reset = () => {
    setQ("");
    setCategory("all");
    setLiveOnly(false);
  };

  const header = (
    <View>
      <View style={styles.top}>
        <Title text={`${f.titleTop} <hl>${f.titleBottom}</hl>`} size={40} style={styles.title} />
        <RoundButton icon="bell" label={f.notifications} dot={(inbox.data?.unread ?? 0) > 0} onPress={() => router.push("/notifications")} />
      </View>

      <Pressable onPress={() => setSheet("place")} accessibilityRole="button" accessibilityLabel={`${f.location.label}: ${label}`} style={styles.place} hitSlop={6}>
        <Icon name="pin" size={18} strokeWidth={2.4} color={colors.blue} />
        <Txt style={[font(800), { fontSize: 15 }]}>{label}</Txt>
        <Icon name="chevronDown" size={18} strokeWidth={2.4} color={colors.muted} />
      </Pressable>

      <View style={styles.pad}>
        <Field
          height={54}
          text={17}
          value={q}
          onChangeText={setQ}
          placeholder={f.search}
          icon={{ name: "search", color: colors.muted }}
          accessibilityLabel={f.search}
          returnKeyType="search"
          autoCorrect={false}
          trailing={
            q ? (
              <Pressable onPress={() => setQ("")} accessibilityRole="button" accessibilityLabel={f.clearSearch} style={styles.clear} hitSlop={6}>
                <Icon name="x" size={20} strokeWidth={2.4} color={colors.muted} />
              </Pressable>
            ) : null
          }
        />
      </View>

      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip selected={category === "all"} onPress={() => setCategory("all")} icon="all">
            {copy.feed.categoryAll}
          </Chip>
          {categories.map((c) => (
            <Chip key={c.slug} selected={category === c.slug} onPress={() => setCategory(c.slug)} icon={c.icon}>
              {c.name}
            </Chip>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.filters}>
        <Chip selected={liveOnly} onPress={() => setLiveOnly((v) => !v)} label={f.liveNow}>
          {f.liveNow}
        </Chip>
        <Chip selected={false} onPress={() => setSheet("sort")} icon="sliders" label={`${f.sortLabel}: ${f.sort[sort]}`}>
          {f.sort[sort]}
        </Chip>
      </View>

      {feed.data ? <Txt style={[font(700), styles.count]}>{f.count(list.length)}</Txt> : null}
      <StaleNote at={feed.staleAt} style={styles.stale} />
    </View>
  );

  const empty = feed.loading ? (
    <Loading />
  ) : feed.error ? (
    <Failed error={feed.error} onRetry={() => void feed.reload()} style={styles.pad} />
  ) : (
    <Empty
      icon="tag"
      title={filtered ? f.emptyFilter : f.empty}
      action={filtered ? { label: f.resetFilters, onPress: reset } : undefined}
      style={styles.pad}
    />
  );

  return (
    <TabScreen>
      <FlatList<FeedDeal>
        data={list}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <DealCard deal={item} now={now} onPress={() => router.push(`/deal/${item.id}`)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={() => void feed.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      />

      <Sheet visible={sheet === "sort"} onClose={() => setSheet(null)} title={f.sortLabel}>
        {SORTS.map((s) => (
          <OptionRow
            key={s}
            label={f.sort[s]}
            selected={sort === s}
            onPress={() => {
              setSort(s);
              setSheet(null);
            }}
          />
        ))}
      </Sheet>
      <LocationSheet visible={sheet === "place"} onClose={() => setSheet(null)} />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 24 },
  title: { flex: 1 },
  place: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44, marginHorizontal: 24, marginTop: 6 },
  pad: { paddingHorizontal: 24 },
  clear: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  chips: { gap: 8, paddingHorizontal: 24, paddingTop: 14 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingTop: 10, flexWrap: "wrap" },
  count: { fontSize: 13, letterSpacing: em(13, 0.04), color: colors.muted2, paddingHorizontal: 24, marginTop: 16, marginBottom: 4 },
  stale: { marginLeft: 24, marginBottom: 4 },
  item: { paddingHorizontal: 24, paddingTop: 10 },
});
