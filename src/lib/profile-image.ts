/** Profil rasmlari (talaba avatari, biznes logotipi): manzillar va qoidalar — server va klient uchun umumiy. */

/** Kesilgan rasm tomoni (px). Mijoz shu o'lchamda kvadrat JPEG yuboradi. */
export const AVATAR_SIZE = 512;

/** Saqlash kalitidan o'zgarmas versiya (rasm almashsa manzil ham almashadi — brauzer keshi eskirmaydi). */
const versionOf = (key: string) => (key.split("/").pop() ?? "").replace(/^logo-/, "").replace(/\.\w+$/, "").slice(0, 8);

export const studentAvatarUrl = (userId: string, key: string | null | undefined): string | null =>
  key ? `/api/avatar/${userId}?v=${versionOf(key)}` : null;

export const businessLogoUrl = (businessId: string, key: string | null | undefined): string | null =>
  key ? `/api/biznes/logo/${businessId}?v=${versionOf(key)}` : null;
