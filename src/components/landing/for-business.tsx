// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const HOUR_VALUES = [5, 7, 4, 2, 12, 13, 9, 3, 2, 1];
const hours = HOUR_VALUES.map((v, i) => ({ h: `${(v / 13) * 100}%`, c: i === 6 ? "var(--color-orange)" : "var(--color-ink)" }));

export function ForBusiness() {
  const t = useTranslations("landing.business");
  return (
    <section id="biznes" style={{ marginTop: "clamp(64px, 9cqw, 140px)", background: "var(--color-ink)", color: "var(--color-paper)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(56px, 8cqw, 120px) clamp(16px, 4cqw, 48px)", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5cqw, 72px)", alignItems: "center" }}>
        <div style={{ flex: "1 1 420px", minWidth: "0" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--color-orange)" }}>
            {t("biznes_egalariga")}
          </div>
          <h2 style={{ margin: "12px 0 0", fontSize: "clamp(36px, 5cqw, 68px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em" }}>
            {t("bosh_stol_eng_qimmat")}
          </h2>
          <p style={{ margin: "18px 0 0", fontSize: "18px", color: "var(--color-fog-0)", lineHeight: 1.55, maxWidth: "540px" }}>
            {t("talabalar_eng_sodiq_va")}
          </p>
          <ul style={{ listStyle: "none", margin: "30px 0 0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "24px 28px" }}>
            <li style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1.5px solid var(--color-ink-6)", paddingTop: "14px" }}>
              <b style={{ fontSize: "18px" }}>{t("bosh_soatlarni_toldiring")}</b>
              <span style={{ fontSize: "15px", color: "var(--color-fog-2)", lineHeight: 1.5 }}>
                {t("chegirmani_faqat_kerakli_kun")}
              </span>
            </li>
            <li style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1.5px solid var(--color-ink-6)", paddingTop: "14px" }}>
              <b style={{ fontSize: "18px" }}>{t("faqat_sotuvda_chegirma")}</b>
              <span style={{ fontSize: "15px", color: "var(--color-fog-2)", lineHeight: 1.5 }}>
                {t("reklama_byudjeti_shart_emas")}
              </span>
            </li>
            <li style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1.5px solid var(--color-ink-6)", paddingTop: "14px" }}>
              <b style={{ fontSize: "18px" }}>{t("har_bir_raqam_korinadi")}</b>
              <span style={{ fontSize: "15px", color: "var(--color-fog-2)", lineHeight: 1.5 }}>
                {t("nechta_talaba_kordi_qr")}
              </span>
            </li>
            <li style={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1.5px solid var(--color-ink-6)", paddingTop: "14px" }}>
              <b style={{ fontSize: "18px" }}>{t("kassir_uchun_3_soniya")}</b>
              <span style={{ fontSize: "15px", color: "var(--color-fog-2)", lineHeight: 1.5 }}>
                {t("telefonda_qr_skanerlanadi_chek")}
              </span>
            </li>
          </ul>
          <div style={{ marginTop: "34px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            <Link href="/biznes/royxat" style={{ height: "58px", padding: "0 24px", borderRadius: "16px", background: "var(--color-orange)", color: "var(--color-ink)", display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", fontWeight: 800, fontSize: "17px" }}>
              {t("biznesni_bepul_ulash")}
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <span style={{ fontSize: "14px", color: "var(--color-fog-3)" }}>{t("tariflar_tarif_malumoti")}</span>
          </div>
        </div>
        <div role="img" aria-label={t("biznes_statistikasi_namunasi")} style={{ flex: "1 1 420px", minWidth: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ background: "var(--color-paper)", color: "var(--color-ink)", borderRadius: "22px", padding: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: "15px" }}>{t("bodom_choyxonasi_bugun")}</b>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-muted)" }}>
                14:31
              </span>
            </div>
            <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>{t("sotuv")}</div>
                <div style={{ fontSize: "40px", fontWeight: 900, fontStretch: "70%", lineHeight: 1 }}>52</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>{t("tushum")}</div>
                <div style={{ fontSize: "40px", fontWeight: 900, fontStretch: "70%", lineHeight: 1 }}>
                  1.22
                  <span style={{ fontSize: "16px" }}>{" "}{t("mln")}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--color-muted)" }}>{t("yangi")}</div>
                <div style={{ fontSize: "40px", fontWeight: 900, fontStretch: "70%", lineHeight: 1 }}>9</div>
              </div>
            </div>
            <div style={{ marginTop: "18px", height: "120px", display: "flex", alignItems: "flex-end", gap: "6px", borderBottom: "1.5px solid var(--color-ink)" }}>
              {hours.map((h, i) => (
                <Fragment key={i}>
                  <div style={{ flex: 1, height: h.h, background: h.c, borderRadius: "3px 3px 0 0" }} />
                </Fragment>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-muted-2)" }}>
              <span>08</span>
              <span>12</span>
              <span>16</span>
              <span>20</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px", background: "var(--color-orange)", color: "var(--color-ink)", borderRadius: "18px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{t("qr_sotuv")}</div>
              <div style={{ fontSize: "40px", fontWeight: 900, fontStretch: "70%", lineHeight: 1, marginTop: "6px" }}>
                61%
              </div>
            </div>
            <div style={{ flex: "1 1 180px", background: "var(--color-blue)", color: "var(--color-white)", borderRadius: "18px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{t("qayta_kelganlar")}</div>
              <div style={{ fontSize: "40px", fontWeight: 900, fontStretch: "70%", lineHeight: 1, marginTop: "6px" }}>
                41%
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
