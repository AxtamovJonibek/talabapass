import { getTranslations } from "next-intl/server";
import { restrictions, type BusinessPermissionSet, type RestrictionKey } from "@/lib/permissions";
import { ownerPermissions } from "@/server/business/permissions";

type Key = RestrictionKey;

/**
 * Admin o'chirgan ruxsatlar (biznes paneli): sahifaga tegishlilari ogohlantirish blokida aniq yoziladi — tugma jimgina
 * ishlamay qolmasin. `only` — shu sahifaga tegishli kalitlar. Hech biri cheklanmagan bo'lsa — hech narsa chizilmaydi.
 */
export async function PermissionNotice({ ownerId, only }: { ownerId: string; only: Key[] }) {
  const [permissions, t] = await Promise.all([ownerPermissions(ownerId), getTranslations("permissions")]);
  const shown = restrictions(permissions).filter((k) => only.includes(k));
  if (shown.length === 0) return null;
  return <PermissionNoticeView permissions={permissions} keys={shown} title={t("title")} text={(k) => (k === "maxActiveDiscounts" ? t("maxActiveDiscounts", { max: permissions.maxActiveDiscounts ?? 0 }) : t(k))} />;
}

function PermissionNoticeView({ keys, title, text }: { permissions: BusinessPermissionSet; keys: Key[]; title: string; text: (k: Key) => string }) {
  return (
    <div role="status" data-testid="permission-notice" className="flex flex-col gap-1 rounded-14 bg-warn-bg px-4 py-3 text-13 leading-[1.45] text-warn">
      <b className="text-14">{title}</b>
      {keys.map((k) => (
        <span key={k} data-permission={k}>
          {text(k)}
        </span>
      ))}
    </div>
  );
}
