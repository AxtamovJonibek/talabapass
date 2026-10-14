import { getTranslations } from "next-intl/server";
import type { Role } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { formatPhone } from "@/lib/format";
import { logoutAction } from "@/server/actions/auth";
import { requireRole } from "@/server/auth/session";
import { requireActiveStudent } from "@/server/auth/student";

type Area = "student" | "business" | "cashier" | "admin";

/**
 * Vaqtinchalik bosh sahifa: bo'lim hali qurilmagan, lekin rol himoyasi va chiqish ishlaydi.
 * Haqiqiy ekranlar keyingi bosqichlarda shu manzillarga keladi.
 */
export async function PlaceholderHome({ area, roles }: { area: Area; roles: Role[] }) {
  // Talaba ilovasi faqat tasdiqlangan (va guvohnomasi muddati o'tmagan) talabaga ochiladi.
  const user = area === "student" ? await requireActiveStudent() : await requireRole(...roles);
  const t = await getTranslations();
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || formatPhone(user.phone);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={20} tag={area === "admin" ? t("brand.admin") : area === "student" ? undefined : t("brand.business")} tagTone={area === "admin" ? "paper" : "orange"} />
      <h1 data-testid="area" className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">
        {t(`placeholder.${area}`)}
      </h1>
      <p className="m-0 text-15 text-muted">{t("placeholder.signedInAs", { name })}</p>
      {/* Kassir faqat o'z biznesini ko'radi (skaner 8-bosqichda) */}
      {user.role === "CASHIER" ? (
        <p data-testid="cashier-business" className="m-0 text-15 font-bold">
          {user.memberships.find((m) => m.role === "CASHIER")?.business.name}
        </p>
      ) : null}
      <p className="m-0 text-13 text-muted">{t("placeholder.comingSoon")}</p>
      <form action={logoutAction}>
        <Button type="submit" variant="danger-ghost" className="h-[50px]">
          {t("common.logout")}
        </Button>
      </form>
    </main>
  );
}
