import type { ReactNode } from "react";

/**
 * Talaba ilovasida har o'tishda sahifa 8px pastdan 220ms da ko'tariladi (template har navigatsiyada qayta o'rnatiladi;
 * faqat URL parametri o'zgarsa — filtr, oy — qayta o'ynamaydi). Animatsiya tugagach transform qolmaydi (`backwards`),
 * shuning uchun ichkaridagi `fixed`/`sticky` elementlar buzilmaydi. Reduced-motion — faqat shaffoflik.
 */
export default function StudentTemplate({ children }: { children: ReactNode }) {
  return <div className="enter-page">{children}</div>;
}
