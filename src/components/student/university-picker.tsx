"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { OTHER_UNIVERSITY, searchUniversities, UNIVERSITY_NAME_MAX, type UniversityOption } from "@/lib/universities";

const LIMIT = 60;

/**
 * Qidiruvli universitet tanlovi: nom, qisqa nom yoki viloyat yoziladi, ro'yxat o'zgaradi.
 * Oxirgi qator — "Ro'yxatda yo'q": nom matn bilan kiritiladi, admin ko'rib chiqib ro'yxatga qo'shadi.
 * Forma qiymatlari: `universityId` (id yoki "other") va `universityOther` (matn).
 */
export function UniversityPicker({
  id,
  universities,
  defaultId,
  defaultOther = "",
  invalid,
  otherInvalid,
}: {
  id: string;
  universities: UniversityOption[];
  defaultId?: string;
  defaultOther?: string;
  invalid?: boolean;
  otherInvalid?: boolean;
}) {
  const t = useTranslations("onboarding.register");
  const kinds = useTranslations("universityKind");
  const initial = defaultId === OTHER_UNIVERSITY ? null : universities.find((u) => u.id === defaultId);
  const [selected, setSelected] = useState<string | null>(defaultId === OTHER_UNIVERSITY ? OTHER_UNIVERSITY : (initial?.id ?? null));
  const [query, setQuery] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const found = useMemo(() => searchUniversities(universities, selected && selected !== OTHER_UNIVERSITY && query === initialName(universities, selected) ? "" : query), [universities, query, selected]);
  const shown = found.slice(0, LIMIT);
  const rows = shown.length + 1; // oxirgisi — "Ro'yxatda yo'q"
  const listId = `${id}-list`;

  function pick(index: number) {
    if (index >= shown.length) {
      setSelected(OTHER_UNIVERSITY);
      setQuery("");
    } else {
      const u = shown[index]!;
      setSelected(u.id);
      setQuery(u.name);
    }
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="universityId" value={selected ?? ""} />
      {selected === OTHER_UNIVERSITY ? (
        <div className="flex flex-col gap-1.5">
          <Input
            id={id}
            name="universityOther"
            placeholder={t("universityOtherPlaceholder")}
            maxLength={UNIVERSITY_NAME_MAX}
            defaultValue={defaultOther}
            autoFocus
            invalid={otherInvalid}
          />
          <p className="m-0 text-12 leading-[1.4] text-muted">{t("universityOtherHint")}</p>
          <button
            type="button"
            className="tp-link h-9 self-start border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setOpen(true);
            }}
          >
            {t("universityBack")}
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={t("universitySearchPlaceholder")}
            value={query}
            invalid={invalid}
            className="pr-10"
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(rows - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && open) {
                e.preventDefault();
                pick(active);
              } else if (e.key === "Escape") setOpen(false);
            }}
          />
          <Icon name="search" size={18} className="pointer-events-none absolute top-[17px] right-3.5" />
          {open ? (
            // onMouseDown: tanlash `blur` dan oldin ishlashi uchun
            <ul
              id={listId}
              role="listbox"
              aria-label={t("university")}
              className="absolute z-20 mt-1 max-h-72 w-full list-none overflow-y-auto rounded-12 border-hair border-ink bg-white p-1"
            >
              {shown.map((u, i) => (
                <li
                  key={u.id}
                  role="option"
                  aria-selected={u.id === selected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(i);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer flex-col gap-px rounded-8 px-3 py-2", i === active && "bg-surface")}
                >
                  <span className="text-14 font-semibold">{u.name}</span>
                  <span className="text-12 text-muted">{[u.region, kinds(u.kind as "STATE")].join(" · ")}</span>
                </li>
              ))}
              {found.length > LIMIT ? <li className="px-3 py-2 text-12 text-muted">{t("universityMore", { n: found.length - LIMIT })}</li> : null}
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(shown.length);
                }}
                onMouseEnter={() => setActive(shown.length)}
                className={cn("cursor-pointer rounded-8 px-3 py-2.5 text-14 font-bold", active === shown.length && "bg-surface")}
              >
                {t("universityNotListed")}
              </li>
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

const initialName = (list: UniversityOption[], id: string) => list.find((u) => u.id === id)?.name ?? "";
