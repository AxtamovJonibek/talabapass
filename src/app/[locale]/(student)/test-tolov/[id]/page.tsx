import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { MockCheckout } from "@/components/student/orders/mock-checkout";
import { requireActiveStudent } from "@/server/auth/student";
import { db } from "@/server/db";
import { devShortcutsAllowed } from "@/server/env-check";

// SOXTA to'lov sahifasi ("Test to'lov") — faqat ishlab chiqish va sinov serveri. Production'da 404.
async function MockCheckoutContent({ params }: { params: PageProps<"/[locale]/test-tolov/[id]">["params"] }) {
  const user = await requireActiveStudent();
  if (!devShortcutsAllowed()) notFound();
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) notFound();
  const payment = await db.payment.findFirst({
    where: { id, provider: "mock", order: { studentId: user.id } },
    select: { id: true, amount: true, status: true, order: { select: { id: true, title: true, quantity: true, business: { select: { name: true } } } } },
  });
  if (!payment) notFound();
  return (
    <MockCheckout
      paymentId={payment.id}
      orderId={payment.order.id}
      amount={payment.amount}
      title={`${payment.order.title} × ${payment.order.quantity}`}
      business={payment.order.business.name}
      open={payment.status === "CREATED"}
    />
  );
}

export default function MockCheckoutPage({ params }: PageProps<"/[locale]/test-tolov/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MockCheckoutContent params={params} />
    </Suspense>
  );
}
