/** Landing'dagi "Raqamlarda" bo'limi: kichik raqamlar ishonch o'rniga shubha uyg'otadi — chegaradan past bo'lsa bo'lim chiqmaydi. */
export type LandingStats = { students: number; businesses: number; discounts: number; savedToday: number };

export const STATS_MIN: LandingStats = { students: 100, businesses: 5, discounts: 5, savedToday: 100_000 };

export function statsVisible(stats: LandingStats, min: LandingStats = STATS_MIN): boolean {
  return (Object.keys(min) as (keyof LandingStats)[]).every((key) => stats[key] >= min[key]);
}
