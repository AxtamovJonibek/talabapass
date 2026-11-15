import { copy } from "@/copy";
import { resetTo } from "@/state";
import { markOnboarded } from "@/storage";
import { Carousel } from "@/ui/carousel";
import { CardArt, MainArt, NearArt, QrArt } from "@/ui/intro-art";

const ART = [MainArt, CardArt, QrArt, NearArt];
const TONES = ["orange", "green", "orange", "blue"] as const;

/** Talaba karuseli (Main, Slide2–4) — faqat birinchi ochilishda. */
export default function Intro() {
  const finish = async () => {
    await markOnboarded("student");
    resetTo("/auth/phone?intent=student");
  };
  return (
    <Carousel
      kind="student"
      slides={copy.intro.slides.map((s, i) => ({ ...s, tone: TONES[i]!, Art: ART[i]! }))}
      onFinish={() => void finish()}
    />
  );
}
