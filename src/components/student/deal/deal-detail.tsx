import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PhotoOr } from "@/components/ui/avatar";
import { DealBadge } from "@/components/ui/badge";
import { PctBadge } from "@/components/ui/feed-card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { isIconName, type IconName } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { weekdaysLabel } from "@/lib/discount";
import { formatSom } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import type { BookingBlock, BookingKind } from "@/lib/preorder";
import { formatMinute, toTashkent } from "@/lib/time";
import type { DealDetail } from "@/server/student/feed";
import { DealHeroTag } from "../feed/feed-deal-card";
import { useDealText } from "../feed/labels";
import { PhoneOrWeb } from "../responsive";
import { StudentWebHeader } from "../app-chrome";
import { SaveButton, ShareButton } from "./deal-actions";
import { PhoneGallery, WebGallery } from "./gallery";
import { BusinessContact } from "./business-contact";
import { DirectionsButton } from "./directions";
import { BookingButton } from "../booking/booking-sheet";
import { PhoneClaim, WebClaim, type ClaimState } from "./claim";

/** booking — oldindan band qilish yoqilgan bo'lsa (telefon profildan; blocked — hozir nega yopiq); null — tugma umuman ko'rinmaydi */
type Props = {
  detail: DealDetail;
  now: Date;
  saved: boolean;
  initials: string;
  avatarUrl: string | null;
  claim: ClaimState;
  booking: { phone: string; kind: BookingKind; blocked: BookingBlock | null } | null;
};

/** Ikkala ko'rinish uchun umumiy yozuvlar. */
function useDetailText({ detail, now }: Pick<Props, "detail" | "now">) {
  const t = useTranslations();
  const text = useDealText();
  const { deal } = detail;
  const today = toTashkent(now).date.getTime();
  const opensToday = deal.opensAt !== null && toTashkent(new Date(deal.opensAt)).date.getTime() === today;
  const ends = new Date(`${detail.endsOn}T00:00:00Z`);
  return {
    t,
    text,
    icon: (isIconName(deal.icon) ? deal.icon : "bowl") as IconName,
    days: weekdaysLabel(detail.weekdays, (n) => t(`weekday.short.${n}` as "weekday.short.1"), t("weekday.everyDay")),
    hours: `${formatMinute(detail.fromMinute)}–${formatMinute(detail.toMinute % 1440)}`,
    leftLabel: deal.live || opensToday ? t("dealPage.leftToday") : t("dealPage.leftNext"),
    left: t("dealPage.leftValue", { left: deal.left, total: deal.total }),
    pct: deal.total > 0 ? Math.round((deal.left / deal.total) * 100) : 0,
    limit: t(`dealPage.limits.${detail.perStudentLimit}`),
    until: t("dealPage.untilValue", { day: ends.getUTCDate(), month: t(`month.name.${ends.getUTCMonth() + 1}` as "month.name.1") }),
    saves: deal.price?.old ? t("deal.saves", { amount: formatSom(deal.price.old - deal.price.now) }) : null,
    distance: deal.distanceKm !== null ? formatKm(deal.distanceKm) : null,
    /** "Hozir ochiq · 15:00 gacha" yoki "Ertaga 08:00 ochiladi" */
    pill: text.pill(deal, now),
    state: deal.live && deal.closesAt ? t("dealPage.liveUntil", { time: text.clock(deal.closesAt) }) : t("dealPage.opensAt", { when: text.webStatus(deal, now) }),
    address: detail.business.address,
    landmark: detail.business.landmark,
    letter: detail.business.name.trim().charAt(0).toUpperCase(),
  };
}

function Fact({ label, web = false, children }: { label: string; web?: boolean; children: ReactNode }) {
  return (
    <div className={cn("rounded-14", web ? "bg-paper p-3.5" : "bg-white px-3.5 py-3")}>
      <dt className="text-12 text-muted">{label}</dt>
      <dd className={cn("mx-0 mt-1 mb-0 font-bold", !web && "text-14")}>{children}</dd>
    </div>
  );
}

function LeftBar({ pct, web = false }: { pct: number; web?: boolean }) {
  return (
    <div className={cn("mt-2 h-[5px] overflow-hidden rounded-3", web ? "bg-line-soft" : "bg-bar")}>
      <div className="h-[5px] bg-orange" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Tasdiqlangan biznes belgisi (ko'k rozetka). */
function VerifiedMark({ label }: { label: string }) {
  return (
    <svg aria-label={label} role="img" width="15" height="15" viewBox="0 0 24 24" className="shrink-0 fill-blue">
      <path d="M12 2l2.6 2.1 3.3-.4 1 3.2 2.9 1.7-1 3.2 1 3.2-2.9 1.7-1 3.2-3.3-.4L12 22l-2.6-2.1-3.3.4-1-3.2-2.9-1.7 1-3.2-1-3.2 2.9-1.7 1-3.2 3.3.4z" />
      <path d="M8 12l3 3 5-6" fill="none" className="stroke-white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** T5 — chegirma tafsiloti (telefon). */
function DealPhone({ detail, now, saved, claim, booking }: Props) {
  const x = useDetailText({ detail, now });
  const { t, text } = x;
  const { deal, business } = detail;
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="relative flex h-[286px] shrink-0 items-center justify-center overflow-hidden" style={{ background: deal.tile, color: deal.ink }}>
        <PhoneGallery images={deal.images} ink={deal.ink} fallback={<Icon name={x.icon} size={190} strokeWidth={0.7} className="mt-[30px]" />}>
          <Link href="/chegirmalar" aria-label={t("dealPage.back")} className="tp-lift absolute top-[54px] left-4 flex size-11 items-center justify-center rounded-full bg-white text-ink">
            <Icon name="chevronLeft" size={20} />
          </Link>
          <div className="absolute top-[54px] right-4 flex gap-2">
            <ShareButton title={deal.title} />
            <SaveButton discountId={deal.id} saved={saved} />
          </div>
          <PctBadge className="absolute right-3 bottom-[26px]">{deal.badge}</PctBadge>
          <DealHeroTag deal={deal} now={now} className="absolute top-3 left-3 z-[2]" />
        </PhoneGallery>
      </div>

      <div className="relative -mt-[18px] flex-1 overflow-y-auto rounded-t-22 bg-paper px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center overflow-hidden rounded-10 bg-ink text-18 font-black text-paper font-stretch-125%">
            <PhotoOr src={business.logoUrl}>{x.letter}</PhotoOr>
          </div>
          <div className="flex flex-1 flex-col gap-px">
            <div className="flex items-center gap-[5px] text-15 font-bold">
              {business.name}
              <VerifiedMark label={t("dealPage.verified")} />
            </div>
            <div className="text-13 text-muted">{[business.typeLabel, business.district, x.distance].filter(Boolean).join(" · ")}</div>
          </div>
        </div>

        <h1 className="mt-4 mb-0 text-28 leading-[1.05] font-extrabold tracking-[-0.03em] font-stretch-108%">{deal.title}</h1>

        <div className="mt-3.5 flex items-end justify-between rounded-16 bg-white px-4 py-3.5">
          {deal.price ? (
            <div className="flex flex-col gap-0.5">
              {deal.price.old ? (
                <s className="font-mono text-13 text-muted-2">
                  {formatSom(deal.price.old)} {text.currency}
                </s>
              ) : null}
              <div className="text-32 leading-none font-black tracking-[-0.02em]">
                {formatSom(deal.price.now)} <span className="text-15 font-bold">{text.currency}</span>
              </div>
            </div>
          ) : (
            <div className="text-20 leading-[1.1] font-black tracking-[-0.02em]">{text.note(deal)}</div>
          )}
          {x.saves ? <div className="rounded-8 bg-green-bg px-2.5 py-[7px] text-13 font-bold text-green">{x.saves}</div> : null}
        </div>

        <dl className="mt-3 mb-0 grid grid-cols-2 gap-2">
          <Fact label={t("dealPage.when")}>
            {x.days}
            <br />
            <span className="font-mono font-medium">{x.hours}</span>
          </Fact>
          <Fact label={x.leftLabel}>
            {x.left}
            <LeftBar pct={x.pct} />
          </Fact>
          <Fact label={t("dealPage.limit")}>{x.limit}</Fact>
          <Fact label={t("dealPage.until")}>{x.until}</Fact>
        </dl>

        <div className="mt-2 flex items-center gap-3 rounded-14 bg-white px-3.5 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="text-14 font-semibold">{x.address}</div>
            {x.landmark ? (
              <div className="text-12 text-muted" data-testid="deal-landmark">
                {t("directions.landmark", { text: x.landmark })}
              </div>
            ) : null}
            <div className="text-12 text-muted">{t("dealPage.open", { hours: business.workingHours })}</div>
          </div>
          <DirectionsButton
            name={business.name}
            address={x.address}
            landmark={x.landmark}
            point={business.point}
            distanceKm={deal.distanceKm}
            className="tp-lift flex h-10 shrink-0 items-center gap-1.5 rounded-10 bg-paper px-3 font-sans text-13 font-bold whitespace-nowrap text-ink"
          />
        </div>
        <BusinessContact business={business} className="mt-2" />
        <p className="mx-0.5 mt-3.5 mb-6 text-13 leading-[1.5] text-muted">{detail.terms}</p>
      </div>

      <div className="flex flex-col gap-2 border-0 border-t border-solid border-line-soft bg-paper px-4 pt-3 pb-[30px]">
        {booking ? <BookingButton discountId={deal.id} phone={booking.phone} kind={booking.kind} blocked={booking.blocked} /> : null}
        <PhoneClaim state={claim} />
        {/* Yopiq chegirma: kulrang tugma ostida nega — "Dushanba 12:00 ochiladi" (tugaganda xato matni o'zi chiqadi) */}
        {claim.available || claim.coupon ? (
          <div className="text-center text-12 text-muted">{t("dealPage.claimHint")}</div>
        ) : claim.unavailableText ? null : (
          <div className="flex items-center justify-center gap-1.5 text-13 font-bold text-ink" data-testid="claim-closed">
            <Icon name="clock" size={15} strokeWidth={2.4} />
            {x.state}
          </div>
        )}
      </div>
    </div>
  );
}

/** WT3 — chegirma tafsiloti (veb). */
function DealWeb({ detail, now, initials, avatarUrl, claim, booking }: Props) {
  const x = useDetailText({ detail, now });
  const { t, text } = x;
  const { deal, business } = detail;
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <StudentWebHeader initials={initials} avatarUrl={avatarUrl}>
        <Link href="/chegirmalar" className="tp-link ml-auto flex h-11 items-center gap-2 px-3.5 text-15 font-bold text-ink no-underline">
          <Icon name="arrowLeft" size={18} strokeWidth={2.2} />
          {t("dealPage.allDeals")}
        </Link>
      </StudentWebHeader>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-[clamp(16px,3cqw,40px)] pt-5 pb-[60px]">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-3">
          {deal.images.length ? (
            <WebGallery images={deal.images} tile={deal.tile}>
              <PctBadge size="lg" className="absolute top-5 right-5">{deal.badge}</PctBadge>
              <DealHeroTag deal={deal} now={now} className="absolute top-3 left-3 z-[2]" />
            </WebGallery>
          ) : (
            <div className="relative flex h-[min(45vh,clamp(220px,28cqw,420px))] items-center justify-center overflow-hidden rounded-22" style={{ background: deal.tile, color: deal.ink }}>
              <Icon name={x.icon} size={240} strokeWidth={0.6} />
              <PctBadge size="lg" className="absolute top-5 right-5">{deal.badge}</PctBadge>
              <DealHeroTag deal={deal} now={now} className="absolute top-3 left-3 z-[2]" />
            </div>
          )}

          <div className="rounded-22 bg-white p-[clamp(18px,2.5cqw,28px)]">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center overflow-hidden rounded-12 bg-ink text-20 font-black text-paper font-stretch-125%">
                <PhotoOr src={business.logoUrl}>{x.letter}</PhotoOr>
              </div>
              <div className="flex-1">
                <div className="text-17 font-extrabold">{business.name}</div>
                <div className="text-14 text-muted">{[business.typeLabel, business.district, t("dealPage.verifiedPartner")].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            <h1 className="mt-[18px] mb-0 text-[clamp(24px,2.6cqw,36px)] leading-none font-black tracking-[-0.035em] font-stretch-108%">{deal.title}</h1>
            {detail.description ? <p className="mt-3 mb-0 max-w-[640px] text-16 leading-[1.55] text-ink-5">{detail.description}</p> : null}
            <dl className="mt-5 mb-0 grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-2">
              <Fact web label={t("dealPage.when")}>
                {x.days} · <span className="font-mono">{x.hours}</span>
              </Fact>
              <Fact web label={x.leftLabel}>
                {x.left}
                <LeftBar web pct={x.pct} />
              </Fact>
              <Fact web label={t("dealPage.limit")}>
                {x.limit}
              </Fact>
              <Fact web label={t("dealPage.until")}>
                {x.until}
              </Fact>
            </dl>
            <div className="border-t-hair-dashed mt-4 flex flex-wrap items-center gap-3 pt-4">
              <Icon name="pin" size={20} />
              <span className="min-w-[200px] flex-1">
                <b>{x.address}</b>{" "}
                <span className="text-muted">{[t("dealPage.openWeb", { hours: business.workingHours }), x.distance].filter(Boolean).join(" · ")}</span>
                {x.landmark ? (
                  <span className="block text-13 text-muted" data-testid="deal-landmark">
                    {t("directions.landmark", { text: x.landmark })}
                  </span>
                ) : null}
              </span>
              <DirectionsButton
                name={business.name}
                address={x.address}
                landmark={x.landmark}
                point={business.point}
                distanceKm={deal.distanceKm}
                className="tp-lift flex h-[42px] items-center gap-1.5 rounded-10 bg-paper px-3.5 font-sans text-14 font-bold whitespace-nowrap text-ink"
              />
            </div>
            <BusinessContact business={business} className="mt-3" />
          </div>
        </div>

        <aside className="sticky top-5 flex min-w-0 flex-[2_1_340px] flex-col gap-3">
          <WebClaim
            state={claim}
            top={
              <>
                <div className="flex items-end justify-between">
                  {deal.price ? (
                    <div>
                      {deal.price.old ? (
                        <s className="font-mono text-14 text-muted-2">
                          {formatSom(deal.price.old)} {text.currency}
                        </s>
                      ) : null}
                      <div className="text-44 leading-none font-black tracking-[-0.02em]">
                        {formatSom(deal.price.now)} <span className="text-18">{text.currency}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-28 leading-[1.05] font-black tracking-[-0.02em]">{text.note(deal)}</div>
                  )}
                  {x.saves ? <span className="rounded-8 bg-green-bg px-2.5 py-2 text-14 font-bold text-green">{x.saves}</span> : null}
                </div>
                <StatusPill tone={x.pill.tone} className="self-start">
                  {x.pill.text}
                </StatusPill>
              </>
            }
            terms={
  <p className="m-0 text-13 leading-[1.5] text-muted">{[t("dealPage.claimHintWeb"), detail.terms].filter(Boolean).join(" ")}</p>
            }
          />

          {booking ? (
            <div className="flex flex-col gap-3 rounded-22 bg-white p-[18px]">
              <div className="flex items-center gap-2 text-15 font-bold">
                <Icon name="clock" size={18} strokeWidth={2.2} />
                {t(`booking.kinds.${booking.kind}.title`)}
              </div>
              <BookingButton discountId={deal.id} phone={booking.phone} kind={booking.kind} blocked={booking.blocked} />
            </div>
          ) : null}

          {detail.nearby.length > 0 ? (
            <div className="rounded-22 bg-white p-[18px]">
              <b className="text-15">{t("dealPage.nearby")}</b>
              <ul className="m-0 mt-2.5 flex list-none flex-col p-0">
                {detail.nearby.map((n, i) => (
                  <li key={n.id}>
                    <Link
                      href={`/chegirmalar/${n.id}`}
                      className={cn("tp-row flex min-h-[52px] items-center gap-2.5 text-ink no-underline", i < detail.nearby.length - 1 && "border-0 border-b border-solid border-surface")}
                    >
                      <DealBadge size="sm" muted={!n.live}>
                        {n.badge}
                      </DealBadge>
                      <span className="flex-1">
                        {n.store}
                        {!n.live && n.opensAt ? <span className="text-12 text-muted"> · {text.webStatus({ ...detail.deal, live: false, opensAt: n.opensAt }, now)}</span> : null}
                      </span>
                      <span className="font-mono text-12 text-muted">{formatKm(n.distanceKm)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** T5 / WT3 — 700px da almashadi. */
export function DealDetailScreen(props: Props) {
  return <PhoneOrWeb phone={<DealPhone {...props} />} web={<DealWeb {...props} />} />;
}
