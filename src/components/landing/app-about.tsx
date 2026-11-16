// /ilova — mobil ilova haqida (brauzer uchun). Dizaynda chizilmagan: W3 huquqiy sahifa uslubida (sarlavha, footer, kartalar).
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icons";
import { LegalFooter } from "@/components/legal/legal-footer";
import { LegalHeader } from "@/components/legal/legal-header";
import { Link } from "@/i18n/navigation";

const FEATURE_ICONS: IconName[] = ["map", "qr", "bell", "scan"];

const card = { background: "var(--color-white)", border: "1.5px solid var(--color-line)", borderRadius: "18px", padding: "clamp(18px, 3cqw, 28px)" } as const;
const h2 = { margin: "0 0 14px", fontSize: "clamp(24px, 3.4cqw, 32px)", fontWeight: 900, fontStretch: "110%", letterSpacing: "-0.03em", lineHeight: 1 } as const;

export function AppAbout() {
  const t = useTranslations("appPage");
  const features = t.raw("features") as { title: string; text: string }[];
  const stores = [t("appStore"), t("googlePlay")];

  return (
    <div className="dz" style={{ containerType: "inline-size", background: "var(--color-paper)", fontFamily: "var(--font-sans)", color: "var(--color-ink)", minHeight: "100dvh" }}>
      <LegalHeader />
      <main style={{ maxWidth: "1080px", margin: "0 auto", padding: "clamp(28px, 6cqw, 64px) clamp(16px, 4cqw, 48px)", display: "grid", gap: "clamp(28px, 5cqw, 48px)" }}>
        <section style={{ display: "grid", gap: "16px", maxWidth: "720px" }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--color-blue)" }}>{t("eyebrow")}</p>
          <h1 style={{ margin: 0, fontSize: "clamp(40px, 8cqw, 76px)", fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.045em", lineHeight: 0.92 }}>{t("title")}</h1>
          <p style={{ margin: 0, fontSize: "clamp(16px, 1.8cqw, 19px)", lineHeight: 1.5, color: "var(--color-ink-5)" }}>{t("lead")}</p>
          <ul aria-label={t("storesLabel")} style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {stores.map((store) => (
              <li key={store}>
                {/* Do'konda hali yo'q — havola emas, faqat holat */}
                <span aria-label={t("storeSoon", { store })} style={{ height: "58px", padding: "0 20px 0 16px", borderRadius: "16px", background: "var(--color-ink)", color: "var(--color-white)", display: "flex", alignItems: "center", gap: "12px", boxSizing: "border-box" }}>
                  <Icon name="download" size={22} strokeWidth={2.2} />
                  <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-fog-1)" }}>{t("soon")}</span>
                    <span style={{ fontSize: "18px", fontWeight: 800 }}>{store}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 style={h2}>{t("featuresTitle")}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "12px" }}>
            {features.map((f, i) => (
              <li key={f.title} style={{ ...card, display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ color: "var(--color-blue)" }}>
                  <Icon name={FEATURE_ICONS[i] ?? "ticket"} size={28} />
                </span>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.5, color: "var(--color-muted)" }}>{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ ...card, display: "grid", gap: "14px" }}>
          <h2 style={{ ...h2, margin: 0 }}>{t("webTitle")}</h2>
          <p style={{ margin: 0, fontSize: "16px", lineHeight: 1.55, maxWidth: "640px" }}>{t("webText")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px" }}>
            <Link className="tp-btn tp-stamp" href="/talaba/royxat" style={{ height: "52px", padding: "0 22px", borderRadius: "14px", background: "var(--color-blue)", color: "var(--color-white)", display: "flex", alignItems: "center", textDecoration: "none", fontWeight: 800, fontSize: "16px", boxSizing: "border-box" }}>
              {t("student")}
            </Link>
            <Link className="tp-btn tp-stamp" href="/biznes/royxat" style={{ height: "52px", padding: "0 22px", borderRadius: "14px", background: "var(--color-orange)", color: "var(--color-ink)", display: "flex", alignItems: "center", textDecoration: "none", fontWeight: 800, fontSize: "16px", boxSizing: "border-box" }}>
              {t("business")}
            </Link>
          </div>
        </section>
      </main>
      <LegalFooter />
    </div>
  );
}
