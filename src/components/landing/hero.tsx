// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { miniQr } from "./mini-qr";

export function Hero() {
  const t = useTranslations("landing.hero");
  return (
    <section style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(20px, min(6cqw, 6vh), 80px) clamp(16px, 4cqw, 48px) clamp(40px, 6cqw, 90px)", display: "flex", flexWrap: "wrap", gap: "clamp(32px, 5cqw, 64px)", alignItems: "center" }}>
      <div style={{ flex: "1 1 480px", minWidth: "0" }}>
        <h1 style={{ margin: "0", fontSize: "clamp(40px, min(7.6cqw, 10.5vh), 108px)", lineHeight: 0.92, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.045em" }}>
          {t("talaba_bolish_endi")}{" "}
          <span style={{ background: "var(--color-orange)", padding: "0 0.12em", borderRadius: "0.12em", display: "inline-block", transform: "rotate(-2deg)" }}>
            {t("arzonroq")}
          </span>
        </h1>
        <p style={{ margin: "clamp(14px, 2.4vh, 24px) 0 0", fontSize: "clamp(16px, min(1.6cqw, 2.6vh), 21px)", lineHeight: 1.5, color: "var(--color-ink-5)", maxWidth: "560px", textWrap: "pretty" }}>
          {t("kafe_kitob_dokoni_sport")}
        </p>
        <div style={{ marginTop: "clamp(18px, 3.2vh, 30px)", display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Link className="tp-btn tp-stamp" href="/talaba/royxat" style={{ height: "58px", padding: "0 24px", borderRadius: "16px", background: "var(--color-blue)", color: "var(--color-white)", display: "flex", alignItems: "center", gap: "12px", textDecoration: "none", fontWeight: 800, fontSize: "17px" }}>
            {t("talaba_sifatida_boshlash")}
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <a className="tp-btn tp-paint" href="#biznes" style={{ height: "58px", padding: "0 22px", borderRadius: "16px", border: "1.5px solid var(--color-ink)", color: "var(--color-ink)", display: "flex", alignItems: "center", textDecoration: "none", fontWeight: 700, fontSize: "17px", background: "var(--color-white)" }}>
            {t("men_biznes_egasiman")}
          </a>
        </div>
        <div style={{ marginTop: "clamp(14px, 2.4vh, 22px)", fontSize: "14px", color: "var(--color-muted)" }}>{t("cta_note")}</div>
      </div>
      <div role="img" aria-label={t("talabapass_ilovasi_chegirmalar_lentasi")} style={{ flex: "1 1 400px", minWidth: "0", position: "relative", height: "600px", display: "flex", justifyContent: "center" }}>
        <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "40px", width: "460px", height: "460px", marginLeft: "-230px", borderRadius: "230px", border: "2px dashed var(--color-dash-2)" }} />
        <div style={{ position: "relative", width: "280px", height: "580px", borderRadius: "44px", background: "var(--color-ink)", padding: "10px", boxSizing: "border-box", transform: "rotate(3deg)", boxShadow: "0 30px 60px -20px rgba(20,20,20,0.45)" }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "35px", background: "var(--color-paper)", overflow: "hidden", padding: "34px 12px 0", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "9px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
              <b style={{ fontSize: "13px" }}>{t("chilonzor")}</b>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", background: "var(--color-ink)", color: "var(--color-paper)", padding: "3px 7px", borderRadius: "10px" }}>
                {t("se_14_20")}
              </span>
            </div>
            <div style={{ height: "104px", borderRadius: "14px", background: "var(--color-blue)", color: "var(--color-white)", padding: "10px 12px", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "10px", opacity: 0.85 }}>{t("bodom_choyxonasi_0_6")}</span>
              <span style={{ fontSize: "44px", lineHeight: 0.9, fontWeight: 900, fontStretch: "62%", marginTop: "4px" }}>
                −25%
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, marginTop: "2px" }}>{t("osh_0_5_porsiya")}</span>
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              <span style={{ height: "26px", padding: "0 10px", borderRadius: "13px", background: "var(--color-ink)", color: "var(--color-white)", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center" }}>
                {t("hammasi")}
              </span>
              <span style={{ height: "26px", padding: "0 10px", borderRadius: "13px", background: "var(--color-white)", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center" }}>
                {t("kofe")}
              </span>
              <span style={{ height: "26px", padding: "0 10px", borderRadius: "13px", background: "var(--color-white)", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center" }}>
                {t("kitob")}
              </span>
            </div>
            <div style={{ background: "var(--color-white)", borderRadius: "12px", padding: "8px", display: "flex", gap: "8px" }}>
              <div style={{ width: "54px", height: "54px", borderRadius: "9px", background: "var(--color-tile-xizmat)", position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E2A9E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z" />
                </svg>
                <span style={{ position: "absolute", left: "-4px", top: "-5px", background: "var(--color-orange)", fontWeight: 900, fontStretch: "70%", fontSize: "11px", padding: "2px 4px", borderRadius: "4px", transform: "rotate(-6deg)" }}>
                  −40%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "9px", color: "var(--color-muted)" }}>{t("nusxa_markazi_0_1")}</span>
                <b style={{ fontSize: "11px" }}>{t("a4_chop_etish")}</b>
                <b style={{ fontSize: "12px" }}>
                  {t("300_som")}{" "}
                  <s style={{ fontWeight: 400, color: "var(--color-muted-2)", fontSize: "9px" }}>500</s>
                </b>
              </div>
            </div>
            <div style={{ background: "var(--color-white)", borderRadius: "12px", padding: "8px", display: "flex", gap: "8px" }}>
              <div style={{ width: "54px", height: "54px", borderRadius: "9px", background: "var(--color-tile-kino)", position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B2479" strokeWidth="1.4" strokeLinejoin="round">
                  <path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10" />
                </svg>
                <span style={{ position: "absolute", left: "-4px", top: "-5px", background: "var(--color-orange)", fontWeight: 900, fontStretch: "70%", fontSize: "11px", padding: "2px 4px", borderRadius: "4px", transform: "rotate(-6deg)" }}>
                  −44%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "9px", color: "var(--color-muted)" }}>{t("kadr_kinoteatri_3_0")}</span>
                <b style={{ fontSize: "11px" }}>{t("kino_chiptasi_2d")}</b>
                <b style={{ fontSize: "12px" }}>
                  {t("25_000_som")}{" "}
                  <s style={{ fontWeight: 400, color: "var(--color-muted-2)", fontSize: "9px" }}>45 000</s>
                </b>
              </div>
            </div>
            <div style={{ background: "var(--color-white)", borderRadius: "12px", padding: "8px", display: "flex", gap: "8px" }}>
              <div style={{ width: "54px", height: "54px", borderRadius: "9px", background: "var(--color-tile-sport)", position: "relative", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#145A33" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />
                </svg>
                <span style={{ position: "absolute", left: "-4px", top: "-5px", background: "var(--color-orange)", fontWeight: 900, fontStretch: "70%", fontSize: "11px", padding: "2px 4px", borderRadius: "4px", transform: "rotate(-6deg)" }}>
                  −36%
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "9px", color: "var(--color-muted)" }}>{t("forma_fitnes_2_1")}</span>
                <b style={{ fontSize: "11px" }}>{t("oylik_abonement")}</b>
                <b style={{ fontSize: "12px" }}>{t("290_000_som")}</b>
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: "max(0px, calc(50% - 250px))", bottom: "40px", width: "176px", background: "var(--color-white)", border: "1.5px solid var(--color-ink)", borderRadius: "16px", padding: "12px", transform: "rotate(-7deg)", boxShadow: "0 16px 30px -12px rgba(20,20,20,0.35)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9, minmax(0, 1fr))", gap: "2px" }}>
            {miniQr.map((c, i) => (
              <Fragment key={i}>
                <div style={{ aspectRatio: 1, background: c }} />
              </Fragment>
            ))}
          </div>
          <div style={{ marginTop: "8px", fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 600, textAlign: "center", letterSpacing: "0.08em" }}>
            {t("tp_7k3q_92xd")}
          </div>
        </div>
        <div style={{ position: "absolute", right: "max(0px, calc(50% - 260px))", top: "70px", background: "var(--color-orange)", borderRadius: "14px", padding: "10px 14px 8px", transform: "rotate(8deg)", fontWeight: 900, fontStretch: "62%", fontSize: "48px", lineHeight: 0.9, boxShadow: "0 16px 30px -12px rgba(20,20,20,0.35)" }}>
          1+1
        </div>
        <div style={{ position: "absolute", right: "max(0px, calc(50% - 250px))", bottom: "120px", background: "var(--color-ink)", color: "var(--color-paper)", borderRadius: "14px", padding: "12px 14px", transform: "rotate(4deg)", display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "11px", color: "var(--color-fog-2)" }}>{t("oktabrda_tejading")}</span>
          <span style={{ fontSize: "17px", fontWeight: 900, fontStretch: "85%" }}>{t("206_400_som")}</span>
        </div>
      </div>
    </section>
  );
}
