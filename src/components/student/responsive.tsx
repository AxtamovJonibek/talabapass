import type { ReactNode } from "react";

/**
 * Talaba ro'yxati qadamlari ikki xil chizilgan: telefon uchun T1–T3, veb uchun WT1.
 * 700px dan tor joyda telefon ko'rinishi, kengroqda veb ko'rinishi chiqadi (ikkalasi ham DOM'da, bittasi yashirin).
 * Tashqi element `@container` — ichkaridagi cqw o'lchamlari shunga tayanadi.
 */
export function PhoneOrWeb({ phone, web }: { phone: ReactNode; web: ReactNode }) {
  return (
    <div className="@container">
      <div className="@min-[700px]:hidden">{phone}</div>
      <div className="hidden @min-[700px]:block">{web}</div>
    </div>
  );
}
