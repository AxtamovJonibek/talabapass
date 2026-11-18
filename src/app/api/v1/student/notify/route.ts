import { z } from "zod";
import { ok, readJson, route } from "@/server/api/http";
import { limit } from "@/server/api/rate-limit";
import { requireApiStudent } from "@/server/api/session";
import { setNotifyDeals } from "@/server/student/profile";

/** "Yangi chegirmalar haqida xabar" kaliti (saytdagi T8 bilan bir xil): `{ on: boolean }` → `{ notify }` */
export const POST = route(async (request) => {
  const { user } = await requireApiStudent(request);
  await limit("write", user.id);
  const { on } = await readJson(request, z.object({ on: z.boolean() }));
  await setNotifyDeals(user.id, on);
  return ok({ notify: on });
});
