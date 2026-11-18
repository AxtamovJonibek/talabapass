import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { bizApi } from "@/api/business";
import { copy } from "@/copy";
import { useLoad } from "@/lib/use-load";
import { BlockHead, DiscountList } from "@/site/business";
import { colors } from "@/theme";
import { Failed, Loading } from "@/ui/app";
import { StaleNote } from "@/ui/offline";

/**
 * Chegirmalar — saytdagi `/biznes/chegirmalar` telefon ko'rinishi (B5 bloki alohida sahifa): sarlavha va "+ Yangi",
 * ro'yxat (yorliq, nom, jadval, bugungi sotuv, faol/to'xtatilgan kaliti — tekshiruvsiz). Qator bosilsa — muharrir.
 */
export default function Discounts() {
  const d = copy.biz.discounts;
  const insets = useSafeAreaInsets();
  const list = useLoad(useCallback(() => bizApi.discounts(), []), true, "biz.discounts");
  const { refresh } = list;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 40 }}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={colors.orange} />}
    >
      <View style={styles.head}>
        <BlockHead title={d.title} action={d.addShort} onAction={() => router.push("/biz/discount/new")} />
      </View>
      <View style={styles.body}>
        <StaleNote at={list.staleAt} />
        {list.data ? (
          <DiscountList discounts={list.data.discounts} onChange={(next) => list.setData(() => ({ discounts: next }))} />
        ) : list.loading ? (
          <Loading />
        ) : (
          <Failed error={list.error ?? copy.unknownError} onRetry={() => void list.reload()} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { paddingHorizontal: 16, paddingTop: 18 },
  body: { marginHorizontal: 16, marginBottom: 20, gap: 8 },
});
