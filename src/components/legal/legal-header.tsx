// Manba: design/screens/W3.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function LegalHeader() {
  const t = useTranslations("legal.header");
  return (
    <header style={{ borderBottom: "1.5px solid var(--color-ink)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 4cqw, 48px)", height: "72px", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontStretch: "125%", fontSize: "20px", letterSpacing: "-0.02em", textDecoration: "none", color: "var(--color-ink)" }}>
          talaba
          <span style={{ background: "var(--color-blue)", color: "var(--color-white)", padding: "2px 8px 3px", borderRadius: "6px", fontSize: "17px" }}>
            Pass
          </span>
        </Link>
        <Link className="tp-link" href="/" style={{ marginLeft: "auto", height: "44px", padding: "0 14px", display: "flex", alignItems: "center", gap: "8px", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "15px" }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {t("bosh_sahifa")}
        </Link>
        <Link className="tp-btn tp-stamp [--tp-shadow:var(--color-orange)]" href="/kirish" style={{ height: "44px", padding: "0 16px", borderRadius: "12px", display: "flex", alignItems: "center", color: "var(--color-white)", background: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "15px" }}>
          {t("kirish")}
        </Link>
      </div>
    </header>
  );
}
