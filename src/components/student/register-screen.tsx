"use client";

import { RegisterDesktop } from "./register-desktop";
import { RegisterMobile } from "./register-form";
import { PhoneOrWeb } from "./responsive";
import { useRegistration } from "./use-registration";

type Props = {
  universities: { id: string; name: string }[];
  verifiedPhone: string | null;
};

/** Talaba ro'yxati, 1-qadam: bitta holat, ikki ko'rinish (T1 telefon, WT1 veb). */
export function RegisterScreen(props: Props) {
  const registration = useRegistration(props.verifiedPhone);
  return <PhoneOrWeb phone={<RegisterMobile registration={registration} {...props} />} web={<RegisterDesktop registration={registration} {...props} />} />;
}
