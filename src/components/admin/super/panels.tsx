import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { journalDetails, tashkentStamp } from "@/lib/journal";
import type { userAccount } from "@/server/admin/super";
import { CloseSessionButton } from "./controls";

type Account = NonNullable<Awaited<ReturnType<typeof userAccount>>>;
type JournalRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  createdAt: Date;
  actor: { firstName: string | null; lastName: string | null; role: string; id?: string; phone?: string | null } | null;
};

const name = (a: { firstName: string | null; lastName: string | null }) => [a.firstName, a.lastName].filter(Boolean).join(" ");

/** Kirish va xavfsizlik: usullar, parol vaqtlari (parolning o'zi emas), oxirgi kirishlar, faol sessiyalar */
export async function AccountPanel({ userId, account }: { userId: string; account: Account }) {
  const t = await getTranslations("adminSuper.account");
  const row = "flex flex-wrap gap-x-2 text-13";
  return (
    <section className="flex flex-col gap-3 rounded-14 border-hair border-line p-4" data-testid="account-panel" aria-label={t("title")}>
      <h3 className="m-0 text-15 font-extrabold">{t("title")}</h3>
      <div className={row}>
        <span className="text-muted">{t("methods")}:</span>
        <b data-testid="login-methods">{account.methods.length ? account.methods.map((m) => t(`method.${m}`)).join(", ") : t("noMethods")}</b>
      </div>
      {account.email ? (
        <div className={row}>
          <span className="text-muted">{t("email")}:</span>
          <span>{account.email}</span>
        </div>
      ) : null}
      <div className={row}>
        <span className="text-muted">{t("password")}:</span>
        {account.hasPassword ? (
          <span data-testid="password-times">
            {account.passwordSetAt ? t("passwordSet", { date: tashkentStamp(account.passwordSetAt) }) : null}
            {account.passwordChangedAt ? ` · ${t("passwordChanged", { date: tashkentStamp(account.passwordChangedAt) })}` : null}
          </span>
        ) : (
          <span className="text-warn">{t("passwordNone")}</span>
        )}
      </div>
      {account.passwordResetRequired ? <div className="text-13 font-bold text-warn">{t("resetPending")}</div> : null}
      {account.passwordLockedUntil && account.passwordLockedUntil > new Date() ? <div className="text-13 font-bold text-danger">{t("locked", { date: tashkentStamp(account.passwordLockedUntil) })}</div> : null}
      <div className={row}>
        <span className="text-muted">{t("lastLogin")}:</span>
        <span>{account.lastLoginAt ? tashkentStamp(account.lastLoginAt) : t("never")}</span>
      </div>
      <p className="m-0 text-12 text-muted">{t("passwordNote")}</p>

      <div>
        <h4 className="m-0 mb-1.5 text-13 font-extrabold">{t("logins")}</h4>
        {account.logins.length === 0 ? (
          <p className="m-0 text-12 text-muted">{t("noLogins")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="login-history">
            {account.logins.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-x-2 text-12">
                <span className="font-mono text-muted">{tashkentStamp(l.at)}</span>
                <b className={l.ok ? "text-green" : "text-danger"}>{l.ok ? t("loginOk") : t("loginFail")}</b>
                <span className="text-muted">{[l.method ? t(`method.${l.method as "phone"}`) : null, l.via ? t(`via.${l.via as "web"}`) : null, l.device].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="m-0 mb-1.5 text-13 font-extrabold">{t("sessions")}</h4>
        {account.sessions.length === 0 ? (
          <p className="m-0 text-12 text-muted">{t("noSessions")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="session-list">
            {account.sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-10 bg-paper px-3 py-2 text-12">
                <span className="flex min-w-0 flex-col">
                  <b>
                    {t(`sessionKind.${s.kind as "WEB"}`)}
                    {s.deviceName ? ` · ${s.deviceName}` : ""}
                  </b>
                  <span className="truncate text-muted">{s.userAgent ?? ""}</span>
                  <span className="text-muted">
                    {t("sessionSince", { date: tashkentStamp(s.createdAt) })}
                    {s.lastUsedAt ? ` · ${t("sessionLast", { date: tashkentStamp(s.lastUsedAt) })}` : ""}
                  </span>
                </span>
                <CloseSessionButton userId={userId} sessionId={s.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Jurnal yozuvlari: vaqt, kim, amal, obyekt, tafsilot (oldin → keyin) */
export async function JournalList({ rows, title, allHref }: { rows: JournalRow[]; title?: string; allHref?: string }) {
  const t = await getTranslations("adminSuper.journal");
  const roles = await getTranslations("adminSuper.roles");
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-15 font-extrabold">{title}</h3>
          {allHref ? (
            <Link href={allHref} className="tp-link text-13 font-bold text-ink">
              {t("all")}
            </Link>
          ) : null}
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="m-0 text-13 text-muted">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-13" data-testid="journal-table">
            <thead>
              <tr className="text-left text-12 text-muted">
                {(["time", "actor", "action", "object", "details"] as const).map((c) => (
                  <th key={c} className="border-0 border-b-[1.5px] border-solid border-ink p-2 font-semibold">
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="border-0 border-b border-solid border-surface p-2 font-mono whitespace-nowrap text-muted">{tashkentStamp(r.createdAt)}</td>
                  <td className="border-0 border-b border-solid border-surface p-2">
                    {r.actor ? (
                      <>
                        <b>{name(r.actor) || r.actor.phone || "—"}</b>
                        <div className="text-12 text-muted">{roles(r.actor.role as "ADMIN")}</div>
                      </>
                    ) : (
                      <span className="text-muted">{t("system")}</span>
                    )}
                  </td>
                  <td className="border-0 border-b border-solid border-surface p-2 font-mono font-semibold">{r.action}</td>
                  <td className="border-0 border-b border-solid border-surface p-2 text-12">
                    {r.entity}
                    {r.entityId ? <div className="font-mono text-muted">{r.entityId}</div> : null}
                  </td>
                  <td className="border-0 border-b border-solid border-surface p-2 text-12 text-muted">
                    {journalDetails(r.meta).map((line, i) => (
                      <div key={i} className="break-words">
                        {line}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
