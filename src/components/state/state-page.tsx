import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

type Props = {
  title: string;
  lead: string;
  /** Tugmalar (pastda) */
  children?: ReactNode;
  testId?: string;
};

/** Butun ekranli holat: oflayn, xato, topilmadi. Invite sahifasidagi (`/kassir/<token>` yaroqsiz) tartib bilan bir xil. */
export function StatePage({ title, lead, children, testId }: Props) {
  return (
    <main data-testid={testId} className="mx-auto flex min-h-dvh max-w-[440px] flex-col gap-3 bg-paper px-5 pt-14 pb-8 text-ink">
      <Logo size={17} />
      <h1 className="mt-6 mb-0 text-28 font-black tracking-[-0.03em] font-stretch-110%">{title}</h1>
      <p className="m-0 text-14 leading-[1.45] text-muted">{lead}</p>
      {children ? <div className="mt-auto flex flex-col gap-2.5 pt-6">{children}</div> : null}
    </main>
  );
}
