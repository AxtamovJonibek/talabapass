/**
 * Interaktiv primitivlar (chip, tanlov tugmasi, ochiladigan ro'yxat) uchun umumiy hover/bosish harakati —
 * design/Tugmalar bilan bir xil egri va qadam: hover'da 2px ko'tarilish va yumshoq soya, bosganda 0.96.
 * `hover:` Tailwind'da faqat sichqonchali qurilmada ishlaydi; `prefers-reduced-motion` globals.css da.
 */
export const LIFT =
  "transition-[translate,scale,box-shadow,background-color,color,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-chip-hover active:translate-y-0 active:scale-[0.96] active:shadow-none";

/** Guruh ichidagi bo'lak (segment, ko'rinish almashtirgich): ko'tarilmaydi, faqat bosilganda siqiladi. */
export const PRESS =
  "transition-[scale,background-color,color] duration-150 ease-out active:scale-[0.96]";
