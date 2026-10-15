"use client";

import { PhoneOrWeb } from "@/components/student/responsive";
import type { DiscountDraft } from "@/lib/discount";
import type { Category } from "./editor-parts";
import { EditorMobile } from "./editor-mobile";
import { EditorWeb, type VisitHint } from "./editor-web";
import { useDiscountEditor } from "./use-discount-editor";

type Props = {
  id: string | null;
  images: { id: string; url: string }[];
  initial: DiscountDraft | null;
  today: string;
  category: Category;
  businessName: string;
  statusText: string | null;
  businessPending: boolean;
  live: boolean;
  hint: VisitHint;
};

/** Chegirma muharriri: bitta holat, ikki ko'rinish (B2 telefon, WB2 veb). */
export function DiscountEditorScreen({ id, images, initial, today, hint, ...view }: Props) {
  const e = useDiscountEditor({ id, initial, images, today });
  return <PhoneOrWeb phone={<EditorMobile e={e} {...view} />} web={<EditorWeb e={e} hint={hint} {...view} />} />;
}
