import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatMinute, toTashkent } from "@/lib/time";
import { MarkRead } from "./mark-read";
import { PushToggle } from "./push-toggle";

export type InboxItem = { id: string; title: string; body: string; at: Date; unread: boolean; href: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** Xabarlar qutisi (talaba va biznes egasi uchun bir xil): push yoqish bloki + ro'yxat. Yangilari belgilanadi va ochilgach o'qilgan bo'ladi. */
export async function Inbox({ items, vapidPublicKey, backHref }: { items: InboxItem[]; vapidPublicKey: string | null; backHref: string }) {
  const t = await getTranslations("notifications.inbox");
  const unread = items.some((i) => i.unread);
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3.5 px-[clamp(16px,4vw,24px)] pt-7 pb-12">
      <Link href={backHref} className="tp-link text-14 font-bold text-ink no-underline">
        ← {t("back")}
      </Link>
      <h1 className="m-0 text-36 leading-none font-black font-stretch-112% tracking-[-0.035em]">{t("title")}</h1>
      {vapidPublicKey ? <PushToggle publicKey={vapidPublicKey} /> : null}
      {items.length === 0 ? (
        <p className="m-0 rounded-16 bg-white p-5 text-14 text-muted">{t("empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {items.map((item) => {
            const local = toTashkent(item.at);
            const date = `${pad(local.date.getUTCDate())}.${pad(local.date.getUTCMonth() + 1)} ${formatMinute(local.minute)}`;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn("tp-card block rounded-16 border-hair p-4 text-ink no-underline", item.unread ? "border-ink bg-white" : "border-line bg-white")}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-15 font-extrabold">
                      {item.unread ? <span aria-label={t("unread")} className="mr-2 inline-block size-2 rounded-full bg-orange align-middle" /> : null}
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-12 text-muted">{date}</span>
                  </div>
                  <div className="mt-1 text-14 leading-[1.4] text-muted">{item.body}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {unread ? <MarkRead /> : null}
    </div>
  );
}
