// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";

export function ForStudents() {
  const t = useTranslations("landing.students");
  return (
    <section id="talabalar" style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(64px, 9cqw, 140px) clamp(16px, 4cqw, 48px) 0", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5cqw, 72px)", alignItems: "center" }}>
      <div style={{ flex: "1 1 360px", minWidth: "0", order: 2 }}>
        <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--color-blue)" }}>
          {t("talabalarga")}
        </div>
        <h2 style={{ margin: "12px 0 0", fontSize: "clamp(36px, 5cqw, 68px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em" }}>
          {t("stipendiya_oy_oxirigacha_yetsin")}
        </h2>
        <p style={{ margin: "18px 0 0", fontSize: "18px", color: "var(--color-ink-5)", lineHeight: 1.55, maxWidth: "520px" }}>
          {t("har_kuni_ishlatadigan_narsalaring")}
        </p>
        <ul style={{ listStyle: "none", margin: "28px 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "22px 28px" }}>
          <li style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2433D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <b style={{ fontSize: "18px" }}>{t("yoningdagi_chegirmalar")}</b>
            <span style={{ fontSize: "15px", color: "var(--color-muted)", lineHeight: 1.5 }}>
              {t("xarita_va_masofa_bilan")}
            </span>
          </li>
          <li style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2433D6" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <b style={{ fontSize: "18px" }}>{t("vaqtini_bilib_tur")}</b>
            <span style={{ fontSize: "15px", color: "var(--color-muted)", lineHeight: 1.5 }}>
              {t("qaysi_chegirma_hozir_ishlayapti")}
            </span>
          </li>
          <li style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2433D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
            </svg>
            <b style={{ fontSize: "18px" }}>{t("tejaganing_hisoblanadi")}</b>
            <span style={{ fontSize: "15px", color: "var(--color-muted)", lineHeight: 1.5 }}>
              {t("har_bir_xarid_chek")}
            </span>
          </li>
          <li style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2433D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <b style={{ fontSize: "18px" }}>{t("faqat_talabalar_uchun")}</b>
            <span style={{ fontSize: "15px", color: "var(--color-muted)", lineHeight: 1.5 }}>
              {t("har_bir_foydalanuvchi_guvohnomasi")}
            </span>
          </li>
        </ul>
      </div>
      <div role="img" aria-label={t("oylik_tejash_cheki")} style={{ flex: "1 1 360px", minWidth: "0", order: 1, display: "flex", justifyContent: "center", position: "relative", padding: "20px 0" }}>
        <div style={{ width: "340px", maxWidth: "100%", transform: "rotate(-3deg)" }}>
          <div style={{ background: "var(--color-white)", borderRadius: "16px 16px 0 0", padding: "24px 22px 18px", fontFamily: "var(--font-mono)", fontSize: "14px", display: "flex", flexDirection: "column", gap: "9px", boxShadow: "0 30px 50px -30px rgba(20,20,20,0.5)" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-muted)" }}>
              {t("dilnoza_tatu_oktabr")}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "40px", fontWeight: 900, fontStretch: "85%", letterSpacing: "-0.02em" }}>
              {t("206_400_som")}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--color-green)", fontWeight: 700, marginTop: "-4px" }}>
              {t("tejaldi_5_xarid")}
            </div>
            <div style={{ borderTop: "1.5px dashed var(--color-dash)", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t("forma_fitnes")}</span>
              <span style={{ color: "var(--color-rust)" }}>−160 000</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t("kadr_kinoteatri")}</span>
              <span style={{ color: "var(--color-rust)" }}>−20 000</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t("bodom_choyxonasi")}</span>
              <span style={{ color: "var(--color-rust)" }}>−11 400</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t("nusxa_markazi")}</span>
              <span style={{ color: "var(--color-rust)" }}>−8 000</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t("qahva_bekati")}</span>
              <span style={{ color: "var(--color-rust)" }}>−7 000</span>
            </div>
          </div>
          <div aria-hidden="true" style={{ height: "12px", background: "linear-gradient(-45deg, transparent 7px, var(--color-white) 0) 0 0 / 14px 12px repeat-x, linear-gradient(45deg, transparent 7px, var(--color-white) 0) 0 0 / 14px 12px repeat-x" }} />
        </div>
        <div aria-hidden="true" style={{ position: "absolute", right: "max(0px, calc(50% - 210px))", top: "0", width: "92px", height: "92px", borderRadius: "46px", background: "var(--color-blue)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 900, fontStretch: "75%", fontSize: "17px", lineHeight: 1, transform: "rotate(12deg)" }}>
          {t("faqat")}
          <br />
          {t("talaba")}
        </div>
      </div>
    </section>
  );
}
