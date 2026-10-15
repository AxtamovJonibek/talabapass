// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

const CELL: CSSProperties = { minHeight: "110px", padding: "0 12px", boxSizing: "border-box", borderRight: "1.5px solid var(--color-ink)", borderBottom: "1.5px solid var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", textAlign: "center" };
const CHIP: CSSProperties = { height: "34px", padding: "0 12px", borderRadius: "17px", background: "var(--color-white)", display: "flex", alignItems: "center", fontSize: "14px", fontWeight: 700 };

/**
 * Dizayndagi sakkiz xil "logotip" yozuvi — haqiqiy logotiplar ulanguncha hamkor nomi shu uslublardan biri bilan
 * (tartib bo'yicha aylanib) chiqadi.
 */
const LOOKS: { style: CSSProperties; text?: (name: string) => string; dot?: boolean; ring?: boolean }[] = [
  { style: { fontWeight: 900, fontStretch: "125%", fontSize: "22px", letterSpacing: "-0.03em" }, text: (n) => n.toUpperCase(), dot: true },
  { style: { fontStyle: "italic", fontWeight: 600, fontSize: "24px", letterSpacing: "-0.02em" }, text: (n) => n.toLowerCase() },
  { style: { fontWeight: 900, fontStretch: "62%", fontSize: "34px", letterSpacing: "0.04em" }, text: (n) => n.toUpperCase() },
  { style: { fontWeight: 800, fontSize: "20px" }, text: (n) => n.toLowerCase(), ring: true },
  { style: { fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "20px" } },
  { style: { fontWeight: 900, fontStretch: "100%", fontSize: "21px" }, text: (n) => n.toUpperCase() },
  { style: { fontWeight: 700, fontStretch: "125%", fontSize: "18px", letterSpacing: "0.12em" }, text: (n) => n.toUpperCase() },
  { style: { fontWeight: 900, fontSize: "22px", fontStyle: "italic" } },
];

/** Hamkorlar — bazadagi tasdiqlangan bizneslar; oliygohlar — tasdiqlangan talabasi borlari (`landingPartners`). */
export function Partners({ businesses, universities }: { businesses: string[]; universities: string[] }) {
  const t = useTranslations("landing.partners");
  if (businesses.length === 0) return null;
  return (
    <section id="hamkorlar" style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(56px, 8cqw, 120px) clamp(16px, 4cqw, 48px) 0" }}>
      <h2 style={{ margin: "0", fontSize: "clamp(36px, 5cqw, 68px)", lineHeight: 0.95, fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.04em" }}>
        {t("hamkorlarimiz")}
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: "17px", color: "var(--color-muted)", maxWidth: "540px", lineHeight: 1.5 }}>
        {t("choyxonadan_sport_zalgacha_talabalarni")}
      </p>
      <div style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", borderTop: "1.5px solid var(--color-ink)", borderLeft: "1.5px solid var(--color-ink)" }}>
        {businesses.map((name, i) => {
          const look = LOOKS[i % LOOKS.length]!;
          return (
            <div key={name} style={{ ...CELL, ...look.style }}>
              {look.ring ? <span style={{ width: "22px", height: "22px", flexShrink: 0, borderRadius: "11px", border: "5px solid var(--color-ink)", boxSizing: "border-box" }} /> : null}
              <span>
                {look.text ? look.text(name) : name}
                {look.dot ? <span style={{ color: "var(--color-rust)" }}>.</span> : null}
              </span>
            </div>
          );
        })}
      </div>
      {universities.length > 0 ? (
        <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", color: "var(--color-muted)", marginRight: "6px" }}>
            {t("talabalarimiz_oqiydigan_oliygohlar")}
          </span>
          {universities.map((u) => (
            <span key={u} style={CHIP}>
              {u}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
