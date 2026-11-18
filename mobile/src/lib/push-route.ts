import type { Href } from "expo-router";
import type { Me } from "@/api/endpoints";

/**
 * Push `data.url` (saytdagi yo'l, `/uz` prefiksi bilan yoki usiz) → ilova ekrani. Server yo'llari:
 * `/chegirmalar[/<id>|?kategoriya=]` (admin xabari, guvohnoma qarori), `/tarix?chek=<id>` (sotuv tasdiqlandi),
 * `/buyurtmalar/<id>` (talaba buyurtmasi — ilovada ekrani yo'q), `/biznes[/buyurtmalar]` (biznes qarori, buyurtmalar).
 * `null` — holatga qarab o'z bosh ekrani (`routeFor`, tasdiq/rad xabarlaridan keyin `me` yangilanadi).
 */
export function pushRoute(url: string | null, me: Me): Href | null {
  if (!url) return "/notifications";
  let parsed: URL;
  try {
    parsed = new URL(url, "https://talabapass.uz");
  } catch {
    return "/notifications";
  }
  const path = parsed.pathname.replace(/^\/uz(?=\/|$)/, "") || "/";
  const q = parsed.searchParams;
  const student = me.role === "STUDENT";
  const owner = me.role === "BUSINESS_OWNER";

  if (student) {
    const deal = /^\/chegirmalar\/([a-z0-9_]{10,40})$/.exec(path);
    if (deal) return `/deal/${deal[1]}`;
    if (path === "/chegirmalar") return q.get("kategoriya") ? `/deals?category=${encodeURIComponent(q.get("kategoriya")!)}` : null;
    if (path === "/tarix" && q.get("chek")) return `/receipt/${encodeURIComponent(q.get("chek")!)}`;
    return "/notifications";
  }
  if (owner && path === "/biznes/buyurtmalar") return "/panel/orders";
  if (path.startsWith("/biznes")) return null;
  return owner ? "/notifications" : null;
}
