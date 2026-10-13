// Manba: design/screens/W3.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS, type LegalDoc } from "./docs";

export function LegalIntro({ doc }: { doc: LegalDoc }) {
  const t = useTranslations("legal.intro");
  const tabs = useTranslations("legal.tabs");
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(32px, 5cqw, 64px) clamp(16px, 4cqw, 48px) 0" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-muted)" }}>
        {t("oxirgi_yangilanish_13_10")}
      </div>
      <h1 style={{ margin: "10px 0 0", fontSize: "clamp(40px, 6cqw, 80px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em" }}>
        {t("huquqiy_malumotlar")}
      </h1>
      <p style={{ margin: "14px 0 0", fontSize: "18px", color: "var(--color-ink-5)", maxWidth: "640px", lineHeight: 1.5 }}>
        {t("qisqasi_guvohnomangiz_faqat_tekshiruv")}
      </p>
      <div role="tablist" aria-label={t("hujjat")} style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {LEGAL_DOCS.map((id) => {
          const on = id === doc;
          return (
            <Link key={id} href={`/huquqiy/${id}`} role="tab" aria-selected={on} style={{ height: "46px", padding: "0 18px", borderRadius: "23px", border: "1.5px solid var(--color-ink)", background: on ? "var(--color-ink)" : "var(--color-white)", color: on ? "var(--color-white)" : "var(--color-ink)", display: "flex", alignItems: "center", textDecoration: "none", boxSizing: "border-box", fontFamily: "inherit", fontSize: "15px", fontWeight: 700 }}>
              {tabs(id)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
