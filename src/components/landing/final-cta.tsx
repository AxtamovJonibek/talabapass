// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function FinalCta() {
  const t = useTranslations("landing.cta");
  return (
    <section style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(64px, 9cqw, 140px) clamp(16px, 4cqw, 48px)" }}>
      <div style={{ background: "var(--color-orange)", borderRadius: "28px", padding: "clamp(28px, 5cqw, 64px)", position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: "0", right: "0", top: "50%", borderTop: "2px dashed var(--color-ink)", opacity: 0.25 }} />
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "24px" }}>
          <h2 style={{ margin: "0", fontSize: "clamp(40px, 6cqw, 88px)", lineHeight: 0.92, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.045em", maxWidth: "760px" }}>
            {t("bugungi_chegirmang_seni_kutyapti")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "min(300px, 100%)" }}>
            <Link href="/talaba/royxat" style={{ height: "58px", padding: "0 22px", borderRadius: "16px", background: "var(--color-ink)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textDecoration: "none", fontWeight: 800, fontSize: "17px" }}>
              {t("talaba_sifatida_boshlash")}
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link href="/biznes/royxat" style={{ height: "58px", padding: "0 22px", borderRadius: "16px", background: "var(--color-white)", color: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textDecoration: "none", fontWeight: 800, fontSize: "17px" }}>
              {t("biznesni_ulash")}
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
