"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export type DropdownOption<V extends string> = { value: V; label: string; disabled?: boolean };

type DropdownProps<V extends string> = {
  id?: string;
  /** Ekran o'qigichlar uchun nom ("Saralash") */
  label: string;
  value: V;
  options: DropdownOption<V>[];
  onChange: (value: V) => void;
  /** `md` — 44px (lenta boshqaruv qatori) */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Saralash ro'yxati: chip ko'rinishidagi tugma, ochilganda kartochka ro'yxat, tanlangani belgili.
 * Klaviatura: ↑ ↓ Home End — yurish, Enter / Probel — tanlash, Esc — yopish. Fokus tugmada qoladi (aria-activedescendant).
 */
export function Dropdown<V extends string>({ id, label, value, options, onChange, size = "sm", className }: DropdownProps<V>) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<CSSProperties>({});
  const current = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const hide = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", hide);
    window.addEventListener("wheel", hide, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", hide);
      window.removeEventListener("wheel", hide);
    };
  }, [open]);

  const show = () => {
    // Ro'yxat `fixed`: gorizontal suriladigan qator ichida ham kesilmaydi
    const r = root.current?.getBoundingClientRect();
    if (r) setPlace({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const pick = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  };
  const move = (step: 1 | -1) => {
    const at = enabled.indexOf(active);
    setActive(enabled[(at + step + enabled.length) % enabled.length] ?? active);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        show();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(enabled[0] ?? 0);
        break;
      case "End":
        e.preventDefault();
        setActive(enabled[enabled.length - 1] ?? 0);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-activedescendant={open ? `${uid}-${active}` : undefined}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(
          "box-border flex items-center gap-2 border-hair border-line bg-white font-sans text-14 text-ink transition-[scale,background-color,border-color] duration-150 ease-out hover:bg-surface active:scale-[0.97] aria-expanded:border-ink",
          size === "md" ? "h-11 rounded-22 px-4 font-bold whitespace-nowrap" : "h-[38px] rounded-19 px-3.5 font-semibold",
        )}
      >
        <span className="text-muted">{label}:</span>
        {current?.label}
        <Icon name="chevronDown" size={14} strokeWidth={2.6} className={cn("transition-[rotate] duration-150 ease-out", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          id={`${uid}-list`}
          role="listbox"
          aria-label={label}
          style={place}
          className="fixed z-30 m-0 min-w-[240px] list-none rounded-16 border-hair border-line bg-white p-1.5 shadow-card-hover starting:-translate-y-1 starting:opacity-0 transition-[translate,opacity] duration-150 ease-out"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${uid}-${i}`}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled || undefined}
              onPointerEnter={() => !o.disabled && setActive(i)}
              onClick={() => pick(i)}
              className={cn(
                "flex h-11 cursor-pointer items-center gap-2 rounded-10 px-3 text-14 font-semibold",
                o.disabled ? "cursor-default text-placeholder" : "text-ink",
                i === active && !o.disabled && "bg-surface",
              )}
            >
              <span className="flex-1">{o.label}</span>
              {o.value === value ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
