import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection, NextResponse, type NextRequest } from "next/server";
import { createTranslator } from "next-intl";
import type { z } from "zod";
import messages from "../../../messages/uz.json";
import { readLimited } from "../http/read-limited";
import { apiLocale, type ApiLocale } from "./rules";

/**
 * `/api/v1` uchun umumiy: bitta xato formati `{ error: { code, message, ...tafsilot } }`, JSON o'qish (hajm
 * chegarasi + zod), marshrut o'ramasi (kutilmagan xato — 500, ichki tafsilot mijozga chiqmaydi).
 */

export type ApiErrorCode = keyof typeof messages.api.errors;

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  token_expired: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  payload_too_large: 413,
  server_error: 500,
  invalid_phone: 400,
  too_soon: 429,
  daily_limit: 429,
  ip_limit: 429,
  sms_failed: 503,
  wrong_code: 400,
  code_expired: 400,
  code_locked: 429,
  account_blocked: 403,
  no_business: 403,
  admin_not_supported: 403,
  step_expired: 401,
  wrong_password: 401,
  password_locked: 429,
  weak_password: 400,
  password_mismatch: 400,
  refresh_invalid: 401,
  refresh_reused: 401,
  phone_in_use: 409,
  tin_taken: 409,
  not_editable: 409,
  student_not_approved: 403,
  file_empty: 400,
  file_bad_type: 415,
  file_too_large: 413,
  upload_not_allowed: 403,
  upload_daily_limit: 429,
  too_many_files: 409,
  deal_not_available: 404,
  deal_closed: 409,
  sold_out: 409,
  coupon_limit: 409,
  open_orders: 409,
  business_not_ready: 403,
  scan_invalid: 422,
  scan_expired: 409,
  scan_replayed: 409,
  scan_wrong_business: 403,
  scan_blocked: 409,
  scan_manual_locked: 429,
  scan_out_of_hours: 409,
  scan_limit: 409,
  scan_ticket: 409,
  order_not_confirmed: 409,
  order_closed: 409,
  order_conflict: 409,
  too_many_invites: 409,
  already_cashier: 409,
  social_invalid: 401,
  social_unavailable: 503,
  social_unreachable: 503,
  social_mismatch: 403,
  password_required: 400,
  invalid_credentials: 401,
  invalid_identifier: 400,
  password_setup_required: 403,
  wrong_current_password: 401,
  account_exists: 409,
  preorder_no_schedule: 400,
  preorder_no_price: 409,
  permission_denied: 403,
  active_limit: 409,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    /** Mijozga xato bilan birga: `fields`, `retryInSeconds`, `left`, `status` … */
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/**
 * Xato matni so'rov tilida (`Accept-Language`, ilova tanlagan til). Hozircha faqat o'zbekcha: ru/en matnlari
 * (`messages/ru.json` …) qo'shilganda shu yerga translator qo'shiladi, qolgan tillar uz ga tushadi.
 */
const ERROR_TEXT: Partial<Record<ApiLocale, (code: ApiErrorCode) => string>> = {
  uz: createTranslator({ locale: "uz", messages, namespace: "api.errors" }),
};
const NO_STORE = { "cache-control": "no-store" };

export function errorResponse(code: ApiErrorCode, details: Record<string, unknown> = {}, locale: ApiLocale = "uz"): NextResponse {
  const lang = ERROR_TEXT[locale] ? locale : "uz";
  const headers: Record<string, string> = { ...NO_STORE, "content-language": lang };
  if (typeof details.retryInSeconds === "number") headers["retry-after"] = String(details.retryInSeconds);
  return NextResponse.json({ error: { code, message: ERROR_TEXT[lang]!(code), ...details } }, { status: STATUS[code], headers });
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

type Ctx<P> = { params: Promise<P> };

/**
 * Marshrut o'ramasi: `ApiError` — o'z kodi bilan, boshqa xato — log'ga va 500.
 * `connection()` — har bir API javobi so'rov paytida hisoblanadi: `request` ni o'qimaydigan GET (`/app-config` — env,
 * `/districts` — baza) Cache Components'da build paytida statik qotib qolardi va env/baza o'zgarsa yangilanmasdi.
 */
export function route<P extends object = object>(handler: (request: NextRequest, ctx: Ctx<P>) => Promise<Response>) {
  return async (request: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      await connection();
      return await handler(request, ctx);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error.code, error.details, apiLocale(request.headers.get("accept-language")));
      // Next'ning ichki signallari (prerender'dan chiqish va h.k.) ushlanmaydi
      unstable_rethrow(error);
      console.error("API xatosi:", request.method, request.nextUrl.pathname, error);
      return errorResponse("server_error");
    }
  };
}

const JSON_LIMIT = 64 * 1024;

const issueFields = (error: z.ZodError) => [...new Set(error.issues.map((issue) => issue.path.join(".")).filter(Boolean))];

/** JSON tana (64 KB gacha; bo'sh tana — `{}`) zod sxemasi bilan. Xato — `invalid_request` + `fields`. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  const bytes = await readLimited(request, JSON_LIMIT);
  if (!bytes) throw new ApiError("payload_too_large");
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes).trim() || "{}");
  } catch {
    throw new ApiError("invalid_request");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError("invalid_request", { fields: issueFields(parsed.error) });
  return parsed.data;
}

/** So'rov satri parametrlari zod sxemasi bilan. */
export function readQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.infer<S> {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw new ApiError("invalid_request", { fields: issueFields(parsed.error) });
  return parsed.data;
}

/** Dinamik segment (`[id]`) — bazadagi cuid ko'rinishida bo'lmasa 404. */
export async function idParam(ctx: Ctx<{ id: string }>): Promise<string> {
  const { id } = await ctx.params;
  if (!/^[a-z0-9_]{10,40}$/.test(id)) throw new ApiError("not_found");
  return id;
}

/** So'rov yuborgan IP. nginx `x-real-ip`/`x-forwarded-for` ni o'zi qo'yadi (`phone-check.ts` dagi bilan bir xil). */
export function clientIpOf(request: Request): string {
  return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
