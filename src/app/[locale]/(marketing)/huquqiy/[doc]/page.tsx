import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLegalDoc, LEGAL_DOCS } from "@/components/legal/docs";
import { LegalBody } from "@/components/legal/legal-body";
import { LegalFooter } from "@/components/legal/legal-footer";
import { LegalHeader } from "@/components/legal/legal-header";
import { LegalIntro } from "@/components/legal/legal-intro";
import { JsonLd } from "@/components/seo/json-ld";
import { resolveLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_DOCS.map((doc) => ({ locale, doc })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/huquqiy/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isLegalDoc(doc)) return {};
  const locale = await resolveLocale(params);
  const tabs = await getTranslations({ locale, namespace: "legal.tabs" });
  const meta = await getTranslations({ locale, namespace: "meta.legal" });
  return pageMetadata({ title: `${tabs(doc)} — Talaba Pass`, description: meta(doc), path: `/huquqiy/${doc}` });
}

// W3 — huquqiy hujjatlar. Dizayndagi uchta tab uchta manzil: /huquqiy/maxfiylik | shartlar | biznes.
export default async function LegalPage({ params }: PageProps<"/[locale]/huquqiy/[doc]">) {
  const locale = await resolveLocale(params);
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const tabs = await getTranslations({ locale, namespace: "legal.tabs" });
  const meta = await getTranslations({ locale, namespace: "meta" });

  return (
    <div className="dz" style={{ containerType: "inline-size", background: "var(--color-paper)", fontFamily: "var(--font-sans)", color: "var(--color-ink)", minHeight: "100dvh" }}>
      <JsonLd data={breadcrumbLd(meta("home"), { name: tabs(doc), path: `/huquqiy/${doc}` })} />
      <LegalHeader />
      <LegalIntro doc={doc} />
      <LegalBody doc={doc} />
      <LegalFooter />
    </div>
  );
}
