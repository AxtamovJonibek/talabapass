"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { passwordRules } from "@/lib/password";
import { mountGoogleButton } from "@/lib/social-web";
import { OTHER_UNIVERSITY, searchUniversities, UNIVERSITY_NAME_MAX, type UniversityOption } from "@/lib/universities";
import type { WebAuthCopy } from "@/lib/web-auth-copy";

/** Parol maydoni: ko'rsatish/yashirish tugmasi bilan. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  autoFocus,
  copy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  autoFocus?: boolean;
  copy: WebAuthCopy["password"];
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className="pr-12"
      />
      <button
        type="button"
        aria-label={visible ? copy.hide : copy.show}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="tap absolute top-0 right-1 flex h-13 w-11 items-center justify-center border-0 bg-transparent p-0 text-muted"
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/**
 * Parol qoidalari: yozilguncha kulrang, bajarilsa yashil; qizil — faqat "Davom etish" bosilgandan keyin
 * (`submitted`) va hali bajarilmaganlari.
 */
export function PasswordRules({ value, submitted, copy }: { value: string; submitted: boolean; copy: WebAuthCopy["password"] }) {
  const rules = passwordRules(value);
  const items = [
    { ok: rules.length, text: copy.ruleLength },
    { ok: rules.mix, text: copy.ruleMix },
  ];
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-live="polite">
      {items.map(({ ok, text }) => (
        <li key={text} data-ok={ok} className={cn("flex items-center gap-2 text-13 font-semibold", ok ? "text-green" : submitted ? "text-danger" : "text-muted")}>
          <span className="flex size-4 items-center justify-center">
            {ok ? <Icon name="tick" size={16} strokeWidth={2.6} /> : <span className="size-1.5 rounded-full bg-current" />}
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

/** Google'ning rasmiy tugmasi (`renderButton`): ID token olinganda `onToken`. Yuklanmasa — tugma o'rniga xabar chiqmaydi, bosish yo'q. */
export function GoogleButton({ clientId, onToken, onFail }: { clientId: string | null; onToken: (idToken: string) => void; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onToken, onFail });
  useEffect(() => {
    callbacks.current = { onToken, onFail };
  });
  useEffect(() => {
    const node = host.current;
    if (!clientId || !node) return;
    let alive = true;
    mountGoogleButton(node, clientId, node.getBoundingClientRect().width, (token) => alive && callbacks.current.onToken(token)).catch(() => alive && callbacks.current.onFail());
    return () => {
      alive = false;
    };
  }, [clientId]);
  return <div ref={host} data-testid="google-button" className="flex min-h-10 w-full justify-center" />;
}

/** Universitet: qidiruv + ro'yxat; oxirgi qator — "Ro'yxatda yo'q" (nom matn bilan). */
export function UniversitySelect({
  universities,
  copy,
  id,
  value,
  other,
  onChange,
  invalid,
  otherInvalid,
}: {
  universities: UniversityOption[];
  copy: WebAuthCopy["studentForm"];
  id: string;
  value: string;
  other: string;
  onChange: (value: string, other: string) => void;
  invalid?: boolean;
  otherInvalid?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = universities.find((u) => u.id === value);
  const found = useMemo(() => searchUniversities(universities, query).slice(0, 8), [universities, query]);

  if (value === OTHER_UNIVERSITY) {
    return (
      <div className="flex flex-col gap-2">
        <Input
          id={id}
          value={other}
          maxLength={UNIVERSITY_NAME_MAX}
          placeholder={copy.universityOtherPlaceholder}
          aria-label={copy.universityOtherLabel}
          invalid={otherInvalid}
          autoFocus
          onChange={(e) => onChange(OTHER_UNIVERSITY, e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            onChange("", "");
          }}
          className="tp-link self-start border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink underline"
        >
          {copy.university}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={copy.universitySearch}
        value={open ? query : (selected?.name ?? query)}
        invalid={invalid}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("", "");
        }}
      />
      {open ? (
        <ul id={`${id}-list`} role="listbox" className="absolute top-full right-0 left-0 z-10 m-0 mt-1 max-h-64 list-none overflow-auto rounded-12 border-hair border-ink bg-white p-1">
          {found.map((u) => (
            <li
              key={u.id}
              role="option"
              aria-selected={u.id === value}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(u.id, "");
                setQuery(u.name);
                setOpen(false);
              }}
              className="cursor-pointer rounded-9 px-3 py-2 text-14 font-semibold hover:bg-surface"
            >
              {u.name}
              <span className="block text-12 font-normal text-muted">{u.region}</span>
            </li>
          ))}
          {found.length === 0 ? <li className="px-3 py-2 text-13 text-muted">{copy.universityEmpty}</li> : null}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(OTHER_UNIVERSITY, query.trim().slice(0, UNIVERSITY_NAME_MAX));
              setOpen(false);
            }}
            className="cursor-pointer rounded-9 px-3 py-2 text-14 font-bold hover:bg-surface"
          >
            {copy.universityOther}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
