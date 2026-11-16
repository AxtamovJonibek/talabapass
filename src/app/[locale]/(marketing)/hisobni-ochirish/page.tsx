import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalFooter } from "@/components/legal/legal-footer";
import { LegalHeader } from "@/components/legal/legal-header";
import { JsonLd } from "@/components/seo/json-ld";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { CONTACTS } from "@/lib/contacts";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/hisobni-ochirish">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "accountDeletion" });
  return pageMetadata({ title: t("metaTitle"), description: t("metaDescription"), path: "/hisobni-ochirish" });
}

const card = { background: "var(--color-white)", border: "1.5px solid var(--color-line)", borderRadius: "18px", padding: "clamp(18px, 3cqw, 28px)" } as const;
const h2 = { margin: "0 0 12px", fontSize: "22px", fontWeight: 800, fontStretch: "110%", letterSpacing: "-0.02em" } as const;
const list = { margin: 0, paddingLeft: "20px", display: "grid", gap: "8px", fontSize: "15px", lineHeight: 1.5 } as const;

/**
 * Hisobni o'chirish (do'kon talabi — Google Play "Data deletion" havolasi, ilovasiz ham ochiq): ilovadagi yo'l, so'rov
 * orqali (pochta, Telegram), nima o'chiriladi va nima qoladi (`src/server/account.ts` bilan bir xil). Dizaynda chizilmagan —
 * W3 huquqiy sahifa uslubida (sarlavha va footer o'sha).
 */
export default async function AccountDeletionPage({ params }: PageProps<"/[locale]/hisobni-ochirish">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "accountDeletion" });
  const meta = await getTranslations({ locale, namespace: "meta" });
  const telegram = `https://t.me/${CONTACTS.adminTelegram}`;

  return (
    <div className="dz" style={{ containerType: "inline-size", background: "var(--color-paper)", fontFamily: "var(--font-sans)", color: "var(--color-ink)", minHeight: "100dvh" }}>
      <JsonLd data={breadcrumbLd(meta("home"), { name: t("title"), path: "/hisobni-ochirish" })} />
      <LegalHeader />
      <main style={{ maxWidth: "820px", margin: "0 auto", padding: "clamp(28px, 6cqw, 64px) clamp(16px, 4cqw, 48px)", display: "grid", gap: "16px" }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--color-muted)" }}>{t("eyebrow")}</p>
        <h1 style={{ margin: 0, fontSize: "clamp(32px, 7cqw, 52px)", fontWeight: 900, fontStretch: "112%", letterSpacing: "-0.035em", lineHeight: 0.95 }}>{t("title")}</h1>
        <p style={{ margin: "0 0 8px", fontSize: "17px", lineHeight: 1.5, color: "var(--color-muted)" }}>{t("lead")}</p>

        <section style={card}>
          <h2 style={h2}>{t("appTitle")}</h2>
          <ol style={list}>
            {(t.raw("appSteps") as string[]).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p style={{ margin: "12px 0 0", fontSize: "14px", lineHeight: 1.5, color: "var(--color-muted)" }}>{t("cashierNote")}</p>
        </section>

        <section style={card}>
          <h2 style={h2}>{t("requestTitle")}</h2>
          <p style={{ margin: "0 0 12px", fontSize: "15px", lineHeight: 1.5 }}>{t("requestText")}</p>
          <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "8px 20px", fontSize: "15px", fontWeight: 700 }}>
            <span>
              {t("email")}:{" "}
              <a className="tp-link" href={`mailto:${CONTACTS.email}?subject=Hisobni%20o'chirish`} style={{ color: "var(--color-blue)" }}>
                {CONTACTS.email}
              </a>
            </span>
            <span>
              {t("telegram")}:{" "}
              <a className="tp-link" href={telegram} style={{ color: "var(--color-blue)" }}>
                @{CONTACTS.adminTelegram}
              </a>
            </span>
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>{t("deletedTitle")}</h2>
          <ul style={list}>
            {(t.raw("deleted") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2 style={{ ...h2, marginTop: "20px" }}>{t("keptTitle")}</h2>
          <ul style={list}>
            {(t.raw("kept") as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p style={{ margin: "14px 0 0", fontSize: "14px", lineHeight: 1.5, color: "var(--color-muted)" }}>{t("openOrders")}</p>
        </section>

        <Link className="tp-link" href="/huquqiy/maxfiylik" style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-ink)" }}>
          {t("privacy")} →
        </Link>
      </main>
      <LegalFooter />
    </div>
  );
}
