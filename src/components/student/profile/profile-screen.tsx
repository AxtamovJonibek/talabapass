import { BackLink } from "@/components/ui/back-button";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/server/actions/auth";
import { StudentBottomNav, StudentWebNav } from "../app-chrome";
import { PhoneOrWeb } from "../responsive";
import { NotifyRow, NotifySwitch } from "./notify-toggle";
import { formatDate, StudentIdCard, TotalsGrid, type ProfileData, type ProfileTotals } from "./profile-parts";
import { ProfileForm } from "./profile-form";

type Common = { profile: ProfileData; totals: ProfileTotals; coupons: number; districts: { id: string; name: string }[] };

/** "2027-iyul" — keyingi tasdiq oyi (guvohnoma muddati tugaydigan oy). */
function useNextCheck(iso: string | null) {
  const t = useTranslations();
  if (!iso) return null;
  const d = new Date(iso);
  return { year: d.getUTCFullYear(), month: t(`month.name.${d.getUTCMonth() + 1}` as "month.name.1") };
}

/** WT4 yon paneli: karta, jami, menyu. `/tarix` va `/profil` (veb) ikkalasida bir xil. */
export function ProfileAside({ profile, totals }: { profile: ProfileData; totals: ProfileTotals }) {
  const t = useTranslations();
  const row = "flex h-14 items-center border-0 border-b border-solid border-surface px-4 font-semibold text-ink no-underline";
  const check = useNextCheck(profile.cardExpiresAt);
  return (
    <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
      <StudentIdCard profile={profile} size="web" />
      <TotalsGrid totals={totals} size="web" />
      <ul className="m-0 list-none rounded-18 bg-white p-0">
        <li>
          <Link href="/profil" className={row}>
            {t("history.menu.personal")}
            <span className="ml-auto text-placeholder">›</span>
          </Link>
        </li>
        <li>
          <Link href="/profil/guvohnoma" className={row}>
            {t("history.menu.card")}
            {check ? <span className="ml-auto text-13 font-medium text-muted">{t("history.menu.nextCheck", check)}</span> : null}
          </Link>
        </li>
        <li>
          <NotifyRow initial={profile.notify} className={row} />
        </li>
        <li>
          <Link href="/yordam" className={row}>
            {t("profile.help")}
            <span className="ml-auto text-placeholder">›</span>
          </Link>
        </li>
        <li>
          <Link href="/huquqiy/maxfiylik" className={row}>
            {t("history.menu.legal")}
            <span className="ml-auto text-placeholder">›</span>
          </Link>
        </li>
        <li>
          <form action={logoutAction}>
            <button type="submit" className="flex h-14 w-full items-center border-0 bg-transparent px-4 font-sans text-16 font-bold text-danger">
              {t("common.logout")}
            </button>
          </form>
        </li>
      </ul>
    </aside>
  );
}

/** Veb sahifa qobig'i: sarlavha (nav) + yon panel + asosiy ustun. */
function ProfileWebShell({ profile, totals, children }: Pick<Common, "profile" | "totals"> & { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <StudentWebNav active="profile" />
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-[clamp(16px,3cqw,40px)] pt-7 pb-[60px]">
        <ProfileAside profile={profile} totals={totals} />
        <main className="flex min-w-0 flex-[2_1_600px] flex-col gap-3">{children}</main>
      </div>
    </div>
  );
}

/** `back` — ota sahifa: `/profil` ning o'zida lentaga, ichki sahifalarda `/profil` ga (o'ziga emas). */
function WebCard({ title, back, children }: { title: string; back: "/chegirmalar" | "/profil"; children: ReactNode }) {
  return (
    <section className="max-w-[560px] rounded-22 bg-white p-5">
      <BackLink href={back} variant="text" className="-mt-2 mb-1" />
      <h1 className="m-0 mb-4 text-28 font-black tracking-[-0.03em] font-stretch-110%">{title}</h1>
      {children}
    </section>
  );
}

/** Telefondagi ichki ekran: "Orqaga" + sarlavha + pastki navigatsiya. */
function PhoneSubScreen({ title, coupons, children }: { title: string; coupons: number; children: ReactNode }) {
  const t = useTranslations();
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex-1 overflow-y-auto px-5 pt-[58px] pb-5">
        <Link href="/profil" className="flex h-11 items-center gap-1.5 text-14 font-bold text-ink no-underline">
          <Icon name="chevronLeft" size={16} strokeWidth={2.4} />
          {t("common.back")}
        </Link>
        <h1 className="m-0 mt-2 mb-4 text-30 font-black tracking-[-0.03em] font-stretch-112%">{title}</h1>
        {children}
      </div>
      <StudentBottomNav active="profile" coupons={coupons} />
    </div>
  );
}

const MENU_ROW = "flex h-14 items-center gap-3 px-4 text-ink no-underline";
const SEP = "border-0 border-b border-solid border-surface";
const Chevron = () => <Icon name="chevronRight" size={16} strokeWidth={2.4} className="text-placeholder" />;

/** T8 — profil (telefon). */
function ProfilePhone({ profile, totals, coupons }: Common) {
  const t = useTranslations();
  const check = useNextCheck(profile.cardExpiresAt);
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex-1 overflow-y-auto px-5 pt-[58px] pb-5">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-30 font-black tracking-[-0.03em] font-stretch-112%">{t("profile.title")}</h1>
          <a href="#sozlamalar" aria-label={t("profile.settings")} className="flex size-11 items-center justify-center rounded-full bg-white text-ink no-underline">
            <Icon name="gear" size={20} />
          </a>
        </div>
        <div className="mt-[18px]">
          <StudentIdCard profile={profile} size="phone" />
        </div>
        <TotalsGrid totals={totals} size="phone" />
        <ul id="sozlamalar" className="m-0 mt-4 list-none rounded-16 bg-white p-0">
          <li>
            <Link href="/profil/tahrir" className={cn(MENU_ROW, SEP)}>
              <span className="flex-1 text-15 font-semibold">{t("history.menu.personal")}</span>
              <Chevron />
            </Link>
          </li>
          <li>
            <Link href="/profil/guvohnoma" className={cn(MENU_ROW, SEP)}>
              <span className="flex flex-1 flex-col gap-px">
                <span className="text-15 font-semibold">{t("history.menu.card")}</span>
                {check ? <span className="text-12 text-muted">{t("profile.nextCheck", check)}</span> : null}
              </span>
              <Chevron />
            </Link>
          </li>
          <li className={cn("flex h-14 items-center gap-3 px-4", SEP)}>
            <label htmlFor="notif" className="flex-1 text-15 font-semibold">
              {t("profile.notify")}
            </label>
            <NotifySwitch initial={profile.notify} />
          </li>
          <li className={cn("flex h-14 items-center gap-3 px-4", SEP)}>
            <span className="flex-1 text-15 font-semibold">{t("profile.language")}</span>
            <span className="text-14 text-muted">{t("profile.languageValue")}</span>
          </li>
          <li>
            <Link href="/yordam" className={MENU_ROW}>
              <span className="flex-1 text-15 font-semibold">{t("profile.help")}</span>
              <Chevron />
            </Link>
          </li>
        </ul>
        <form action={logoutAction}>
          <button type="submit" className="mt-3 h-[50px] w-full rounded-14 border-0 bg-transparent font-sans text-15 font-bold text-danger">
            {t("common.logout")}
          </button>
        </form>
      </div>
      <StudentBottomNav active="profile" coupons={coupons} />
    </div>
  );
}

/** T8 / WT4 — profil. Veb ko'rinishda yon panel + "Shaxsiy ma'lumotlar" formasi. */
export function ProfileScreen(props: Common) {
  const t = useTranslations("profile");
  return (
    <PhoneOrWeb
      phone={<ProfilePhone {...props} />}
      web={
        <ProfileWebShell {...props}>
          <WebCard title={t("personalTitle")} back="/chegirmalar">
            <ProfileForm profile={props.profile} districts={props.districts} idPrefix="w" />
          </WebCard>
        </ProfileWebShell>
      }
    />
  );
}

/** `/profil/tahrir` — telefonda alohida ekran (forma), vebda `/profil` bilan bir xil. */
export function ProfileEditScreen(props: Common) {
  const t = useTranslations("profile");
  return (
    <PhoneOrWeb
      phone={
        <PhoneSubScreen title={t("personalTitle")} coupons={props.coupons}>
          <ProfileForm profile={props.profile} districts={props.districts} idPrefix="p" />
        </PhoneSubScreen>
      }
      web={
        <ProfileWebShell {...props}>
          <WebCard title={t("personalTitle")} back="/profil">
            <ProfileForm profile={props.profile} districts={props.districts} idPrefix="w" />
          </WebCard>
        </ProfileWebShell>
      }
    />
  );
}

function CardRows({ profile, onWhite }: { profile: ProfileData; onWhite: boolean }) {
  const t = useTranslations("profile");
  const expires = profile.cardExpiresAt ? new Date(profile.cardExpiresAt) : null;
  const rows: [string, string][] = [
    [t("cardStatus"), t("cardStatusValue")],
    [t("cardId"), profile.publicId],
    [t("cardNumber"), profile.cardNumber ?? "—"],
    [t("cardExpires"), expires ? formatDate(expires) : "—"],
  ];
  return (
    <>
      <dl className={cn("m-0 rounded-16 p-0", onWhite ? "bg-surface" : "bg-white")}>
        {rows.map(([k, v], i) => (
          <div key={k} className={cn("flex h-14 items-center justify-between gap-3 px-4", i < rows.length - 1 && (onWhite ? "border-0 border-b border-solid border-line-soft" : SEP))}>
            <dt className="text-14 text-muted">{k}</dt>
            <dd className="m-0 font-mono text-14 font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 mb-0 text-13 leading-[1.45] text-muted">{t("cardNote")}</p>
    </>
  );
}

/** `/profil/guvohnoma` — guvohnoma holati va amal muddati (faqat ko'rish). */
export function CardScreen(props: Common) {
  const t = useTranslations("profile");
  return (
    <PhoneOrWeb
      phone={
        <PhoneSubScreen title={t("cardTitle")} coupons={props.coupons}>
          <CardRows profile={props.profile} onWhite={false} />
        </PhoneSubScreen>
      }
      web={
        <ProfileWebShell {...props}>
          <WebCard title={t("cardTitle")} back="/profil">
            <CardRows profile={props.profile} onWhite />
          </WebCard>
        </ProfileWebShell>
      }
    />
  );
}
