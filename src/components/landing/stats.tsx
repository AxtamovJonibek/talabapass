// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { formatMln, formatSom } from "@/lib/format";
import { statsVisible, type LandingStats } from "@/lib/landing";

/** Raqamlar bazadan (`landingStats`); `STATS_MIN` dan kichik bo'lsa bo'lim umuman chiqmaydi. */
export function Stats({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing.stats");
  if (!statsVisible(stats)) return null;
  return (
    <section aria-label={t("raqamlarda")} style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(56px, 8cqw, 110px) clamp(16px, 4cqw, 48px) 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "12px" }}>
        <div style={{ borderTop: "3px solid var(--color-ink)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95 }}>
            {formatSom(stats.students)}
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("tasdiqlangan_talaba")}
          </div>
        </div>
        <div style={{ borderTop: "3px solid var(--color-ink)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95 }}>
            {formatSom(stats.businesses)}
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("hamkor_biznes")}
          </div>
        </div>
        <div style={{ borderTop: "3px solid var(--color-ink)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95 }}>
            {formatSom(stats.discounts)}
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("faol_chegirma")}
          </div>
        </div>
        <div style={{ borderTop: "3px solid var(--color-orange)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95, color: "var(--color-rust)" }}>
            {formatMln(stats.savedToday)}
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("som_bugun_talabalar_tejadi")}
          </div>
        </div>
      </div>
    </section>
  );
}
