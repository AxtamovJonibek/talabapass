import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { BusinessShell } from "@/components/business/business-shell";
import { Inbox } from "@/components/notifications/inbox";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { inboxItems } from "@/server/notifications/inbox";
import { vapidPublicKey } from "@/server/notifications/push";

async function OwnerInbox() {
  const user = await requireRole("BUSINESS_OWNER");
  const items = await inboxItems(user.id, "/biznes");
  return (
    <BusinessShell active="notifications">
      <Inbox items={items} vapidPublicKey={vapidPublicKey()} backHref="/biznes" />
    </BusinessShell>
  );
}

// Dizaynda yo'q: mavjud primitivlardan yig'ilgan
export default async function BusinessNotificationsPage({ params }: PageProps<"/[locale]/biznes/bildirishnomalar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OwnerInbox />
    </Suspense>
  );
}
