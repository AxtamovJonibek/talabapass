import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DealBadge, LiveDot, StatusPill } from "@/components/ui/badge";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button, ButtonLink } from "@/components/ui/button";
import { DealCard } from "@/components/ui/deal-card";
import { Field, Input, PhoneInput, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ICONS, type IconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { Receipt, ReceiptDivider, ReceiptRow } from "@/components/ui/receipt";
import { Sidebar, SidebarCard } from "@/components/ui/sidebar";
import { StatCard } from "@/components/ui/stat-card";
import { resolveLocale } from "@/i18n/locale";
import { formatSom, MINUS } from "@/lib/format";
import { InteractiveDemos } from "./interactive";

/*
 * Dizayn tizimi ko'rgazmasi — faqat ishlab chiqish uchun (production'da 404).
 * Bu yerdagi namunaviy matnlar dizayndan olingan demo ma'lumot; ilova matnlari messages/uz.json da.
 */

const SWATCHES = [
  ["ink", "bg-ink"], ["paper", "bg-paper"], ["white", "bg-white"], ["admin-bg", "bg-admin-bg"],
  ["surface", "bg-surface"], ["track", "bg-track"], ["line", "bg-line"], ["muted", "bg-muted"],
  ["blue", "bg-blue"], ["blue-2", "bg-blue-2"], ["orange", "bg-orange"], ["rust", "bg-rust"],
  ["green", "bg-green"], ["green-live", "bg-green-live"], ["green-bg", "bg-green-bg"], ["mint", "bg-mint"],
  ["danger", "bg-danger"], ["danger-bg", "bg-danger-bg"], ["warn", "bg-warn"], ["warn-bg", "bg-warn-bg"],
  ["info-bg", "bg-info-bg"], ["ink-2", "bg-ink-2"], ["ink-3", "bg-ink-3"], ["ink-4", "bg-ink-4"],
  ["ink-5", "bg-ink-5"], ["fog-1", "bg-fog-1"], ["fog-2", "bg-fog-2"], ["fog-3", "bg-fog-3"],
  ["heat-0", "bg-heat-0"], ["heat-1", "bg-heat-1"], ["heat-2", "bg-heat-2"], ["heat-3", "bg-heat-3"], ["heat-4", "bg-heat-4"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 font-mono text-12 font-semibold tracking-[0.08em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function DesignSystemPage({ params }: PageProps<"/[locale]/dev/ui">) {
  if (process.env.NODE_ENV === "production") notFound();
  await resolveLocale(params);
  const t = await getTranslations();

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Logo size={22} />
        <h1 className="m-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">Dizayn tizimi</h1>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-6">
          <Logo size={20} />
          <Logo size={18} />
          <Logo size={17} chip="ink" tag={t("brand.business")} />
          <div className="flex gap-6 rounded-12 bg-ink p-4 text-paper">
            <Logo size={18} />
            <Logo size={17} chip="white" tag={t("brand.business")} />
            <Logo size={17} tag={t("brand.admin")} tagTone="paper" />
          </div>
          <div className="rounded-12 bg-blue p-4 text-white">
            <Logo size={14} chip="white-blue" />
          </div>
        </div>
      </Section>

      <Section title="Ranglar">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(110px,100%),1fr))] gap-2">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-12 rounded-10 border-hair border-line ${cls}`} />
              <span className="font-mono text-11 text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografiya — Archivo (wdth 62–125%), raqamlar tabular-nums">
        <div className="flex flex-col gap-3 rounded-18 bg-white p-6">
          <div className="text-40 leading-[0.98] font-black tracking-[-0.035em] font-stretch-112%">
            Talabamisan? Arzonroq to&apos;laysan.
          </div>
          <div className="text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">Statistika</div>
          <div className="text-44 leading-none font-black font-stretch-75%">1 284 · 30.1 mln · 61%</div>
          <div className="text-20 font-extrabold font-stretch-125%">font-stretch 125% — logo</div>
          <div className="text-17 font-black font-stretch-70%">font-stretch 70% — {MINUS}30% 1+1</div>
          <p className="m-0 max-w-[520px] text-15 leading-[1.45] text-muted">
            Kafe, kitob, sport zal, sartaroshxona — hammasi talaba narxida. Guvohnomang yetarli.
          </p>
          <div className="font-mono text-12 tracking-[0.06em] text-muted">QADAM 1/3 · TP-7K3Q-92XD · 13.10.2026 14:31</div>
        </div>
      </Section>

      <Section title="Tugmalar">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex w-[342px] flex-col gap-3">
            <Button variant="blue" spread block>
              <span>{t("common.continue")}</span>
              <Icon name="arrowRight" size={22} />
            </Button>
            <Button variant="orange" spread block>
              <span>Keyingi: hujjatlar</span>
              <Icon name="arrowRight" size={22} />
            </Button>
            <Button variant="ink" block>
              Holatni yangilash
            </Button>
            <ButtonLink href="/dev/ui" variant="ghost" size="sm" className="text-blue">
              Boshqa rasm yuklash
            </ButtonLink>
            <Button variant="danger-ghost" block className="h-[50px]">
              {t("common.logout")}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="green" size="md" className="px-[22px]">
              <Icon name="check" size={18} strokeWidth={3} />
              {t("common.approve")}
            </Button>
            <Button variant="outline" size="md">
              {t("common.reject")}
            </Button>
            <Button variant="danger-outline" size="md">
              {t("common.block")}
            </Button>
            <Button variant="outline" size="sm">
              <Icon name="download" size={16} strokeWidth={2.2} />
              Excel hisobot
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Forma maydonlari">
        <div className="grid w-full max-w-[390px] gap-3.5">
          <Field label="Telefon raqam" htmlFor="demo-tel">
            <PhoneInput id="demo-tel" defaultValue="90 412 37 85" />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Ism" htmlFor="demo-ism">
              <Input id="demo-ism" defaultValue="Dilnoza" />
            </Field>
            <Field label="Familiya" htmlFor="demo-fam">
              <Input id="demo-fam" placeholder="Familiyangiz" />
            </Field>
          </div>
          <Field label="Universitet" htmlFor="demo-uni">
            <Select id="demo-uni" defaultValue="tatu">
              <option value="tatu">Toshkent axborot texnologiyalari universiteti</option>
              <option value="ozmu">O&apos;zbekiston Milliy universiteti</option>
            </Select>
          </Field>
          <Field label="Qisqacha tavsif" htmlFor="demo-desc" hint="52/120">
            <Textarea id="demo-desc" rows={2} defaultValue="Toshkent oshi, somsa va choy. 60 o'rinli zal." />
          </Field>
          <Field label="STIR (INN)" htmlFor="demo-err" error="9 ta raqam bo'lishi kerak">
            <Input id="demo-err" invalid defaultValue="30748" />
          </Field>
        </div>
      </Section>

      <Section title="Interaktiv: chip, kurs, kunlar, almashtirgichlar">
        <InteractiveDemos />
      </Section>

      <Section title="Yorliqlar va holatlar">
        <div className="flex flex-wrap items-center gap-4">
          <DealBadge>{MINUS}30%</DealBadge>
          <DealBadge>1+1</DealBadge>
          <StatusPill tone="ok">{t("status.active")}</StatusPill>
          <StatusPill tone="warn">Ogohlantirish</StatusPill>
          <StatusPill tone="bad">{t("status.rejected")}</StatusPill>
          <StatusPill tone="info">{t("status.scheduled")}</StatusPill>
          <StatusPill tone="warn" size="lg">
            {t("status.inReview")}
          </StatusPill>
          <StatusPill tone="ok" size="lg">
            {t("status.approved")}
          </StatusPill>
          <span className="flex items-center gap-1.5 text-12 font-bold text-green-text">
            <LiveDot live /> {t("deal.now")}
          </span>
          <span className="flex items-center gap-1.5 text-12 font-bold text-muted">
            <LiveDot live={false} /> {t("deal.tomorrow")}
          </span>
        </div>
      </Section>

      <Section title="Chegirma kartasi (T4) va chek (T7)">
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex w-[358px] flex-col gap-3">
            <DealCard
              href="/dev/ui"
              badge={`${MINUS}30%`}
              store="Bodom Choyxonasi"
              distance="0.6 km"
              title="Osh 0.5 porsiya + choy"
              price={{ now: formatSom(26600), old: formatSom(38000), currency: t("common.currency") }}
              live
              status={t("deal.now")}
              when={t("deal.until", { time: "15:00" })}
              left={26}
              total={60}
              icon="bowl"
              tileColor="#F4DCCB"
              inkColor="#8A3410"
            />
            <DealCard
              href="/dev/ui"
              badge="1+1"
              store="Lavash Point"
              distance="0.9 km"
              title="Lavash + ayron"
              note="Ikkinchi lavash bepul"
              live={false}
              status={t("deal.tomorrow")}
              when="10:00–17:00"
              left={31}
              total={50}
              icon="wrap"
              tileColor="#F3E6C4"
              inkColor="#7A5508"
            />
          </div>
          <Receipt
            className="w-[358px]"
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-12 font-bold text-green">
                  <Icon name="check" size={14} strokeWidth={3} />
                  {t("receipt.confirmed")}
                </div>
                <div className="font-mono text-12 text-muted">{t("receipt.number", { no: "004821" })}</div>
              </div>
            }
          >
            <ReceiptRow label={t("receipt.business")} value="Bodom Choyxonasi" />
            <ReceiptRow label={t("receipt.product")} value="Osh 0.5 + choy" />
            <ReceiptRow label={t("receipt.time")} value="13.10.2026 14:31" />
            <ReceiptRow label={t("receipt.cashier")} value="Jasur T." />
            <ReceiptDivider />
            <ReceiptRow label={t("receipt.originalPrice")} value={formatSom(38000)} />
            <ReceiptRow kind="discount" label={t("receipt.discount", { badge: `${MINUS}30%` })} value={formatSom(-11400)} />
            <ReceiptRow kind="total" label={t("receipt.paid")} value={`${formatSom(26600)} ${t("common.currency")}`} />
          </Receipt>
        </div>
      </Section>

      <Section title="KPI kartalari (B6)">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))] gap-2.5">
          <StatCard tone="dark" label="Sotuvlar" value="1 284" note="+18% oldingi 30 kunga" />
          <StatCard label="Talabalardan tushum" value="30.1 mln" note="so'm · o'rtacha chek 23 500" />
          <StatCard label="Berilgan chegirma" value="12.0 mln" note="so'm · sizning sarmoyangiz" valueClassName="text-rust" />
          <StatCard label="Yangi mijozlar" value="612" note="birinchi marta kelgan talaba" />
        </div>
      </Section>

      <Section title="Navigatsiya">
        <div className="flex flex-wrap items-start gap-6">
          <div className="w-[390px] overflow-hidden rounded-12 border-hair border-line">
            <BottomNav
              label={t("studentNav.home")}
              items={[
                { href: "/dev/ui", label: t("studentNav.home"), icon: "home", active: true },
                { href: "/dev/ui#k", label: t("studentNav.coupons"), icon: "ticket", badge: 1 },
                { href: "/dev/ui#t", label: t("studentNav.history"), icon: "clock" },
                { href: "/dev/ui#p", label: t("studentNav.profile"), icon: "user" },
              ]}
            />
          </div>
          <div className="w-[390px] overflow-hidden rounded-12">
            <BottomNav
              tone="dark"
              label={t("cashierNav.scanner")}
              items={[
                { href: "/dev/ui", label: t("cashierNav.scanner"), icon: "scan", active: true },
                { href: "/dev/ui#c", label: t("cashierNav.discounts"), icon: "ticket" },
                { href: "/dev/ui#s", label: t("cashierNav.stats"), icon: "chart" },
                { href: "/dev/ui#p", label: t("cashierNav.profile"), icon: "store" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex h-[420px] w-[252px]">
            <Sidebar
              accent="orange"
              navLabel={t("businessNav.label")}
              header={<Logo size={17} chip="white" tag={t("brand.business")} className="px-2" />}
              items={[
                { href: "/dev/ui", label: t("businessNav.stats"), icon: "chart", active: true },
                { href: "/dev/ui#1", label: t("businessNav.discounts"), icon: "ticket", count: 3 },
                { href: "/dev/ui#2", label: t("businessNav.sales"), icon: "receipt" },
                { href: "/dev/ui#3", label: t("businessNav.cashiers"), icon: "users" },
                { href: "/dev/ui#4", label: t("businessNav.profile"), icon: "store" },
              ]}
              footer={
                <SidebarCard title="Kassa ilovasi">
                  Kassirlar telefon orqali QR skanerlaydi. Taklif havolasini yuboring.
                </SidebarCard>
              }
            />
          </div>
          <div className="flex h-[420px] w-[252px]">
            <Sidebar
              accent="blue"
              navLabel={t("adminNav.label")}
              header={<Logo size={17} tag={t("brand.admin")} tagTone="paper" className="px-2" />}
              items={[
                { href: "/dev/ui", label: t("adminNav.overview"), icon: "chart", active: true },
                { href: "/dev/ui#1", label: t("adminNav.students"), icon: "student", count: 47 },
                { href: "/dev/ui#2", label: t("adminNav.businesses"), icon: "store", count: 8 },
                { href: "/dev/ui#3", label: t("adminNav.transactions"), icon: "receipt" },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="Ikonkalar">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(96px,100%),1fr))] gap-2">
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <div key={name} className="flex flex-col items-center gap-1.5 rounded-12 bg-white p-3">
              <Icon name={name} size={24} />
              <span className="font-mono text-11 text-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={'"Chipta" cheti (T1 sarlavha bloki)'}>
        <div className="relative w-[390px] bg-ink px-6 pt-6 pb-[22px] text-paper">
          <Logo size={18} />
          <div className="mt-4 flex gap-1.5">
            <div className="h-1 flex-1 rounded-2 bg-orange" />
            <div className="h-1 flex-1 rounded-2 bg-ink-5" />
            <div className="h-1 flex-1 rounded-2 bg-ink-5" />
          </div>
          <div className="ticket-scallop" />
        </div>
      </Section>
    </main>
  );
}
