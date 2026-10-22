import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import type { SupportContacts } from "@/server/support";
import { StudentBottomNav, StudentWebNav } from "./app-chrome";
import { PhoneOrWeb } from "./responsive";

const LANDING_ITEMS = ["1", "2", "3", "4"] as const;
const HELP_ITEMS = ["1", "2", "3", "4", "5"] as const;

function Faq() {
  const landing = useTranslations("landing.faq.items");
  const help = useTranslations("help.items");
  const items = [
    ...LANDING_ITEMS.map((id) => ({ key: `l${id}`, q: landing(`${id}.q`), a: landing(`${id}.a`) })),
    ...HELP_ITEMS.map((id) => ({ key: `h${id}`, q: help(`${id}.q`), a: help(`${id}.a`) })),
  ];
  return (
    <div className="overflow-hidden rounded-16 bg-white">
      {items.map((item) => (
        <details key={item.key} className="group border-0 border-b border-solid border-surface last:border-b-0">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-15 font-bold [&::-webkit-details-marker]:hidden">
            {item.q}
            <Icon name="chevronDown" size={16} strokeWidth={2.4} className="shrink-0 text-placeholder transition-transform group-open:rotate-180" />
          </summary>
          <p className="m-0 px-4 pb-4 text-14 leading-[1.55] text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

function Contacts({ contacts }: { contacts: SupportContacts }) {
  const t = useTranslations("help");
  const row = "tp-row flex h-14 items-center gap-3 border-0 border-b border-solid border-surface px-4 text-ink no-underline last:border-b-0";
  return (
    <section aria-labelledby="help-contact">
      <h2 id="help-contact" className="m-0 mb-1 text-18 font-extrabold font-stretch-110%">{t("contactTitle")}</h2>
      <p className="m-0 mb-3 text-14 text-muted">{t("contactLead")}</p>
      <div className="overflow-hidden rounded-16 bg-white">
        <a href={`https://t.me/${contacts.telegram}`} target="_blank" rel="noopener noreferrer" className={row}>
          <span className="flex-1 text-15 font-semibold">{t("telegram")}</span>
          <span className="text-13 text-muted">@{contacts.telegram}</span>
        </a>
        <a href={`mailto:${contacts.email}`} className={row}>
          <span className="flex-1 text-15 font-semibold">{t("email")}</span>
          <span className="text-13 text-muted">{contacts.email}</span>
        </a>
        <a href={contacts.channel} target="_blank" rel="noopener noreferrer" className={row}>
          <span className="flex-1 text-15 font-semibold">{t("channel")}</span>
          <span className="text-13 text-muted">@talabapass</span>
        </a>
        <a href={contacts.instagram} target="_blank" rel="noopener noreferrer" className={row}>
          <span className="flex-1 text-15 font-semibold">Instagram</span>
          <span className="text-13 text-muted">{contacts.instagramHandle}</span>
        </a>
        {contacts.phone ? (
          <a href={`tel:${contacts.phone}`} className={row}>
            <span className="flex-1 text-15 font-semibold">{t("phone")}</span>
            <span className="font-mono text-13 text-muted">{contacts.phone}</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

function Body({ contacts }: { contacts: SupportContacts }) {
  const t = useTranslations("help");
  return (
    <div className="flex flex-col gap-6">
      <Contacts contacts={contacts} />
      <section aria-labelledby="help-faq">
        <h2 id="help-faq" className="m-0 mb-3 text-18 font-extrabold font-stretch-110%">{t("faqTitle")}</h2>
        <Faq />
      </section>
      <Link href="/huquqiy/maxfiylik" className="tp-link text-14 font-bold text-ink underline">{t("legal")}</Link>
    </div>
  );
}

function Phone({ coupons, children }: { coupons: number; children: ReactNode }) {
  const t = useTranslations("help");
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex-1 overflow-y-auto px-5 pt-[58px] pb-5">
        <Link href="/profil" className="tp-link flex h-11 items-center gap-1.5 text-14 font-bold text-ink no-underline">
          <Icon name="chevronLeft" size={16} strokeWidth={2.4} />
          {t("back")}
        </Link>
        <h1 className="m-0 mt-2 mb-4 text-30 font-black tracking-[-0.03em] font-stretch-112%">{t("title")}</h1>
        {children}
      </div>
      <StudentBottomNav active="profile" coupons={coupons} />
    </div>
  );
}

/** `/yordam` — ilova ichidagi yordam markazi: aloqa + savollar (landing'ga chiqarmaydi). */
export function HelpScreen({ contacts, coupons }: { contacts: SupportContacts; coupons: number }) {
  const t = useTranslations("help");
  return (
    <PhoneOrWeb
      phone={
        <Phone coupons={coupons}>
          <Body contacts={contacts} />
        </Phone>
      }
      web={
        <div className="min-h-dvh bg-paper text-ink">
          <StudentWebNav active="profile" />
          <main className="mx-auto max-w-[720px] px-[clamp(16px,3cqw,40px)] pt-7 pb-[60px]">
            <h1 className="m-0 mb-5 text-30 font-black tracking-[-0.03em] font-stretch-110%">{t("title")}</h1>
            <Body contacts={contacts} />
          </main>
        </div>
      }
    />
  );
}
