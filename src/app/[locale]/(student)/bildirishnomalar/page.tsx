import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { Inbox } from "@/components/notifications/inbox";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { inboxItems } from "@/server/notifications/inbox";
import { vapidPublicKey } from "@/server/notifications/push";

async function StudentInbox() {
  const user = await requireRole("STUDENT");
  const items = await inboxItems(user.id, "/chegirmalar");
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Inbox items={items} vapidPublicKey={vapidPublicKey()} backHref="/chegirmalar" />
    </div>
  );
}

// Dizaynda yo'q: mavjud primitivlardan yig'ilgan (qo'ng'iroq → xabarlar ro'yxati)
export default async function StudentNotificationsPage({ params }: PageProps<"/[locale]/bildirishnomalar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentInbox />
    </Suspense>
  );
}
