"use client";

// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function LandingHeader() {
  const t = useTranslations("landing.header");
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen((open) => !open);
  const closeMenu = () => setMenuOpen(false);
  const menuIcon = menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16";
  return (
    <header style={{ position: "sticky", top: "0", zIndex: 20, background: "var(--color-paper)", borderBottom: "1.5px solid var(--color-ink)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 clamp(16px, 4cqw, 48px)", height: "72px", display: "flex", alignItems: "center", gap: "16px" }}>
        <Link href="/" aria-label={t("talabapass_bosh_sahifa")} style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontStretch: "125%", fontSize: "20px", letterSpacing: "-0.02em", textDecoration: "none", color: "var(--color-ink)", flexShrink: 0 }}>
          talaba
          <span style={{ background: "var(--color-blue)", color: "var(--color-white)", padding: "2px 8px 3px", borderRadius: "6px", fontSize: "17px" }}>
            Pass
          </span>
        </Link>
        <nav aria-label={t("asosiy")} style={{ flex: "1 1 auto", maxWidth: "clamp(0px, calc((100cqw - 920px) * 999), 2000px)", overflow: "hidden", display: "flex", justifyContent: "center", gap: "4px", whiteSpace: "nowrap" }}>
          <a href="#qanday" style={{ height: "44px", padding: "0 12px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 600, fontSize: "15px" }}>
            {t("qanday_ishlaydi")}
          </a>
          <a href="#talabalar" style={{ height: "44px", padding: "0 12px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 600, fontSize: "15px" }}>
            {t("talabalarga")}
          </a>
          <a href="#biznes" style={{ height: "44px", padding: "0 12px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 600, fontSize: "15px" }}>
            {t("bizneslarga")}
          </a>
          <a href="#hamkorlar" style={{ height: "44px", padding: "0 12px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 600, fontSize: "15px" }}>
            {t("hamkorlar")}
          </a>
          <a href="#savollar" style={{ height: "44px", padding: "0 12px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 600, fontSize: "15px" }}>
            {t("savollar")}
          </a>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <Link href="/kirish" style={{ height: "44px", padding: "0 16px", borderRadius: "12px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "15px", border: "1.5px solid var(--color-ink)" }}>
            {t("kirish")}
          </Link>
          <Link href="/talaba/royxat" style={{ maxWidth: "clamp(0px, calc((100cqw - 600px) * 999), 300px)", overflow: "hidden", whiteSpace: "nowrap", height: "44px", boxSizing: "border-box", padding: "0 clamp(0px, calc((100cqw - 600px) * 999), 18px)", borderRadius: "12px", display: "flex", alignItems: "center", background: "var(--color-blue)", color: "var(--color-white)", textDecoration: "none", fontWeight: 700, fontSize: "15px" }}>
            {t("boshlash_bepul")}
          </Link>
          <button type="button" onClick={toggleMenu} aria-label={t("menyu")} aria-expanded={menuOpen} style={{ width: "clamp(0px, calc((920px - 100cqw) * 999), 44px)", height: "44px", overflow: "hidden", padding: "0", border: "0", borderRadius: "12px", background: "var(--color-ink)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d={menuIcon} />
            </svg>
          </button>
        </div>
      </div>
      {menuOpen ? (
        <>
          <nav aria-label={t("mobil_menyu")} style={{ borderTop: "1px solid var(--color-line)", padding: "8px clamp(16px, 4cqw, 48px) 16px", display: "flex", flexDirection: "column" }}>
            <a href="#qanday" onClick={closeMenu} style={{ height: "52px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "18px", borderBottom: "1px solid var(--color-line-soft)" }}>
              {t("qanday_ishlaydi")}
            </a>
            <a href="#talabalar" onClick={closeMenu} style={{ height: "52px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "18px", borderBottom: "1px solid var(--color-line-soft)" }}>
              {t("talabalarga")}
            </a>
            <a href="#biznes" onClick={closeMenu} style={{ height: "52px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "18px", borderBottom: "1px solid var(--color-line-soft)" }}>
              {t("bizneslarga")}
            </a>
            <a href="#hamkorlar" onClick={closeMenu} style={{ height: "52px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "18px", borderBottom: "1px solid var(--color-line-soft)" }}>
              {t("hamkorlar")}
            </a>
            <a href="#savollar" onClick={closeMenu} style={{ height: "52px", display: "flex", alignItems: "center", color: "var(--color-ink)", textDecoration: "none", fontWeight: 700, fontSize: "18px", borderBottom: "1px solid var(--color-line-soft)" }}>
              {t("savollar")}
            </a>
            <Link href="/talaba/royxat" style={{ marginTop: "14px", height: "52px", borderRadius: "14px", background: "var(--color-blue)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontWeight: 800, fontSize: "16px" }}>
              {t("talaba_sifatida_boshlash")}
            </Link>
            <Link href="/biznes/royxat" style={{ marginTop: "8px", height: "52px", borderRadius: "14px", background: "var(--color-orange)", color: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontWeight: 800, fontSize: "16px" }}>
              {t("biznesni_ulash")}
            </Link>
          </nav>
        </>
      ) : null}
    </header>
  );
}
