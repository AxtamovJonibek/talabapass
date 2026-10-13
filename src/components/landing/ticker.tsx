// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";

export function Ticker() {
  const t = useTranslations("landing.ticker");
  return (
    <div aria-hidden="true" style={{ background: "var(--color-ink)", color: "var(--color-paper)", borderBlock: "1.5px solid var(--color-ink)", overflow: "hidden", whiteSpace: "nowrap", padding: "16px 0", fontWeight: 900, fontStretch: "75%", fontSize: "clamp(22px, 2.6cqw, 34px)", letterSpacing: "0.01em" }}>
      <span style={{ display: "inline-flex", gap: "28px", alignItems: "center", paddingLeft: "20px" }}>
        <span>{t("osh_30")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("kapuchino_25")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("kino_25_000")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("nusxa_300_som")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("soch_olish_33")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("lavash_1_1")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("kitoblar_15")}</span>
        <span style={{ color: "var(--color-orange)" }}>✶</span>
        <span>{t("sport_zal_36")}</span>
      </span>
    </div>
  );
}
