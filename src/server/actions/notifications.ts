"use server";

import { getCurrentUser } from "../auth/session";
import { markInboxRead } from "../notifications/inbox";

/** Joriy foydalanuvchi (talaba yoki biznes egasi) o'z xabarlarini o'qilgan deb belgilaydi. Foydalanuvchi sessiyadan. */
export async function markInboxReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "STUDENT" && user.role !== "BUSINESS_OWNER")) return;
  await markInboxRead(user.id);
}
