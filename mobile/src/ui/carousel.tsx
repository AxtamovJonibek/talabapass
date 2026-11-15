import { useRef, useState, type ComponentType } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from "react-native";
import { copy } from "@/copy";
import { BackArrow, Dots, Lead, Logo, PrimaryButton, RoleChip, Screen, SkipLink, Title, TopBar, type HighlightTone } from "./kit";

type Slide = { title: string; lead: string; tone: HighlightTone; Art: ComponentType };

/**
 * Tanishtiruv karuseli (Main, Slide2–4 / Biz1–2): yuqori qator, nuqtalar va tugma joyida, o'rtadagi rasm + matn
 * barmoq bilan suriladi. Oxirgi slaydda tugma — "Boshlash" (biznesda to'q sariq "Biznes sifatida boshlash").
 */
export function Carousel({ kind, slides, onFinish, onBack }: { kind: "student" | "business"; slides: Slide[]; onFinish: () => void; onBack?: () => void }) {
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  const goTo = (i: number) => {
    ref.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  return (
    <Screen scroll={false} bleed>
      <TopBar style={styles.pad}>
        {kind === "business" ? (
          <>
            <BackArrow label={copy.back} onPress={onBack ?? onFinish} />
            <RoleChip tone="business">{copy.forBusiness}</RoleChip>
          </>
        ) : (
          <Logo size="lg" />
        )}
        <SkipLink onPress={onFinish}>{copy.skip}</SkipLink>
      </TopBar>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
      >
        {slides.map(({ title, lead, tone, Art }, i) => (
          <View key={i} style={[styles.page, { width }]} accessibilityLabel={`${i + 1}/${slides.length}`}>
            <Art />
            <Title text={title} size={40} loose tone={tone} />
            <Lead text={lead} style={styles.lead} />
          </View>
        ))}
      </ScrollView>

      <View style={styles.pad}>
        <View style={styles.dots}>
          <Dots total={slides.length} current={index} />
        </View>
        <PrimaryButton tone={kind === "business" && last ? "orange" : "blue"} onPress={() => (last ? onFinish() : goTo(index + 1))}>
          {last ? (kind === "business" ? copy.bizIntro.start : copy.start) : copy.next}
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 24 },
  pager: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 24 },
  lead: { marginTop: 14, marginBottom: 22 },
  dots: { marginBottom: 20 },
});
