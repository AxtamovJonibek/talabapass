import { router } from "expo-router";
import { useCallback } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appApi, type InboxItem } from "@/api/endpoints";
import { copy } from "@/copy";
import { formatWhen } from "@/lib/format";
import { useLoad } from "@/lib/use-load";
import { colors, em, font } from "@/theme";
import { Empty, Failed, Loading, RoundButton } from "@/ui/app";
import { Press, TextAction, Title, Txt } from "@/ui/kit";

/**
 * Bildirishnomalar (`GET /notifications`): yangilari belgili. Bosilgan xabar o'qilgan bo'ladi (`{ ids }`) va havolasi
 * ochiladi (chegirma → tafsilot, kategoriya → lenta shu kategoriya bilan); "Hammasini o'qildi" — barchasi.
 */
export default function Notifications() {
  const n = copy.notifications;
  const insets = useSafeAreaInsets();
  const inbox = useLoad(useCallback(() => appApi.notifications(), []));
  const { setData } = inbox;
  const unread = inbox.data?.unread ?? 0;

  const markLocal = (ids: string[] | null) =>
    setData((d) => {
      if (!d) return d;
      const items = d.items.map((i) => (ids === null || ids.includes(i.id) ? { ...i, unread: false } : i));
      return { items, unread: items.filter((i) => i.unread).length };
    });

  const open = (item: InboxItem) => {
    if (item.unread) {
      markLocal([item.id]);
      void appApi.markRead([item.id]).catch(() => undefined);
    }
    if (item.link.type === "DISCOUNT" && item.link.id) router.push(`/deal/${item.link.id}`);
    else if (item.link.type === "CATEGORY" && item.link.id) router.navigate(`/deals?category=${encodeURIComponent(item.link.id)}`);
  };

  const markAll = () => {
    markLocal(null);
    void appApi.markRead().catch(() => undefined);
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top + 12 }]}>
      <View style={styles.top}>
        <RoundButton icon="arrowLeft" label={copy.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/deals"))} />
        <Title text={n.title} size={30} style={styles.title} />
      </View>
      {unread > 0 ? (
        <View style={styles.markAll}>
          <TextAction onPress={markAll}>{n.markAll}</TextAction>
        </View>
      ) : null}
      <FlatList<InboxItem>
        data={inbox.data?.items ?? []}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Press onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${item.unread ? `${n.unread}. ` : ""}${item.title}. ${item.body}`} scale={0.985} style={styles.item}>
            <View style={styles.itemHead}>
              {item.unread ? <View style={styles.dot} /> : null}
              <Txt style={[font(item.unread ? 800 : 700), styles.itemTitle]}>{item.title}</Txt>
              {item.unread ? <Txt style={[font(800), styles.badge]}>{n.unread.toUpperCase()}</Txt> : null}
            </View>
            <Txt style={styles.body}>{item.body}</Txt>
            <Txt style={styles.when}>{formatWhen(item.at)}</Txt>
          </Press>
        )}
        ListEmptyComponent={
          inbox.loading ? <Loading /> : inbox.error ? <Failed error={inbox.error} onRetry={() => void inbox.reload()} /> : <Empty icon="bell" title={n.empty} />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={inbox.refreshing} onRefresh={() => void inbox.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.paper },
  top: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24 },
  title: { flex: 1 },
  markAll: { paddingHorizontal: 24, alignItems: "flex-end" },
  content: { paddingHorizontal: 24, paddingTop: 8 },
  item: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 10 },
  itemHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange },
  itemTitle: { flex: 1, fontSize: 16 },
  badge: { fontSize: 11, letterSpacing: em(11, 0.08), color: colors.blue },
  body: { fontSize: 15, lineHeight: 21, color: colors.ink5, marginTop: 6 },
  when: { fontSize: 12, color: colors.muted2, marginTop: 8 },
});
