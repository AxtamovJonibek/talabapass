"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { unblockBusinessAction, unblockUserAction } from "@/server/actions/admin-blocked";

/** "Blokdan chiqarish": tasdiq so'raydi; bajarilgach ro'yxat yangilanadi. */
export function UnblockButton({ kind, id }: { kind: "student" | "business"; id: string }) {
  const t = useTranslations("admin.blocked");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function unblock() {
    if (!window.confirm(t(kind === "student" ? "confirmStudent" : "confirmBusiness"))) return;
    setFailed(false);
    startTransition(async () => {
      const result = kind === "student" ? await unblockUserAction({ userId: id }) : await unblockBusinessAction({ businessId: id });
      if (!result.ok) return setFailed(true);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {failed ? (
        <span role="alert" className="text-12 font-semibold text-danger">
          {t("failed")}
        </span>
      ) : null}
      <button type="button" disabled={pending} aria-busy={pending} onClick={unblock} className="tp-lift h-8 rounded-8 border-hair border-line bg-white px-2.5 font-sans text-13 font-semibold text-ink disabled:opacity-50">
        {t("unblock")}
      </button>
    </span>
  );
}
