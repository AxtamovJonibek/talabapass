import { Suspense } from "react";
import { connection } from "next/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { HelpScreen } from "@/components/student/help-screen";
import { requireActiveStudent } from "@/server/auth/student";
import { activeCouponCount } from "@/server/coupons/coupons";
import { supportContacts } from "@/server/support";

// Yordam markazi: savollar + aloqa (ilovadan chiqmaydi)
async function HelpContent() {
  await connection();
  const user = await requireActiveStudent();
  return <HelpScreen contacts={supportContacts()} coupons={await activeCouponCount(user.id)} />;
}

export default function StudentHelpPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HelpContent />
    </Suspense>
  );
}
