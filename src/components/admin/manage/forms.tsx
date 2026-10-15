"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BUSINESS_KINDS } from "@/lib/business";
import { COURSES } from "@/lib/profile";
import {
  createAdminAction,
  deleteUniversityAction,
  editBusinessAction,
  editUserAction,
  rejectRequestAction,
  resolveRequestAction,
  saveUniversityAction,
  updateOwnNameAction,
  type ManageState,
} from "@/server/actions/admin-manage";

const IDLE: ManageState = { status: "idle" };

/** Maydon xatosi / umumiy xato / "Saqlandi" xabari bitta joyda. */
function useManageForm(action: (prev: ManageState, form: FormData) => Promise<ManageState>) {
  const t = useTranslations("adminManage");
  const [state, formAction, pending] = useActionState(action, IDLE);
  const bad = (field: string) => state.status === "error" && state.fields.includes(field);
  const error = (field: string) => (bad(field) ? t(`errors.${field}` as "errors.phone") : null);
  const general = state.status === "error" && state.error && !state.fields.length ? t(`errors.${state.error}` as "errors.notFound") : null;
  return { t, state, formAction, pending, bad, error, general };
}

function Notes({ form }: { form: ReturnType<typeof useManageForm> }) {
  const { t, state, general } = form;
  return (
    <>
      {state.status === "saved" ? (
        <p role="status" data-testid="manage-saved" className="m-0 text-13 font-bold text-green">
          {t("saved")}
        </p>
      ) : null}
      {general ? (
        <p role="alert" className="m-0 text-13 font-bold text-danger">
          {general}
        </p>
      ) : null}
    </>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3">{children}</div>;
}

type Person = { firstName: string; lastName: string; phone?: string };

/** Admin o'z ismi-familiyasini o'zgartiradi. */
export function OwnNameForm({ me }: { me: Person }) {
  const f = useManageForm(updateOwnNameAction);
  return (
    <form action={f.formAction} className="flex flex-col gap-3">
      <Grid>
        <Field label={f.t("profile.firstName")} htmlFor="own-first" error={f.error("firstName")}>
          <Input id="own-first" name="firstName" defaultValue={me.firstName} autoComplete="given-name" invalid={f.bad("firstName")} maxLength={40} />
        </Field>
        <Field label={f.t("profile.lastName")} htmlFor="own-last" error={f.error("lastName")}>
          <Input id="own-last" name="lastName" defaultValue={me.lastName} autoComplete="family-name" invalid={f.bad("lastName")} maxLength={40} />
        </Field>
      </Grid>
      <Button type="submit" variant="blue" size="md" disabled={f.pending} className="self-start">
        {f.t("save")}
      </Button>
      <Notes form={f} />
    </form>
  );
}

/** Yangi admin qo'shish. */
export function NewAdminForm() {
  const f = useManageForm(createAdminAction);
  const form = useRef<HTMLFormElement>(null);
  // Qo'shilgach maydonlar tozalanadi (xabar qoladi)
  useEffect(() => {
    if (f.state.status === "saved") form.current?.reset();
  }, [f.state]);
  return (
    <form ref={form} action={f.formAction} className="flex flex-col gap-3">
      <Grid>
        <Field label={f.t("profile.firstName")} htmlFor="new-first" error={f.error("firstName")}>
          <Input id="new-first" name="firstName" autoComplete="off" invalid={f.bad("firstName")} maxLength={40} />
        </Field>
        <Field label={f.t("profile.lastName")} htmlFor="new-last" error={f.error("lastName")}>
          <Input id="new-last" name="lastName" autoComplete="off" invalid={f.bad("lastName")} maxLength={40} />
        </Field>
        <Field label={f.t("profile.phone")} htmlFor="new-phone" error={f.state.status === "error" && f.state.error === "phoneInUse" ? f.t("errors.phoneInUse") : f.error("phone")}>
          <Input id="new-phone" name="phone" type="tel" inputMode="tel" mono={14} placeholder="+998 90 123 45 67" autoComplete="off" invalid={f.bad("phone")} />
        </Field>
      </Grid>
      <p className="m-0 text-13 leading-[1.5] text-muted">{f.t("profile.newNote")}</p>
      <Button type="submit" variant="blue" size="md" disabled={f.pending} className="self-start">
        {f.t("profile.newSubmit")}
      </Button>
      {f.state.status === "saved" ? (
        <p role="status" data-testid="manage-saved" className="m-0 text-13 font-bold text-green">
          {f.t("profile.created")}
        </p>
      ) : null}
      {f.general ? <p role="alert" className="m-0 text-13 font-bold text-danger">{f.general}</p> : null}
    </form>
  );
}

export type StudentFields = {
  course: string;
  faculty: string;
  universityId: string;
  districtId: string;
  cardNumber: string;
  cardExpiresAt: string;
  publicId: string;
};

/** Foydalanuvchi: ism, familiya, telefon (+ talaba maydonlari). */
export function UserEditForm({
  userId,
  person,
  student,
  universities,
  districts,
}: {
  userId: string;
  person: Required<Person>;
  student: StudentFields | null;
  universities: { id: string; name: string; active: boolean }[];
  districts: { id: string; name: string }[];
}) {
  const f = useManageForm(editUserAction);
  const phoneError = f.state.status === "error" && f.state.error === "phoneInUse" ? f.t("errors.phoneInUse") : f.error("phone");
  return (
    <form action={f.formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="userId" value={userId} />
      <Grid>
        <Field label={f.t("profile.firstName")} htmlFor="u-first" error={f.error("firstName")}>
          <Input id="u-first" name="firstName" defaultValue={person.firstName} invalid={f.bad("firstName")} maxLength={40} />
        </Field>
        <Field label={f.t("profile.lastName")} htmlFor="u-last" error={f.error("lastName")}>
          <Input id="u-last" name="lastName" defaultValue={person.lastName} invalid={f.bad("lastName")} maxLength={40} />
        </Field>
        <Field label={f.t("profile.phone")} htmlFor="u-phone" error={phoneError}>
          <Input id="u-phone" name="phone" type="tel" inputMode="tel" mono={14} defaultValue={person.phone} invalid={f.bad("phone")} />
        </Field>
      </Grid>
      <p className="m-0 text-12 text-muted">{f.t("users.phoneNote")}</p>
      {student ? (
        <>
          <h3 className="m-0 mt-1 text-16 font-extrabold">{f.t("users.studentTitle")}</h3>
          <Grid>
            <Field label={f.t("users.university")} htmlFor="u-uni" error={f.error("universityId")}>
              <Select id="u-uni" name="universityId" defaultValue={student.universityId} invalid={f.bad("universityId")}>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.t("users.course")} htmlFor="u-course" error={f.error("course")}>
              <Select id="u-course" name="course" defaultValue={student.course} invalid={f.bad("course")}>
                {COURSES.map((c) => (
                  <option key={c} value={c}>
                    {c === "MASTER" ? "Magistratura" : `${c.slice(1)}-kurs`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.t("users.faculty")} htmlFor="u-faculty" error={f.error("faculty")}>
              <Input id="u-faculty" name="faculty" defaultValue={student.faculty} maxLength={80} invalid={f.bad("faculty")} />
            </Field>
            <Field label={f.t("users.district")} htmlFor="u-district" error={f.error("districtId")}>
              <Select id="u-district" name="districtId" defaultValue={student.districtId} invalid={f.bad("districtId")}>
                <option value="">{f.t("users.districtNone")}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={f.t("users.cardNumber")} htmlFor="u-card" error={f.error("cardNumber") ?? (f.state.status === "error" && f.state.error === "cardInUse" ? f.t("errors.cardInUse") : null)}>
              <Input id="u-card" name="cardNumber" mono={14} defaultValue={student.cardNumber} maxLength={30} invalid={f.bad("cardNumber")} />
            </Field>
            <Field label={f.t("users.cardExpires")} htmlFor="u-expires" hint={f.t("users.cardExpiresHint")} error={f.error("cardExpiresAt")}>
              <Input id="u-expires" name="cardExpiresAt" mono={14} defaultValue={student.cardExpiresAt} placeholder="2027-09-01" invalid={f.bad("cardExpiresAt")} />
            </Field>
          </Grid>
        </>
      ) : null}
      <Button type="submit" variant="blue" size="md" disabled={f.pending} className="self-start">
        {f.t("save")}
      </Button>
      <Notes form={f} />
    </form>
  );
}

export type BusinessFields = {
  id: string;
  name: string;
  legalName: string;
  tin: string;
  kind: string;
  typeLabel: string;
  address: string;
  landmark: string;
  workingHours: string;
  description: string;
  contactName: string;
  contactPhone: string;
  publicPhone: string;
  telegram: string;
  instagram: string;
};

/** Biznes ma'lumotlari (admin). */
export function BusinessAdminForm({ business, kindLabels }: { business: BusinessFields; kindLabels: Record<string, string> }) {
  const f = useManageForm(editBusinessAction);
  const text = (name: keyof BusinessFields, opts: { mono?: 14; max?: number; type?: string } = {}) => (
    <Field label={f.t(`business.${name}` as "business.name")} htmlFor={`b-${name}`} error={f.error(name) ?? (name === "tin" && f.state.status === "error" && f.state.error === "tinInUse" ? f.t("errors.tinInUse") : null)}>
      <Input id={`b-${name}`} name={name} type={opts.type} mono={opts.mono} defaultValue={business[name]} maxLength={opts.max} invalid={f.bad(name)} />
    </Field>
  );
  return (
    <form action={f.formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="businessId" value={business.id} />
      <Grid>
        {text("name", { max: 60 })}
        {text("legalName", { max: 120 })}
        {text("tin", { mono: 14, max: 20 })}
        <Field label={f.t("business.kind")} htmlFor="b-kind" error={f.error("kind")}>
          <Select id="b-kind" name="kind" defaultValue={business.kind} invalid={f.bad("kind")}>
            {BUSINESS_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabels[k] ?? k}
              </option>
            ))}
          </Select>
        </Field>
        {text("typeLabel", { max: 40 })}
        {text("workingHours", { max: 60 })}
        {text("address", { max: 160 })}
        {text("landmark", { max: 80 })}
        {text("contactName", { max: 60 })}
        {text("contactPhone", { mono: 14, type: "tel" })}
        {text("publicPhone", { mono: 14, type: "tel" })}
        {text("telegram", { max: 80 })}
        {text("instagram", { max: 80 })}
      </Grid>
      <Field label={f.t("business.description")} htmlFor="b-description" error={f.error("description")}>
        <Textarea id="b-description" name="description" rows={2} maxLength={120} defaultValue={business.description} invalid={f.bad("description")} />
      </Field>
      <p className="m-0 text-12 text-muted">{f.t("users.businessNote")}</p>
      <Button type="submit" variant="blue" size="md" disabled={f.pending} className="self-start">
        {f.t("save")}
      </Button>
      <Notes form={f} />
    </form>
  );
}

export type UniversityFields = { id: string; name: string; shortName: string; region: string; kind: string; active: boolean };

/** Universitet qo'shish (`university` yo'q) yoki tahrirlash. `requestId` berilsa — so'rovdan yangi universitet. */
export function UniversityForm({
  university,
  regions,
  kindLabels,
  defaultName = "",
  requestId,
  submitLabel,
  idPrefix = "uni",
}: {
  university?: UniversityFields;
  regions: string[];
  kindLabels: Record<string, string>;
  defaultName?: string;
  requestId?: string;
  submitLabel?: string;
  idPrefix?: string;
}) {
  const f = useManageForm(requestId ? resolveRequestAction : saveUniversityAction);
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <form
      key={university?.id ?? "new"}
      action={f.formAction}
      className="flex flex-col gap-3"
    >
      {university ? <input type="hidden" name="id" value={university.id} /> : null}
      {requestId ? <input type="hidden" name="requestId" value={requestId} /> : null}
      <Grid>
        <Field label={f.t("universities.name")} htmlFor={id("name")} error={f.error("name") ?? (f.state.status === "error" && f.state.error === "nameInUse" ? f.t("errors.nameInUse") : null)}>
          <Input id={id("name")} name="name" defaultValue={university?.name ?? defaultName} maxLength={160} invalid={f.bad("name")} />
        </Field>
        <Field label={f.t("universities.shortName")} htmlFor={id("short")} error={f.error("shortName")}>
          <Input id={id("short")} name="shortName" defaultValue={university?.shortName} maxLength={24} invalid={f.bad("shortName")} />
        </Field>
        <Field label={f.t("universities.regionField")} htmlFor={id("region")} error={f.error("region")}>
          <Input id={id("region")} name="region" list={id("regions")} defaultValue={university?.region ?? "Toshkent shahri"} maxLength={60} invalid={f.bad("region")} />
          <datalist id={id("regions")}>
            {regions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field label={f.t("universities.kindField")} htmlFor={id("kind")} error={f.error("kind")}>
          <Select id={id("kind")} name="kind" defaultValue={university?.kind ?? "STATE"} invalid={f.bad("kind")}>
            {(["STATE", "PRIVATE", "FOREIGN"] as const).map((k) => (
              <option key={k} value={k}>
                {kindLabels[k]}
              </option>
            ))}
          </Select>
        </Field>
      </Grid>
      <label className="flex items-center gap-2 text-14 font-semibold">
        <input type="checkbox" name="active" defaultChecked={university?.active ?? true} className="size-4 accent-ink" />
        {f.t("universities.activeField")}
      </label>
      <Button type="submit" variant="blue" size="md" disabled={f.pending} className="self-start">
        {submitLabel ?? f.t("save")}
      </Button>
      <Notes form={f} />
    </form>
  );
}

/** So'rovni mavjud universitetga biriktirish. */
export function LinkRequestForm({ requestId, universities }: { requestId: string; universities: { id: string; name: string }[] }) {
  const f = useManageForm(resolveRequestAction);
  return (
    <form
      action={f.formAction}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <Select native compact name="universityId" required aria-label={f.t("universities.requestLink")} defaultValue="" className="max-w-full min-w-[220px] flex-1">
        <option value="" disabled>
          {f.t("universities.requestLinkPlaceholder")}
        </option>
        {universities.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="outline" size="sm" disabled={f.pending}>
        {f.t("universities.requestApply")}
      </Button>
      <Notes form={f} />
    </form>
  );
}

/** Oddiy amallar (universitetni o'chirish, so'rovni rad etish): tasdiq so'raydi; sahifa server tomonda yangilanadi. */
export function ActionButton({ kind, id, label, confirm }: { kind: "deleteUniversity" | "rejectRequest"; id: string; label: string; confirm?: string }) {
  const t = useTranslations("adminManage");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant="danger-outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => {
            const result = kind === "deleteUniversity" ? await deleteUniversityAction(id) : await rejectRequestAction(id);
            setError(result.status === "error" ? (result.error ?? "notFound") : null);
          });
        }}
      >
        {label}
      </Button>
      {error ? (
        <span role="alert" className="text-12 font-bold text-danger">
          {t(`errors.${error}` as "errors.notFound")}
        </span>
      ) : null}
    </span>
  );
}
