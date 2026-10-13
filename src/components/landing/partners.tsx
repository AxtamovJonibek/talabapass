// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";

// TODO(7-bosqich): hamkorlar faqat bazadagi tasdiqlangan (APPROVED) bizneslardan, universitetlar esa talabasi bor
// oliygohlardan chiqadi. Hozir — dizayndagi statik belgilar.
export function Partners() {
  const t = useTranslations("landing.partners");
  return (
    <section id="hamkorlar" style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(56px, 8cqw, 120px) clamp(16px, 4cqw, 48px) 0" }}>
      <h2 style={{ margin: "0", fontSize: "clamp(36px, 5cqw, 68px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em" }}>
        {t("hamkorlarimiz")}
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: "17px", color: "var(--color-muted)", maxWidth: "540px", lineHeight: 1.5 }}>
        {t("choyxonadan_sport_zalgacha_talabalarni")}
      </p>
      <div style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", borderTop: "1.5px solid var(--color-ink)", borderLeft: "1.5px solid var(--color-ink)" }}>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontStretch: "125%", fontSize: "22px", letterSpacing: "-0.03em" }}>
          {t("bodom")}
          <span style={{ color: "var(--color-rust)" }}>.</span>
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontStyle: "italic", fontWeight: 600, fontSize: "24px", letterSpacing: "-0.02em" }}>
          {t("qahva_bekati")}
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontStretch: "62%", fontSize: "34px", letterSpacing: "0.04em" }}>
          {t("kadr")}
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontWeight: 800, fontSize: "20px" }}>
          <span style={{ width: "22px", height: "22px", borderRadius: "11px", border: "5px solid var(--color-ink)", boxSizing: "border-box" }} />
          {t("forma_fitnes")}
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "20px" }}>
          {t("sahifa_kitob")}
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontStretch: "100%", fontSize: "21px" }}>
          {t("nusxa")}
          <span style={{ background: "var(--color-ink)", color: "var(--color-paper)", padding: "0 5px", marginLeft: "4px", borderRadius: "4px" }}>
            {t("m")}
          </span>
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontStretch: "125%", fontSize: "18px", letterSpacing: "0.12em" }}>
          {t("usta_barber")}
        </div>
        <div style={{ height: "110px", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "22px", fontStyle: "italic" }}>
          {t("lavash")}
          <span style={{ color: "var(--color-rust)" }}>{t("point")}</span>
        </div>
      </div>
      <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <span style={{ fontSize: "14px", color: "var(--color-muted)", marginRight: "6px" }}>
          {t("talabalarimiz_oqiydigan_oliygohlar")}
        </span>
        <span style={{ height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 }}>
          {t("tatu")}
        </span>
        <span style={{ height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 }}>
          {t("ozmu")}
        </span>
        <span style={{ height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 }}>
          {t("tdiu")}
        </span>
        <span style={{ height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 }}>
          {t("tdyu")}
        </span>
        <span style={{ height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 }}>
          {t("westminster")}
        </span>
        <span style={{ height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 }}>
          {t("inha")}
        </span>
      </div>
    </section>
  );
}
