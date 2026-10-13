"use client";

// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";

const FAQ_IDS = ["1", "2", "3", "4", "5"] as const;

export function Faq() {
  const t = useTranslations("landing.faq");
  const [openIndex, setOpenIndex] = useState(0);
  const faq = FAQ_IDS.map((id, i) => {
    const open = openIndex === i;
    return {
      q: t(`items.${id}.q`),
      a: t(`items.${id}.a`),
      open,
      icon: open ? "M5 12h14" : "M12 5v14M5 12h14",
      btnBg: open ? "var(--color-ink)" : "var(--color-white)",
      btnFg: open ? "var(--color-white)" : "var(--color-ink)",
      toggle: () => setOpenIndex(open ? -1 : i),
    };
  });
  return (
    <section id="savollar" style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(64px, 9cqw, 140px) clamp(16px, 4cqw, 48px) 0", display: "flex", flexWrap: "wrap", gap: "clamp(24px, 5cqw, 72px)" }}>
      <div style={{ flex: "1 1 300px", minWidth: "0" }}>
        <h2 style={{ margin: "0", fontSize: "clamp(36px, 5cqw, 68px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em" }}>
          {t("kop_soraladigan_savollar")}
        </h2>
        <p style={{ margin: "16px 0 0", fontSize: "16px", color: "var(--color-muted)", lineHeight: 1.5 }}>
          {t("javob_topolmadingizmi_telegram_orqali")}
        </p>
      </div>
      <div style={{ flex: "2 1 520px", minWidth: "0", borderTop: "1.5px solid var(--color-ink)" }}>
        {faq.map((f, i) => (
          <Fragment key={i}>
            <div style={{ borderBottom: "1.5px solid var(--color-ink)" }}>
              <button type="button" onClick={f.toggle} aria-expanded={f.open} style={{ width: "100%", minHeight: "72px", padding: "16px 0", border: "0", background: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", textAlign: "left", fontFamily: "inherit", fontSize: "clamp(18px, 1.8cqw, 22px)", fontWeight: 800, color: "var(--color-ink)" }}>
                <span>{f.q}</span>
                <span style={{ width: "36px", height: "36px", borderRadius: "18px", background: f.btnBg, color: f.btnFg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <path d={f.icon} />
                  </svg>
                </span>
              </button>
              {f.open ? (
                <>
                  <p style={{ margin: "0", padding: "0 52px 22px 0", fontSize: "16px", lineHeight: 1.6, color: "var(--color-ink-5)" }}>
                    {f.a}
                  </p>
                </>
              ) : null}
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
