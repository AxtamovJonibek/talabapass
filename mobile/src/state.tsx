import { router, type Href } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { dropTokens, onSignedOut, setTokens } from "@/api/client";
import { authApi, type Intent, type LocalFile, type Me, type SignedIn, type VerifyResult } from "@/api/endpoints";
import { clearOffline, rememberMe } from "@/lib/offline";
import { forgetLastPhone, getLastPhone, setLastPhone } from "@/storage";
import { localDigits } from "@/lib/phone";

/**
 * Ilova holati: sessiya (kirgan foydalanuvchi) va kirish/ro'yxat oqimi (ekranlar orasida: telefon, qadam tokeni,
 * ro'yxat tokeni, biznes arizasi qoralamasi). Oqim xotirada — ilova qayta ochilsa, kirgan foydalanuvchi o'z qadamidan
 * davom etadi (`routeFor`), kirmagan esa telefondan boshlaydi.
 */

export type PickedFile = LocalFile & { uploaded?: boolean };

export type BusinessDraft = {
  name: string;
  kind: string;
  address: string;
  workingHours: string;
  tin: string;
  description: string;
  contactName: string;
  logo: PickedFile | null;
  /** Serverda allaqachon bor guvohnoma (qayta kirishda) yoki yangi tanlangani */
  registration: (PickedFile & { serverId?: string }) | null;
  photos: (PickedFile & { serverId?: string })[];
  consent: boolean;
  /** Serverdagi ariza bilan to'ldirilganmi (qayta kirishda) */
  loaded: boolean;
};

export const emptyDraft = (): BusinessDraft => ({
  name: "",
  kind: "CAFE",
  address: "",
  workingHours: "",
  tin: "",
  description: "",
  contactName: "",
  logo: null,
  registration: null,
  photos: [],
  consent: false,
  loaded: false,
});

export type Flow = {
  intent: Intent;
  /** 9 raqam, +998 siz */
  phone: string;
  /** Kod qayta yuborilishi mumkin bo'lgan vaqt (ms) */
  resendAt: number;
  verify: VerifyResult | null;
  registrationTicket: string | null;
  /** Google/Apple bilan kelgan yangi foydalanuvchi: ro'yxat formasi shu bilan oldindan to'ldiriladi (telefon yo'q) */
  social: { firstName: string; lastName: string; email: string | null } | null;
  business: BusinessDraft;
};

const initialFlow = (): Flow => ({ intent: "student", phone: "", resendAt: 0, verify: null, registrationTicket: null, social: null, business: emptyDraft() });

type Ctx = {
  me: Me | null;
  flow: Flow;
  setFlow: (patch: Partial<Flow> | ((f: Flow) => Partial<Flow>)) => void;
  setDraft: (patch: Partial<BusinessDraft>) => void;
  signIn: (result: SignedIn) => Promise<Me>;
  signOut: () => Promise<void>;
  reloadMe: () => Promise<Me>;
  /** Internetsiz ishga tushish: oxirgi saqlangan `me` (kupon ekrani uchun) */
  restoreMe: (me: Me) => void;
  /** Hisob o'chirilgandan keyin: tokenlar va qurilmadagi nusxalar tozalanadi (server sessiyani o'zi yopgan) */
  forget: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [flow, setFlowState] = useState<Flow>(initialFlow);
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  const setFlow = useCallback<Ctx["setFlow"]>((patch) => setFlowState((f) => ({ ...f, ...(typeof patch === "function" ? patch(f) : patch) })), []);
  const setDraft = useCallback((patch: Partial<BusinessDraft>) => setFlowState((f) => ({ ...f, business: { ...f.business, ...patch } })), []);

  const signIn = useCallback(async (result: SignedIn) => {
    await setTokens(result.tokens);
    // Google/Apple hisobi — "Qayta xush kelibsiz" (telefon) ekrani ko'rsatilmaydi
    if (result.user.phone) await setLastPhone(localDigits(result.user.phone));
    else await forgetLastPhone();
    await clearOffline();
    void rememberMe(result.user);
    setMe(result.user);
    return result.user;
  }, []);

  const reloadMe = useCallback(async () => {
    const { user } = await authApi.me();
    void rememberMe(user);
    setMe(user);
    return user;
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    await dropTokens();
    await clearOffline();
    setMe(null);
    setFlowState(initialFlow());
    resetTo((await getLastPhone()) ? "/auth/returning" : "/auth");
  }, []);

  // Server sessiyani yopdi (refresh rad etildi, bloklandi, boshqa qurilmada parol tiklandi) — kirish ekraniga
  useEffect(
    () =>
      onSignedOut(() => {
        void clearOffline();
        if (!meRef.current) return;
        setMe(null);
        setFlowState(initialFlow());
        void getLastPhone().then((last) => resetTo(last ? "/auth/returning" : "/auth"));
      }),
    [],
  );

  const forget = useCallback(async () => {
    await dropTokens();
    await clearOffline();
    await forgetLastPhone();
    setMe(null);
    setFlowState(initialFlow());
  }, []);

  const value = useMemo(
    () => ({ me, flow, setFlow, setDraft, signIn, signOut, reloadMe, restoreMe: setMe, forget }),
    [me, flow, setFlow, setDraft, signIn, signOut, reloadMe, forget],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppStateProvider yo'q");
  return ctx;
}

/** Tarixni tozalab, yangi ekranga (kirgandan keyin "orqaga" kirish ekranlariga qaytmasin). */
export function resetTo(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/** Kirgan foydalanuvchi qayerda bo'lishi kerak (saytdagi `studentPathFor` / biznes holatlari bilan bir xil). */
export function routeFor(me: Me): Href {
  if (me.role === "STUDENT" && me.student) {
    switch (me.student.status) {
      case "DRAFT":
      case "EXPIRED":
        return "/student/card";
      case "PENDING":
      case "REJECTED":
        return "/student/review";
      case "APPROVED":
        return "/deals";
      default:
        return "/home";
    }
  }
  if (me.role === "BUSINESS_OWNER") {
    const b = me.business;
    if (!b || b.status === "REJECTED" || (b.status === "PENDING" && !b.submitted)) return "/business/info";
    if (b.status === "PENDING") return "/business/review";
    // Biznes ilovasi faqat tasdiqlangan biznesga (bloklangan egasi umuman kira olmaydi)
    if (b.status === "APPROVED" || b.status === "WARNED") return "/panel/stats";
  }
  if (me.role === "CASHIER" && me.business) return "/panel/scan";
  return "/home";
}
