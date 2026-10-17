import type { NotFoundText } from "@/components/state/not-found-screen";

type StateMessages = {
  notFoundEyebrow: string;
  notFoundTitle: string;
  notFoundLead: string;
  notFoundLeadPhone: string;
  notFoundBack: string;
  notFoundPrimary: string;
  notFoundSecondary: string;
};

/** `state` xabarlaridan 404 ekrani matni (global-not-found'da `messages` to'g'ridan-to'g'ri, `[locale]` ichida `getMessages`). */
export function notFoundText(m: StateMessages): NotFoundText {
  return {
    eyebrow: m.notFoundEyebrow,
    title: m.notFoundTitle,
    leadWeb: m.notFoundLead,
    leadPhone: m.notFoundLeadPhone,
    back: m.notFoundBack,
    primary: m.notFoundPrimary,
    secondary: m.notFoundSecondary,
  };
}
