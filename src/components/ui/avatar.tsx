import type { ReactNode } from "react";

/**
 * Profil rasmi (talaba avatari, biznes logotipi) yoki zaxira — bosh harflar.
 * Ota element o'lcham, radius va fonni beradi; rasm uni to'ldiradi.
 */
export function PhotoOr({ src, children }: { src?: string | null; children: ReactNode }) {
  // eslint-disable-next-line @next/next/no-img-element -- himoyalangan API manzili (versiyali), next/image kerak emas
  return src ? <img src={src} alt="" className="size-full rounded-[inherit] object-cover" /> : children;
}
