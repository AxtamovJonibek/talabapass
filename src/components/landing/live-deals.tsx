// Manba: design/screens/W1.html — qiymatlar dizayndan aynan ko'chirilgan.
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { ICONS } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { MINUS } from "@/lib/format";

// TODO(7-bosqich): dizayndagi namunalar. Lenta so'rovi tayyor bo'lgach (7-bosqich) bazadagi faol chegirmalar bilan almashtiriladi.
const DEALS = [
  { id: "osh", badge: `${MINUS}30%`, tile: "var(--color-tile-taom)", ink: "var(--color-tint-taom)", icon: ICONS.bowl },
  { id: "kino", badge: `${MINUS}44%`, tile: "var(--color-tile-kino)", ink: "var(--color-tint-kino)", icon: ICONS.film },
  { id: "lavash", badge: "1+1", tile: "var(--color-tile-bogo)", ink: "var(--color-tint-bogo)", icon: ICONS.wrap },
  { id: "kitob", badge: `${MINUS}15%`, tile: "var(--color-tile-kitob)", ink: "var(--color-tint-kitob)", icon: ICONS.book },
] as const;

export function LiveDeals() {
  const t = useTranslations("landing.deals");
  const deals = DEALS.map((d) => ({
    ...d,
    store: t(`items.${d.id}.store`),
    title: t(`items.${d.id}.title`),
    price: t(`items.${d.id}.price`),
    old: t(`items.${d.id}.old`),
    when: t(`items.${d.id}.when`),
    dist: t(`items.${d.id}.dist`),
  }));
  return (
    <section style={{ maxWidth: "1280px", margin: "0 auto", padding: "clamp(64px, 9cqw, 120px) clamp(16px, 4cqw, 48px) 0" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
        <h2 style={{ margin: "0", fontSize: "clamp(28px, 3.4cqw, 44px)", fontWeight: 900, fontStretch: "110%", letterSpacing: "-0.03em" }}>
          {t("hozir_toshkentda_ochiq")}
        </h2>
        <Link href="/chegirmalar" style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-blue)", textDecoration: "none", height: "44px", display: "flex", alignItems: "center" }}>
          {t("barcha_chegirmalar")}
        </Link>
      </div>
      <div style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))", gap: "12px" }}>
        {deals.map((d, i) => (
          <Fragment key={i}>
            <Link href="/chegirmalar" style={{ display: "block", background: "var(--color-white)", borderRadius: "18px", textDecoration: "none", color: "var(--color-ink)", position: "relative" }}>
              <div style={{ height: "150px", margin: "10px 10px 0", borderRadius: "12px", background: d.tile, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg aria-hidden="true" width="74" height="74" viewBox="0 0 24 24" fill="none" stroke={d.ink} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d={d.icon} />
                </svg>
                <span style={{ position: "absolute", left: "-4px", top: "-6px", background: "var(--color-orange)", fontWeight: 900, fontStretch: "65%", fontSize: "26px", lineHeight: 1, padding: "5px 9px 3px", borderRadius: "8px", transform: "rotate(-5deg)" }}>
                  {d.badge}
                </span>
              </div>
              <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ fontSize: "13px", color: "var(--color-muted)" }}>{d.store}</span>
                <b style={{ fontSize: "17px" }}>{d.title}</b>
                <span style={{ fontSize: "18px", fontWeight: 800, marginTop: "4px" }}>
                  {d.price}{" "}
                  <s style={{ fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: "13px", color: "var(--color-muted-2)" }}>
                    {d.old}
                  </s>
                </span>
              </div>
              <div style={{ margin: "0 14px", borderTop: "1.5px dashed var(--color-dash)" }} />
              <div style={{ padding: "10px 16px 14px", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--color-green)" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "4px", background: "var(--color-green-live)" }} />
                  {d.when}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>{d.dist}</span>
              </div>
            </Link>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
