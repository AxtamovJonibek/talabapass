// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { CONTACTS } from "@/lib/contacts";

export function LandingFooter() {
  const t = useTranslations("landing.footer");
  return (
    <footer style={{ background: "var(--color-ink)", color: "var(--color-fog-1)" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "56px clamp(16px, 4cqw, 48px) 28px", display: "flex", flexWrap: "wrap", gap: "40px" }}>
        <div style={{ flex: "2 1 280px", minWidth: "0", display: "flex", flexDirection: "column", gap: "14px" }}>
          <Logo size={22} variant="white" />
          <p style={{ margin: "0", fontSize: "15px", lineHeight: 1.55, maxWidth: "340px" }}>
            {t("ozbekiston_talabalari_va_mahalliy")}
          </p>
          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
            <a className="tp-lift" href={CONTACTS.telegramChannel} target="_blank" rel="noopener noreferrer" aria-label={t("telegram")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rasmiy belgi (public/brands, o'zgartirilmagan) */}
              <img src="/brands/telegram.png" alt="" width={24} height={24} style={{ display: "block" }} />
            </a>
            <a className="tp-lift" href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer" aria-label={t("instagram")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rasmiy belgi (public/brands, o'zgartirilmagan) */}
              <img src="/brands/instagram.png" alt="" width={22} height={22} style={{ display: "block" }} />
            </a>
            <a className="tp-lift" href="#" aria-label={t("youtube")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="youtube" size={20} />
            </a>
            <a className="tp-lift" href={CONTACTS.x} target="_blank" rel="noopener noreferrer" aria-label={t("x")} style={{ width: "44px", height: "44px", borderRadius: "22px", background: "var(--color-ink-3)", color: "var(--color-white)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="xBrand" size={20} />
            </a>
          </div>
        </div>
        <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("loyiha")}</b>
          <a className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="#qanday" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("qanday_ishlaydi")}
          </a>
          <a className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="#hamkorlar" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("hamkorlar")}
          </a>
          <a className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="#savollar" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("savollar")}
          </a>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/ilova" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("mobil_ilova")}
          </Link>
        </div>
        <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("kirish")}</b>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/talaba/royxat" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("talaba_royxati")}
          </Link>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/biznes/royxat" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("biznesni_ulash")}
          </Link>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/kirish" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("hisobga_kirish")}
          </Link>
        </div>
        <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <b style={{ color: "var(--color-white)", fontSize: "14px", marginBottom: "6px" }}>{t("huquqiy")}</b>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/huquqiy/maxfiylik" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("maxfiylik_siyosati")}
          </Link>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/huquqiy/shartlar" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
            {t("foydalanish_shartlari")}
          </Link>
          <Link className="tp-link [--tp-link-hover:var(--color-white)] [--tp-link-active:var(--color-orange)]" href="/huquqiy/biznes" style={{ color: "var(--color-fog-1)", textDecoration: "none", fontSize: "15px", padding: "6px 0" }}>
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
