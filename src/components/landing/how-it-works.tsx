// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";

export function HowItWorks() {
  const t = useTranslations("landing.how");
  return (
    <section id="qanday" style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(56px, 8cqw, 120px) clamp(16px, 4cqw, 48px) 0" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
        <h2 style={{ margin: "0", fontSize: "clamp(36px, 5cqw, 68px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em", maxWidth: "640px" }}>
          {t("uch_qadam")}
          <br />
          {t("hammasi_shu")}
        </h2>
        <p style={{ margin: "0", fontSize: "17px", color: "var(--color-muted)", maxWidth: "380px", lineHeight: 1.5 }}>
          {t("plastik_karta_qogoz_kupon")}
        </p>
      </div>
      <ol style={{ listStyle: "none", margin: "40px 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "12px" }}>
        <li style={{ background: "var(--color-white)", borderRadius: "22px", padding: "26px", position: "relative", overflow: "hidden", minHeight: "230px", boxSizing: "border-box" }}>
          <div style={{ fontSize: "120px", lineHeight: 0.8, fontWeight: 900, fontStretch: "62%", color: "var(--color-blue)" }}>
            1
          </div>
          <h3 style={{ margin: "22px 0 0", fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {t("royxatdan_ot")}
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: "16px", color: "var(--color-muted)", lineHeight: 1.5 }}>
            {t("ism_familiya_va_universitet")}
          </p>
        </li>
        <li style={{ background: "var(--color-white)", borderRadius: "22px", padding: "26px", position: "relative", overflow: "hidden", minHeight: "230px", boxSizing: "border-box" }}>
          <div style={{ fontSize: "120px", lineHeight: 0.8, fontWeight: 900, fontStretch: "62%", color: "var(--color-blue)" }}>
            2
          </div>
          <h3 style={{ margin: "22px 0 0", fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {t("guvohnomani_tasdiqlat")}
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: "16px", color: "var(--color-muted)", lineHeight: 1.5 }}>
            {t("rasmga_ol_yoki_fayl")}
          </p>
          <div aria-hidden="true" style={{ position: "absolute", right: "18px", top: "26px", transform: "rotate(-10deg)", border: "3px solid var(--color-green)", color: "var(--color-green)", borderRadius: "8px", padding: "4px 10px", fontWeight: 900, fontStretch: "75%", fontSize: "20px", letterSpacing: "0.06em" }}>
            {t("tasdiqlandi")}
          </div>
        </li>
        <li style={{ background: "var(--color-blue)", color: "var(--color-white)", borderRadius: "22px", padding: "26px", position: "relative", overflow: "hidden", minHeight: "230px", boxSizing: "border-box" }}>
          <div style={{ fontSize: "120px", lineHeight: 0.8, fontWeight: 900, fontStretch: "62%", color: "var(--color-orange)" }}>
            3
          </div>
          <h3 style={{ margin: "22px 0 0", fontSize: "24px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {t("qr_korsat_teja")}
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: "16px", color: "var(--color-blue-tint)", lineHeight: 1.5 }}>
            {t("chegirmani_tanla_kassada_qr")}
          </p>
        </li>
      </ol>
    </section>
  );
}
