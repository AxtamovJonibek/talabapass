"use client";

import { PhoneOrWeb } from "@/components/student/responsive";
import type { BusinessInfo } from "@/lib/business";
import { RegisterMobile } from "./register-mobile";
import { RegisterWeb } from "./register-web";
import { useBusinessRegistration, type ExistingDoc } from "./use-business-registration";

type Props = {
  verifiedPhone: string | null;
  /** Kirgan egasining yuborilmagan yoki rad etilgan arizasi */
  initial?: (BusinessInfo & { phone: string }) | null;
  docs?: ExistingDoc[];
  rejectReason?: string | null;
  signedIn?: boolean;
};

/** Biznes arizasi: bitta holat, ikki ko'rinish (B1 telefon, WB1 veb). */
export function BusinessRegisterScreen({ rejectReason, signedIn = false, ...props }: Props) {
  const r = useBusinessRegistration({ ...props, signedIn });
  return <PhoneOrWeb phone={<RegisterMobile r={r} rejectReason={rejectReason} />} web={<RegisterWeb r={r} rejectReason={rejectReason} />} />;
}
