// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CONTACTS } from "@/lib/contacts";

export function LandingFooter() {
  const t = useTranslations("landing.footer");
  return (
    <footer style={{ background: "var(--color-ink)", color: "var(--color-fog-1)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "56px clamp(16px, 4cqw, 48px) 28px", display: "flex", flexWrap: "wrap", gap: "40px" }}>
        <div style={{ flex: "2 1 280px", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontStretch: "125%", fontSize: "22px", color: "var(--color-white)" }}>
            talaba
            <span style={{ background: "var(--color-blue)", padding: "2px 8px 3px", borderRadius: "6px", fontSize: "18px" }}>
              Pass
            </span>
          </div>
          <p style={{ margin: "0", fontSize: "15px", lineHeight: 1.55, maxWidth: "340px" }}>
            {t("ozbekiston_talabalari_va_mahalliy")}
          </p>
          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
            <a href={CONTACTS.telegramChannel} target="_blank" rel="noopener noreferrer" aria-label={t("telegram")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4L3 11l6 2 2 6 3-4 5 4z" />
                <path d="M9 13l12-9" />
              </svg>
            </a>
            <a href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer" aria-label={t("instagram")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <path d="M17.5 6.5h.01" />
              </svg>
            </a>
            <a href="#" aria-label={t("youtube")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="4" />
                <path d="M10 9l5 3-5 3z" />
              </svg>
            </a>
            <a href={CONTACTS.x} target="_blank" rel="noopener noreferrer" aria-label={t("x")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
        <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("loyiha")}</b>
          <a href="#qanday" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("qanday_ishlaydi")}
          </a>
          <a href="#hamkorlar" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("hamkorlar")}
          </a>
          <a href="#savollar" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("savollar")}
          </a>
        </div>
        <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("kirish")}</b>
          <Link href="/talaba/royxat" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("talaba_royxati")}
          </Link>
          <Link href="/biznes/royxat" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("biznesni_ulash")}
          </Link>
          <Link href="/kirish" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("hisobga_kirish")}
          </Link>
        </div>
        <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("huquqiy")}</b>
          <Link href="/huquqiy/maxfiylik" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("maxfiylik_siyosati")}
          </Link>
          <Link href="/huquqiy/shartlar" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("foydalanish_shartlari")}
          </Link>
          <Link href="/huquqiy/biznes" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("biznes_hamkorlik_shartlari")}
          </Link>
        </div>
        <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("aloqa")}</b>
          <span style={{ fontSize: "15px", padding: "6px 0" }}>{t("email")}</span>
        </div>
      </div>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "18px clamp(16px, 4cqw, 48px) 28px", borderTop: "1px solid var(--color-ink-4)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "10px", fontSize: "13px", color: "var(--color-fog-3)" }}>
        <span>{t("2026_talabapass_barcha_huquqlar")}</span>
        <span style={{ display: "flex", gap: "14px" }}>
          <b style={{ color: "var(--color-white)" }}>{t("ozbekcha")}</b>
          <span>{t("русский")}</span>
          <span>{t("english")}</span>
        </span>
      </div>
    </footer>
  );
}
