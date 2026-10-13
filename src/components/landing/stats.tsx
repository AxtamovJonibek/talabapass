// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { useTranslations } from "next-intl";

// TODO(7-bosqich): raqamlar bazadan hisoblanadi (tasdiqlangan talabalar, APPROVED bizneslar, faol chegirmalar,
// bugungi tejalgan summa). Belgilangan chegaradan kichik bo`lsa bo`lim umuman chiqarilmaydi. Hozir — dizayndagi matn.
export function Stats() {
  const t = useTranslations("landing.stats");
  return (
    <section aria-label={t("raqamlarda")} style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(56px, 8cqw, 110px) clamp(16px, 4cqw, 48px) 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "12px" }}>
        <div style={{ borderTop: "3px solid var(--color-ink)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95 }}>
            24 318
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("tasdiqlangan_talaba")}
          </div>
        </div>
        <div style={{ borderTop: "3px solid var(--color-ink)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95 }}>
            412
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("hamkor_biznes")}
          </div>
        </div>
        <div style={{ borderTop: "3px solid var(--color-ink)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95 }}>
            1 038
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("faol_chegirma")}
          </div>
        </div>
        <div style={{ borderTop: "3px solid var(--color-orange)", paddingTop: "14px" }}>
          <div style={{ fontSize: "clamp(52px, 6cqw, 84px)", fontWeight: 900, fontStretch: "70%", lineHeight: 0.95, color: "var(--color-rust)" }}>
            {t("41_7_mln")}
          </div>
          <div style={{ fontSize: "15px", color: "var(--color-muted)", marginTop: "6px" }}>
            {t("som_bugun_talabalar_tejadi")}
          </div>
        </div>
      </div>
    </section>
  );
}
