"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { AvatarEditor } from "@/components/profile-image/avatar-editor";
import { COURSES, FACULTY_MAX } from "@/lib/profile";
import { updateProfileAction, type ProfileFormState } from "@/server/actions/student-profile";
import type { ProfileData } from "./profile-parts";

const IDLE: ProfileFormState = { status: "idle" };

/** "Shaxsiy ma'lumotlar": ism, familiya, kurs, fakultet, tuman (ixtiyoriy). Forma `action` bilan ulanadi. */
export function ProfileForm({ profile, districts, idPrefix }: { profile: ProfileData; districts: { id: string; name: string }[]; idPrefix: string }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(updateProfileAction, IDLE);
  const bad = (field: string) => state.status === "error" && state.fields.includes(field);
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="flex flex-col gap-4">
    <AvatarEditor kind="student" url={profile.avatarUrl} fallback={profile.initials} idPrefix={idPrefix} />
    <form action={formAction} className="flex flex-col gap-3.5">
      <Field label={t("profile.firstName")} htmlFor={id("firstName")} error={bad("firstName") ? t("profile.errName") : null}>
        <Input id={id("firstName")} name="firstName" defaultValue={profile.firstName} autoComplete="given-name" invalid={bad("firstName")} maxLength={40} />
      </Field>
      <Field label={t("profile.lastName")} htmlFor={id("lastName")} error={bad("lastName") ? t("profile.errName") : null}>
        <Input id={id("lastName")} name="lastName" defaultValue={profile.lastName} autoComplete="family-name" invalid={bad("lastName")} maxLength={40} />
      </Field>
      <Field label={t("course.label")} htmlFor={id("course")}>
        <Select id={id("course")} name="course" defaultValue={profile.course}>
          {COURSES.map((c) => (
            <option key={c} value={c}>
              {c === "MASTER" ? t("course.MASTER_long") : t("course.nth", { n: t(`course.${c}`) })}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("profile.faculty")} htmlFor={id("faculty")} error={bad("faculty") ? t("profile.errFaculty") : null}>
        <Input id={id("faculty")} name="faculty" defaultValue={profile.faculty} maxLength={FACULTY_MAX} />
      </Field>
      <Field label={t("profile.district")} htmlFor={id("districtId")} hint={t("profile.optional")} error={bad("districtId") ? t("profile.errDistrict") : null}>
        <Select id={id("districtId")} name="districtId" defaultValue={profile.districtId}>
          <option value="">{t("profile.districtNone")}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
      <p className="m-0 text-12 leading-[1.45] text-muted">{t("profile.districtHint")}</p>
      <Button type="submit" variant="blue" size="lg" disabled={pending} aria-busy={pending}>
        {t("profile.save")}
      </Button>
      {state.status === "saved" ? (
        <p role="status" data-testid="profile-saved" className="m-0 text-13 font-bold text-green">
          {t("profile.saved")}
        </p>
      ) : null}
    </form>
    </div>
  );
}
