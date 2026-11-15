import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/server/api/http";
import { requireApiRole } from "@/server/api/session";
import { submitBusiness } from "@/server/business/registration";

const PROBLEMS = { notEditable: "not_editable", noRegistration: "no_registration", noPhotos: "no_photos", consent: "consent_required" } as const;

/** Arizani tekshiruvga yuborish: guvohnoma, kamida bitta foto va shartlarga rozilik (audit'ga shartlar versiyasi bilan). */
export const POST = route(async (request) => {
  const { user } = await requireApiRole(request, "BUSINESS_OWNER");
  const body = await readJson(request, z.object({ consent: z.boolean() }));
  const result = await submitBusiness(user.id, body.consent);
  if (!result.ok) throw new ApiError(PROBLEMS[result.problem]);
  return ok({ ok: true, status: "PENDING" });
});
