"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SearchField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { normalizeQuery } from "@/lib/feed";
import { REGIONS } from "@/lib/regions";
import { setLocationAction } from "@/server/actions/student-feed";

export type LocationProps = {
  /** "" — tanlanmagan, "gps" — geolokatsiya, "d:<tuman id>", "r:<viloyat>" */
  value: string;
  districts: { id: string; name: string }[];
};

type Choice = { districtId: string } | { regionId: string } | { lat: number; lng: number };
type GpsState = { state: "idle" | "locating" } | { state: "error"; reason: "denied" | "unavailable" | "timeout" | "unsupported" };
type Option = { key: string; name: string; choice: Choice };

/** Tanlov shu brauzerda ham saqlanadi: cookie o'chsa (yoki yangi sessiya) — keyingi ochilishda tiklanadi. */
const STORAGE_KEY = "tp:joy";
let restoring = false;

function encode(choice: Choice): string {
  if ("districtId" in choice) return `d:${choice.districtId}`;
  if ("regionId" in choice) return `r:${choice.regionId}`;
  return `g:${choice.lat.toFixed(3)},${choice.lng.toFixed(3)}`;
}

function decode(value: string): Choice | null {
  if (/^d:[a-z0-9]{10,40}$/.test(value)) return { districtId: value.slice(2) };
  if (/^r:[a-z-]{2,40}$/.test(value)) return { regionId: value.slice(2) };
  const m = /^g:(-?\d{1,2}\.\d{1,3}),(-?\d{1,3}\.\d{1,3})$/.exec(value);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

function remember(choice: Choice) {
  try {
    localStorage.setItem(STORAGE_KEY, encode(choice));
  } catch {
    // Maxfiy rejim / bloklangan saqlash — cookie baribir ishlaydi
  }
}

function recall(): Choice | null {
  try {
    return decode(localStorage.getItem(STORAGE_KEY) ?? "");
  } catch {
    return null;
  }
}

/**
 * Joy tanlash (T4 / WT2 dagi "Chilonzor" tugmasi): tugma ko'rinishi — dizayndagidek (`children`), bosilganda
 * `BottomSheet` (telefon — pastdan, kompyuter — tugma ostida). Ichida qidiruv, "Mening joylashuvim" (geolokatsiya),
 * "Toshkent tumanlari" (bazadan) va "Viloyatlar" (`REGIONS`). Klaviatura: qidiruvda ↑ ↓ Home End, Enter — tanlash.
 * Dizaynda chizilmagan — mavjud primitivlardan.
 */
export function LocationSelect({ value, label, districts, className, children }: LocationProps & { label: string; className?: string; children: ReactNode }) {
  const t = useTranslations("feed.location");
  const router = useRouter();
  const uid = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Faol qator faqat klaviatura bilan yurilganda ajratiladi (barmoq bilan ochilganda kulrang qator chiqmasin)
  const [keyboard, setKeyboard] = useState(false);
  const [gps, setGps] = useState<GpsState>({ state: "idle" });
  const [pending, startTransition] = useTransition();

  const save = (choice: Choice, quiet = false) =>
    startTransition(async () => {
      const result = await setLocationAction(choice);
      if (result.ok) {
        remember(choice);
        router.refresh();
      } else if (!quiet) toast(t("saveFailed"), "info");
    });

  // Server joyni bilmasa (cookie yo'q), shu brauzerda saqlangani tiklanadi. Telefon va veb ko'rinishi DOM'da birga —
  // bir marta.
  useEffect(() => {
    if (value || restoring) return;
    const stored = recall();
    if (!stored) return;
    restoring = true;
    save(stored, true);
    // faqat birinchi chizilishda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    const q = normalizeQuery(query);
    const match = (name: string) => !q || q.split(" ").every((w) => normalizeQuery(name).includes(w));
    const tashkent: Option[] = districts.filter((d) => match(d.name)).map((d) => ({ key: `d:${d.id}`, name: d.name, choice: { districtId: d.id } }));
    const regions: Option[] = REGIONS.filter((r) => match(r.name)).map((r) => ({ key: `r:${r.id}`, name: r.name, choice: { regionId: r.id } }));
    return [
      { id: "tashkent", title: t("groupTashkent"), options: tashkent },
      { id: "regions", title: t("groupRegions"), options: regions },
    ].filter((g) => g.options.length > 0);
  }, [query, districts, t]);

  // Faol qator: 0 — "Mening joylashuvim", keyin guruhlar ketma-ket
  const flat = groups.flatMap((g) => g.options);
  const count = flat.length + 1;
  const at = Math.min(active, count - 1);
  const optionId = (i: number) => `${uid}-o${i}`;

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[id="${optionId(at)}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, open]);

  const flatIndexOf = (key: string) => [...districts.map((d) => `d:${d.id}`), ...REGIONS.map((r) => `r:${r.id}`)].indexOf(key);

  const show = () => {
    setQuery("");
    setActive(Math.max(0, flatIndexOf(value) + 1));
    setKeyboard(false);
    if (gps.state === "error") setGps({ state: "idle" });
    setOpen(true);
  };

  const pick = (choice: Choice) => {
    setOpen(false);
    save(choice);
  };

  const locate = () => {
    if (gps.state === "locating") return;
    if (!("geolocation" in navigator)) return setGps({ state: "error", reason: "unsupported" });
    setGps({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ state: "idle" });
        pick({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => setGps({ state: "error", reason: err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 600_000 },
    );
  };

  const choose = (i: number) => (i === 0 ? locate() : pick(flat[i - 1]!.choice));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const go = (i: number) => {
      e.preventDefault();
      setKeyboard(true);
      setActive((i + count) % count);
    };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home" && !query) go(0);
    else if (e.key === "End" && !query) go(count - 1);
    else if (e.key === "Enter") {
      e.preventDefault();
      choose(at);
    }
  };

  const row = (i: number) =>
    cn(
      "flex min-h-[52px] cursor-pointer items-center gap-3 px-3.5 text-15 transition-colors duration-100 hover:bg-surface",
      keyboard && i === at && "bg-surface",
    );

  const selectedMark = (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue text-white">
      <Icon name="check" size={14} strokeWidth={3} />
    </span>
  );

  let index = 0;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t("label")}: ${label}`}
        aria-busy={pending || undefined}
        onClick={show}
        className={cn("tp-lift cursor-pointer rounded-14 text-left", pending && "opacity-60", className)}
      >
        {children}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("title")} closeLabel={t("close")} anchor={trigger} initialFocus={search} width={380}>
        <div className="px-4 pb-3">
          <SearchField
            ref={search}
            label={t("search")}
            placeholder={t("searchPlaceholder")}
            value={query}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-activedescendant={optionId(at)}
            aria-autocomplete="list"
            autoComplete="off"
            enterKeyHint="go"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(e.target.value ? 1 : 0);
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        <div ref={list} id={`${uid}-list`} role="listbox" aria-label={t("title")} className="flex flex-col gap-4 px-4 pb-2">
          <div className="overflow-hidden rounded-16 bg-white">
            <div id={optionId(index++)} role="option" aria-selected={value === "gps"} onClick={() => choose(0)} onPointerMove={() => setActive(0)} className={row(0)}>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", gps.state === "error" ? "bg-danger-bg text-danger" : "bg-info-bg text-blue")}>
                {gps.state === "locating" ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-solid border-blue border-t-transparent" />
                ) : (
                  <Icon name="locate" size={18} strokeWidth={2.2} />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-2.5">
                <span className="font-bold">{t("gps")}</span>
                <span className={cn("text-13", gps.state === "error" ? "text-danger" : "text-muted")}>
                  {gps.state === "locating" ? t("locating") : gps.state === "error" ? t(`errors.${gps.reason}`) : t("gpsHint")}
                </span>
                {/* Qatorning o'zi qayta urinadi; tugma ko'rinishi — nima bo'lishini ko'rsatish uchun */}
                {gps.state === "error" && gps.reason !== "unsupported" ? (
                  <span className="mt-1.5 flex h-9 items-center gap-1.5 rounded-10 bg-ink px-3 text-13 font-bold text-white">
                    <Icon name="locate" size={14} strokeWidth={2.4} />
                    {t("retry")}
                  </span>
                ) : null}
              </span>
              {value === "gps" && gps.state !== "error" ? selectedMark : null}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${uid}-${g.id}`}>
              <div id={`${uid}-${g.id}`} className="px-1 pb-2 font-mono text-11 tracking-[0.1em] text-muted uppercase">
                {g.title}
              </div>
              <div className="overflow-hidden rounded-16 bg-white">
                {g.options.map((o, n) => {
                  const i = index++;
                  const selected = o.key === value;
                  return (
                    <div
                      key={o.key}
                      id={optionId(i)}
                      role="option"
                      aria-selected={selected}
                      onClick={() => choose(i)}
                      onPointerMove={() => setActive(i)}
                      className={cn(row(i), n > 0 && "border-0 border-t border-solid border-line-soft")}
                    >
                      <span className={cn("flex-1", selected ? "font-bold" : "font-semibold")}>{o.name}</span>
                      {selected ? selectedMark : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {groups.length === 0 ? <div className="px-2 py-6 text-center text-14 text-muted">{t("nothing")}</div> : null}
        </div>
        <div aria-live="polite" className="sr-only">
          {gps.state === "error" ? t(`errors.${gps.reason}`) : ""}
        </div>
      </BottomSheet>
    </>
  );
}
