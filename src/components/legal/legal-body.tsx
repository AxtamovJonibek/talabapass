// Manba: design/screens/W3.html — qiymatlar dizayndan aynan ko'chirilgan.
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { LegalDoc, LegalSection } from "./docs";

export function LegalBody({ doc: docId }: { doc: LegalDoc }) {
  const t = useTranslations("legal.body");
  const sections = useTranslations("legal.docs").raw(docId) as LegalSection[];
  const doc = sections.map((section, i) => ({ ...section, id: `${docId}-${i + 1}`, n: String(i + 1).padStart(2, "0") }));
  const accent = docId === "biznes" ? "var(--color-rust)" : "var(--color-blue)";
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "36px clamp(16px, 4cqw, 48px) clamp(56px, 8cqw, 100px)", display: "flex", flexWrap: "wrap", gap: "clamp(24px, 4cqw, 56px)", alignItems: "flex-start" }}>
      <nav aria-label={t("mundarija")} style={{ flex: "1 1 240px", minWidth: "0", background: "var(--color-white)", borderRadius: "18px", padding: "18px" }}>
        <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", color: "var(--color-muted)" }}>
          {t("mundarija_2")}
        </div>
        <ol style={{ listStyle: "none", margin: "10px 0 0", padding: "0", display: "flex", flexDirection: "column" }}>
          {doc.map((s, i) => (
            <Fragment key={i}>
              <li>
                <a className="tp-link" href={`#${s.id}`} style={{ minHeight: "40px", display: "flex", alignItems: "center", gap: "10px", color: "var(--color-ink)", textDecoration: "none", fontSize: "15px", fontWeight: 600 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-muted)", width: "20px" }}>
                    {s.n}
                  </span>
                  {s.h}
                </a>
              </li>
            </Fragment>
          ))}
        </ol>
        <div style={{ marginTop: "14px", borderTop: "1.5px dashed var(--color-dash)", paddingTop: "14px", fontSize: "14px", color: "var(--color-muted)", lineHeight: 1.5 }}>
          {t("savol_bormi")}{" "}
          <b style={{ color: "var(--color-ink)" }}>{t("email")}</b>
        </div>
      </nav>
      <article style={{ flex: "3 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
        {doc.map((s, i) => (
          <Fragment key={i}>
            <section id={s.id} style={{ background: "var(--color-white)", borderRadius: "18px", padding: "clamp(20px, 3cqw, 32px)" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
                <span style={{ fontSize: "40px", fontWeight: 900, fontStretch: "62%", color: accent, lineHeight: 1 }}>
                  {s.n}
                </span>
                <h2 style={{ margin: "0", fontSize: "clamp(22px, 2.2cqw, 28px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {s.h}
                </h2>
              </div>
              <ul style={{ margin: "14px 0 0", padding: "0 0 0 20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "16px", lineHeight: 1.6, color: "var(--color-ink-3)" }}>
                {s.p.map((p, i) => (
                  <Fragment key={i}>
                    <li>{p}</li>
                  </Fragment>
                ))}
              </ul>
            </section>
          </Fragment>
        ))}
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "var(--color-muted)", lineHeight: 1.5 }}>
          {t("xizmat_korsatuvchi_yuridik_shaxs")}
        </p>
      </article>
    </div>
  );
}
