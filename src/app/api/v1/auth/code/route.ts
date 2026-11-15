import { z } from "zod";
import { requestCode } from "@/server/api/auth-flow";
import { clientIpOf, ok, readJson, route } from "@/server/api/http";

/** SMS kod so'rash. Chegaralar — saytdagi bilan bir xil (`otp.ts`): raqamga 60 s da 1 ta, kuniga 5 ta, IP'dan soatiga 10 ta. */
export const POST = route(async (request) => {
  const body = await readJson(request, z.object({ phone: z.string().max(32) }));
  return ok(await requestCode(body.phone, clientIpOf(request)));
});
