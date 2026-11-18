import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appApi, type InboxItem } from "@/api/endpoints";
import { copy } from "@/copy";
import { formatMinute, toTashkent } from "@/lib/format";
import { syncBadge } from "@/lib/push";
import { useLoad } from "@/lib/use-load";
import { mono } from "@/site/ui";
import { useApp } from "@/state";
import { colors, em, font } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { Press, Txt } from "@/ui/kit";

const pad = (n: number) => String(n).padStart(2, "0");
/** "14.11 14:58" (Toshkent) */
const when = (iso: string) => {
  const local = toTashkent(new Date(iso));
  return `${pad(local.date.getUTCDate())}.${pad(local.date.getUTCMonth() + 1)} ${formatMinute(local.minute)}`;
};

/**
 * Bildirishnomalar — saytdagi `/bildirishnomalar` (`Inbox`): "← Orqaga", sarlavha, ro'yxat (yangilari qora chegara va
 * to'q sariq nuqta bilan). Saytdagidek ochilganda hammasi o'qilgan bo'ladi (belgilar shu ochilishda qoladi). Bosilgan
 * xabar havolasi ochiladi (chegirma → tafsilot, kategoriya → lenta). Push — ilovada Expo orqali (saytdagi yoqish bloki yo'q).
 */
export default function Notifications() {
  const n = copy.notifications;
  const insets = useSafeAreaInsets();
  const student = useApp().me?.role === "STUDENT";
  const inbox = useLoad(useCallback(() => appApi.notifications(), []), true, "notifications");
  const marked = useRef(false);
  const unread = inbox.data?.unread ?? 0;

  useEffect(() => {
    if (!inbox.data || marked.current) return;
    marked.current = true;
    if (unread > 0) void appApi.markRead().catch(() => undefined);
    void syncBadge(0);
  }, [inbox.data, unread]);

  const open = (item: InboxItem) => {
    if (!student) return;
    if (item.link.type === "DISCOUNT" && item.link.id) router.push(`/deal/${item.link.id}`);
    else if (item.link.type === "CATEGORY" && item.link.id) router.navigate(`/deals?category=${encodeURIComponent(item.link.id)}`);
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace(student ? "/deals" : "/panel/profile"));
  const items = inbox.data?.items ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 48 }]}
      refreshControl={<RefreshControl refreshing={inbox.refreshing} onRefresh={() => void inbox.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
    >
      <Press onPress={back} accessibilityRole="link" scale={0.98} style={{ alignSelf: "flex-start" }}>
        <Txt style={[font(700), { fontSize: 14, lineHeight: 20 }]}>{`← ${copy.back}`}</Txt>
      </Press>
      <Txt accessibilityRole="header" style={[font(900, 112), styles.title]}>
        {n.title}
      </Txt>
      {inbox.loading && !inbox.data ? (
        <Loading />
      ) : inbox.error && !inbox.data ? (
        <Failed error={inbox.error} onRetry={() => void inbox.reload()} />
      ) : items.length === 0 ? (
        <Txt style={styles.empty}>{n.empty}</Txt>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((item) => (
            <Press
              key={item.id}
              onPress={() => open(item)}
              accessibilityRole="link"
              accessibilityLabel={`${item.unread ? `${n.unread}. ` : ""}${item.title}. ${item.body}`}
              scale={0.99}
              style={[styles.item, { borderColor: item.unread ? colors.ink : colors.line }]}
            >
              <View style={styles.head}>
                <Txt style={[font(800), { fontSize: 15, flexShrink: 1 }]}>
                  {item.unread ? <Txt style={styles.dot}>{"● "}</Txt> : null}
                  {item.title}
                </Txt>
                <Txt style={[mono(), { fontSize: 12, color: colors.muted }]}>{when(item.at)}</Txt>
              </View>
              <Txt style={styles.body}>{item.body}</Txt>
            </Press>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 16, gap: 14 },
  title: { fontSize: 36, lineHeight: 36, letterSpacing: em(36, -0.035) },
  empty: { borderRadius: 16, backgroundColor: colors.white, padding: 20, fontSize: 14, color: colors.muted },
  item: { borderRadius: 16, borderWidth: 1.5, backgroundColor: colors.white, padding: 16 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  dot: { fontSize: 11, color: colors.orange },
  // saytda leading-[1.4]
  body: { marginTop: 4, fontSize: 14, lineHeight: 19.6, color: colors.muted },
});
