// Manba: design/screens/W3.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function LegalFooter() {
  const t = useTranslations("legal.footer");
  return (
    <footer style={{ background: "var(--color-ink)", color: "var(--color-fog-3)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px clamp(16px, 4cqw, 48px)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "12px", fontSize: "14px" }}>
        <span>{t("2026_talabapass")}</span>
        <span style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/" style={{ color: "var(--color-fog-1)", textDecoration: "none" }}>{t("bosh_sahifa")}</Link>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/talaba/royxat" style={{ color: "var(--color-fog-1)", textDecoration: "none" }}>
            {t("talabalarga")}
          </Link>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/biznes/royxat" style={{ color: "var(--color-fog-1)", textDecoration: "none" }}>
            {t("bizneslarga")}
          </Link>
        </span>
      </div>
    </footer>
  );
}
