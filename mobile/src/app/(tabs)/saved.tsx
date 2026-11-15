import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { appApi, type FeedDeal } from "@/api/endpoints";
import { copy } from "@/copy";
import { useLocation } from "@/lib/location";
import { useLoad } from "@/lib/use-load";
import { colors } from "@/theme";
import { DealCard, Empty, Failed, Loading, ScreenHeader, TabScreen } from "@/ui/app";
import { Lead } from "@/ui/kit";

/** Saralanganlar (`GET /saved`): saqlangan chegirmalar (hozir ko'rinadiganlari), oxirgi saqlangani oldin. Fokusda yangilanadi. */
export default function Saved() {
  const s = copy.saved;
  const { origin, ready } = useLocation();
  const saved = useLoad(useCallback(() => appApi.saved(origin), [origin]), ready);
  const [now, setNow] = useState(() => new Date());

  const { refresh } = saved;
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void refresh();
    }, [refresh]),
  );

  return (
    <TabScreen>
      <FlatList<FeedDeal>
        data={saved.data?.deals ?? []}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <DealCard deal={item} now={now} onPress={() => router.push(`/deal/${item.id}`)} />
          </View>
        )}
        ListHeaderComponent={
          <View>
            <ScreenHeader title={s.title} />
            <Lead text={s.lead} size={15} style={styles.lead} />
          </View>
        }
        ListEmptyComponent={
          saved.loading ? (
            <Loading />
          ) : saved.error ? (
            <Failed error={saved.error} onRetry={() => void saved.reload()} style={styles.pad} />
          ) : (
            <Empty icon="bookmark" title={s.empty} text={s.emptyText} action={{ label: copy.coupon.toDeals, onPress: () => router.navigate("/deals") }} style={styles.pad} />
          )
        }
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={saved.refreshing} onRefresh={() => void saved.reload()} tintColor={colors.blue} colors={[colors.blue]} />}
      />
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  lead: { paddingHorizontal: 24, marginTop: 8, marginBottom: 6 },
  pad: { paddingHorizontal: 24 },
  item: { paddingHorizontal: 24, paddingTop: 10 },
});
