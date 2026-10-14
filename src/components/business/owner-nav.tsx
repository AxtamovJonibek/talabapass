import { useTranslations } from "next-intl";
import { BottomNav } from "@/components/ui/bottom-nav";

export type OwnerTab = "scanner" | "discounts" | "stats" | "profile";

/** B5 pastki navigatsiyasi (biznes egasi, telefon): qora, faol band to'q sariq. */
export function OwnerBottomNav({ active }: { active: OwnerTab }) {
  const t = useTranslations("cashierNav");
  const nav = useTranslations("businessNav");
  return (
    <BottomNav
      tone="dark"
      label={nav("label")}
      items={[
        { href: "/biznes/skaner", icon: "scan", label: t("scanner"), active: active === "scanner" },
        { href: "/biznes/chegirmalar", icon: "ticket", label: t("discounts"), active: active === "discounts" },
        { href: "/biznes", icon: "chart", label: t("stats"), active: active === "stats" },
        { href: "/biznes/profil", icon: "store", label: t("profile"), active: active === "profile" },
      ]}
    />
  );
}
