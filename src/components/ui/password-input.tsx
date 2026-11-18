"use client";

import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type Props = Omit<ComponentProps<"input">, "type" | "size"> & {
  invalid?: boolean;
  toggleLabels: { show: string; hide: string };
};

/**
 * Parol maydoni (sayt, W2 dagi `Input` bilan bir xil: 52px, 1.5px chegara, 12px radius) + ko'rsatish/yashirish tugmasi.
 * Dizaynda chizilmagan — mavjud maydon primitividan.
 */
export function PasswordInput({ invalid, toggleLabels, className, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className={cn(
        "box-border flex h-13 items-center rounded-12 border-hair bg-white pl-3.5 focus-within:border-ink",
        invalid ? "border-danger" : "border-line",
        className,
      )}
    >
      <input
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-15 text-ink outline-none"
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? toggleLabels.hide : toggleLabels.show}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="tp-lift flex size-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-muted"
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} />
      </button>
    </div>
  );
}
