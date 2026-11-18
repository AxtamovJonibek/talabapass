"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Link, useRouter } from "@/i18n/navigation";
import { PERMISSION_FLAGS, type BusinessPermissionSet } from "@/lib/permissions";
import {
  changeRoleAction,
  closeSessionsAction,
  createUserAction,
  deleteUserAction,
  removeLogoAdminAction,
  removePhotoAdminAction,
  requirePasswordResetAction,
  setBusinessBlockedAction,
  setPermissionsAction,
  setUserBlockedAction,
  type SuperActionResult,
  type SuperState,
} from "@/server/actions/admin-super";

/*
 * Super admin boshqaruv elementlari (dizaynda yo'q — mavjud primitivlardan). Xavfli amallar sahifa ichida tasdiq so'raydi
 * (`window.confirm` emas: matn aniq, klaviatura bilan ham ishlaydi). Natija va xato shu joyda yoziladi.
 */

type Run = () => Promise<SuperActionResult>;

function useRun(onDone?: (r: SuperActionResult) => void) {
  const t = useTranslations("adminSuper");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: Run) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: t("done") } : { ok: false, text: t(`errors.${(r.fields?.includes("reason") ? "reason" : r.error) ?? "failed"}` as "errors.failed") });
      if (r.ok) {
        onDone?.(r);
        router.refresh();
      }
    });
  return { run, pending, message };
}

function Message({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "m-0 text-13 font-bold text-green" : "m-0 text-13 font-bold text-danger"}>
      {message.text}
    </p>
  );
}

/** Tugma → tasdiq matni → "Tasdiqlash" / "Bekor" */
export function ConfirmAction({
  label,
  confirmText,
  run,
  danger = false,
  testId,
  onDone,
  children,
}: {
  label: string;
  confirmText: string;
  run: Run;
  danger?: boolean;
  testId?: string;
  onDone?: (r: SuperActionResult) => void;
  children?: ReactNode;
}) {
  const t = useTranslations("adminSuper");
  const [open, setOpen] = useState(false);
  const { run: go, pending, message } = useRun((r) => {
    setOpen(false);
    onDone?.(r);
  });
  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <div className="flex flex-col gap-2 rounded-12 bg-warn-bg p-3" role="group" aria-label={label}>
          <p className="m-0 text-13 leading-[1.45] text-warn">{confirmText}</p>
          {children}
          <div className="flex flex-wrap gap-2">
            <Button variant={danger ? "danger-outline" : "ink"} size="sm" loading={pending} data-testid={testId ? `${testId}-confirm` : undefined} onClick={() => go(run)}>
              {t("confirm")}
            </Button>
            <Button variant="outline-soft" size="sm" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant={danger ? "danger-outline" : "outline-soft"} size="sm" data-testid={testId} onClick={() => setOpen(true)} className="self-start">
          {label}
        </Button>
      )}
      <Message message={message} />
    </div>
  );
}

/** Foydalanuvchi amallari: sessiyalar, parolni tiklash, bloklash, rol, o'chirish */
export function UserActions({ userId, blocked, role, listHref }: { userId: string; blocked: boolean; role: string; listHref: string }) {
  const t = useTranslations("adminSuper.actions");
  const roles = useTranslations("adminSuper.roles");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [nextRole, setNextRole] = useState(role);
  return (
    <div className="flex flex-col gap-3" data-testid="user-actions">
      <div className="flex flex-wrap items-start gap-3">
        <ConfirmAction label={t("closeAll")} confirmText={t("closeAllConfirm")} run={() => closeSessionsAction({ userId })} testId="close-sessions" />
        <ConfirmAction label={t("resetPassword")} confirmText={t("resetPasswordConfirm")} run={() => requirePasswordResetAction({ userId })} testId="reset-password" />
        {blocked ? (
          <ConfirmAction label={t("unblock")} confirmText={t("unblock")} run={() => setUserBlockedAction({ userId, blocked: false })} testId="unblock-user" />
        ) : (
          <ConfirmAction label={t("block")} confirmText={t("blockReason")} run={() => setUserBlockedAction({ userId, blocked: true, reason })} danger testId="block-user">
            <Input aria-label={t("blockReason")} value={reason} onChange={(e) => setReason(e.target.value)} compact maxLength={200} data-testid="block-reason" />
          </ConfirmAction>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("role")} htmlFor={`role-${userId}`}>
          <Select native compact id={`role-${userId}`} value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
            {(["STUDENT", "BUSINESS_OWNER", "CASHIER"] as const).map((r) => (
              <option key={r} value={r}>
                {roles(r)}
              </option>
            ))}
          </Select>
        </Field>
        {nextRole !== role ? <ConfirmAction label={t("changeRole")} confirmText={t("changeRoleConfirm")} run={() => changeRoleAction({ userId, role: nextRole })} testId="change-role" /> : null}
      </div>
      <ConfirmAction label={t("delete")} confirmText={t("deleteConfirm")} run={() => deleteUserAction({ userId })} danger testId="delete-user" onDone={() => router.push(listHref)} />
    </div>
  );
}

export function CloseSessionButton({ userId, sessionId }: { userId: string; sessionId: string }) {
  const t = useTranslations("adminSuper.account");
  const { run, pending, message } = useRun();
  return (
    <span className="flex items-center gap-2">
      <Button variant="danger-ghost" size="sm" loading={pending} onClick={() => run(() => closeSessionsAction({ userId, sessionId }))}>
        {t("closeSession")}
      </Button>
      {message && !message.ok ? <Message message={message} /> : null}
    </span>
  );
}

const IDLE: SuperState = { status: "idle" };

/** Yangi foydalanuvchi: rol, ism, raqam va/yoki email (parol — o'zi "Parolni unutdim" bilan) */
export function CreateUserForm() {
  const t = useTranslations("adminSuper.create");
  const errors = useTranslations("adminSuper.errors");
  const roles = useTranslations("adminSuper.roles");
  const [state, action, pending] = useActionState(createUserAction, IDLE);
  const [role, setRole] = useState("STUDENT");
  const bad = (f: string) => state.status === "error" && state.fields.includes(f);
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="create-user">
      <p className="m-0 text-12 leading-[1.45] text-muted">{t("hint")}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
        <Field label={t("role")} htmlFor="new-role">
          <Select native compact id="new-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            {(["STUDENT", "BUSINESS_OWNER", "CASHIER"] as const).map((r) => (
              <option key={r} value={r}>
                {roles(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("firstName")} htmlFor="new-first" error={bad("firstName") ? errors("invalid") : null}>
          <Input id="new-first" name="firstName" compact maxLength={40} invalid={bad("firstName")} />
        </Field>
        <Field label={t("lastName")} htmlFor="new-last">
          <Input id="new-last" name="lastName" compact maxLength={40} />
        </Field>
        <Field label={t("phone")} htmlFor="new-phone" error={bad("phone") ? errors(state.status === "error" && state.error === "phoneInUse" ? "phoneInUse" : "contact") : null}>
          <Input id="new-phone" name="phone" type="tel" compact mono={14} placeholder="+998 90 123 45 67" invalid={bad("phone")} />
        </Field>
        <Field label={t("email")} htmlFor="new-email" error={bad("email") ? errors(state.status === "error" && state.error === "emailInUse" ? "emailInUse" : "invalid") : null}>
          <Input id="new-email" name="email" type="email" compact invalid={bad("email")} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="ink" size="sm" loading={pending}>
          {t("submit")}
        </Button>
        {state.status === "saved" && state.id ? (
          <span className="text-13 font-bold text-green" role="status">
            {t("created")} ·{" "}
            <Link href={`/admin/foydalanuvchilar?rol=${role}&id=${state.id}`} className="tp-link text-ink">
              {t("open")}
            </Link>
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** Biznes ruxsatlari: kalitlar va faol chegirmalar chegarasi */
export function PermissionsForm({ businessId, initial }: { businessId: string; initial: BusinessPermissionSet }) {
  const t = useTranslations("adminSuper.partners.permissions");
  const s = useTranslations("adminSuper");
  const [value, setValue] = useState(initial);
  const [max, setMax] = useState(initial.maxActiveDiscounts === null ? "" : String(initial.maxActiveDiscounts));
  const { run, pending, message } = useRun();
  const save = () => {
    const n = max.trim() === "" ? null : Number(max.replace(/\D/g, ""));
    run(() => setPermissionsAction({ businessId, permissions: { ...value, maxActiveDiscounts: n } }));
  };
  return (
    <div className="flex flex-col gap-3" data-testid="permissions-form">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {PERMISSION_FLAGS.map((flag) => (
          <li key={flag} className="flex items-center justify-between gap-3 text-14">
            <span>{t(flag)}</span>
            <Switch small checked={value[flag]} label={t(flag)} onChange={(on) => setValue((v) => ({ ...v, [flag]: on }))} id={`perm-${flag}`} />
          </li>
        ))}
      </ul>
      <Field label={t("maxActiveDiscounts")} htmlFor="perm-max" hint={t("maxHint")}>
        <Input id="perm-max" inputMode="numeric" compact mono={14} value={max} onChange={(e) => setMax(e.target.value)} className="max-w-[160px]" />
      </Field>
      <p className="m-0 text-12 leading-[1.45] text-muted">{t("note")}</p>
      <div className="flex items-center gap-3">
        <Button variant="ink" size="sm" loading={pending} onClick={save} data-testid="permissions-save">
          {s("save")}
        </Button>
        <Message message={message} />
      </div>
    </div>
  );
}

export function BusinessBlockControl({ businessId, blocked }: { businessId: string; blocked: boolean }) {
  const t = useTranslations("adminSuper.partners");
  const a = useTranslations("adminSuper.actions");
  const [reason, setReason] = useState("");
  return blocked ? (
    <ConfirmAction label={t("unblock")} confirmText={t("unblock")} run={() => setBusinessBlockedAction({ businessId, blocked: false })} />
  ) : (
    <ConfirmAction label={t("block")} confirmText={t("blockConfirm")} run={() => setBusinessBlockedAction({ businessId, blocked: true, reason })} danger>
      <Input aria-label={a("blockReason")} placeholder={a("blockReason")} value={reason} onChange={(e) => setReason(e.target.value)} compact maxLength={200} />
    </ConfirmAction>
  );
}

/** Rasmni xom tana bilan yuklash (`/api/admin/yuklash`) */
async function upload(query: string, file: File): Promise<SuperActionResult> {
  const response = await fetch(`/api/admin/yuklash?${query}&nom=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
  const body = (await response.json().catch(() => null)) as SuperActionResult | null;
  return body ?? { ok: false, error: "failed" };
}

export function UploadButton({ query, label, testId }: { query: string; label: string; testId?: string }) {
  const { run, pending, message } = useRun();
  return (
    <span className="flex flex-col gap-1">
      <label className={`tp-btn tp-paint inline-flex h-9 w-fit cursor-pointer items-center rounded-10 border-hair border-line bg-white px-3 text-13 font-bold ${pending ? "opacity-60" : ""}`}>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          data-testid={testId}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) run(() => upload(query, file));
          }}
        />
      </label>
      <Message message={message && !message.ok ? message : null} />
    </span>
  );
}

export function RemoveLogoButton({ businessId }: { businessId: string }) {
  const t = useTranslations("adminSuper.partners");
  const { run, pending } = useRun();
  return (
    <Button variant="danger-ghost" size="sm" loading={pending} onClick={() => run(() => removeLogoAdminAction({ businessId }))}>
      {t("remove")}
    </Button>
  );
}

export function RemovePhotoButton({ docId }: { docId: string }) {
  const t = useTranslations("adminSuper.partners");
  const { run, pending } = useRun();
  return (
    <Button variant="danger-ghost" size="sm" loading={pending} onClick={() => run(() => removePhotoAdminAction({ docId }))}>
      {t("remove")}
    </Button>
  );
}
