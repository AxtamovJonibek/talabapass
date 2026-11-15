import "server-only";
import { cookies } from "next/headers";
import { APP_COOKIE } from "@/lib/app-mode";

/** So'rov Capacitor ilovasidanmi (`tp_app` cookie, `src/lib/app-mode.ts`). Cookie o'qiydi — Suspense ichida chaqiring. */
export async function isAppRequest(): Promise<boolean> {
  return (await cookies()).get(APP_COOKIE)?.value === "1";
}
