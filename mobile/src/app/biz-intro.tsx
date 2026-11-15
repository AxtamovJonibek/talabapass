import { router } from "expo-router";
import { copy } from "@/copy";
import { markOnboarded } from "@/storage";
import { Carousel } from "@/ui/carousel";
import { GrowthArt, ScannerArt } from "@/ui/intro-art";

const ART = [GrowthArt, ScannerArt];
const TONES = ["blue", "orange"] as const;

/** Biznes karuseli (Biz1, Biz2) — "Biznes egasimisiz?" dan, bir marta. */
export default function BizIntro() {
  const finish = async () => {
    await markOnboarded("business");
    router.replace("/auth/phone?intent=business");
  };
  return (
    <Carousel
      kind="business"
      slides={copy.bizIntro.slides.map((s, i) => ({ ...s, tone: TONES[i]!, Art: ART[i]! }))}
      onFinish={() => void finish()}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/auth/phone?intent=student"))}
    />
  );
}
