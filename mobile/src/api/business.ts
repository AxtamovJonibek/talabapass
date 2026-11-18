import type { LocalFile, SignedIn } from "./endpoints";
import { deviceName, fileForm, query } from "./endpoints";
import { api } from "./client";

/** Biznes ilovasi (egasi va kassir) — docs/api-v1.md "Biznes ilovasi". Javob tiplari saytdagi server tiplari bilan bir xil. */

export type Period = 1 | 7 | 30;
export type PaymentType = "CASH" | "CARD" | "QR";

export type ScanPreview = {
  couponId: string;
  code: string;
  ticket: string;
  student: { name: string; initials: string; university: string; course: string };
  title: string;
  badge: string;
  originalPrice: number | null;
  discountAmount: number | null;
  /** null — narxsiz chegirma: kassir summani kiritadi */
  finalPrice: number | null;
  percent: number | null;
  bogo: boolean;
  limit: "DAILY" | "WEEKLY" | "UNLIMITED";
  nth: number;
};

export type BookingKind = "APPOINTMENT" | "PREPAID_PICKUP" | "PICKUP_WINDOW";

export type OrderScan = {
  orderId: string;
  code: string;
  ticket: string;
  title: string;
  quantity: number;
  kind: BookingKind;
  slot: string;
  validUntil: string | null;
  student: { name: string; initials: string; phone: string };
  note: string | null;
  prepayAmount: number;
  totalFinal: number;
  dueNow: number;
};

/** B3 sarlavhasi */
export type ScanSummary = { business: { name: string }; cashierName: string; todaySales: number; lastSale: { student: string; item: string; at: string } | null };

export type ScanResult = { kind: "coupon"; preview: ScanPreview } | { kind: "order"; order: OrderScan };

export type Receipt = {
  id: string;
  no: string;
  business: { name: string; address: string; tin: string | null };
  time: string;
  createdAt: string;
  student: string;
  cashier: string;
  item: string;
  badge: string;
  originalPrice: number;
  discountAmount: number;
  paidAmount: number;
  paymentType: PaymentType;
  category: { icon: string; tile: string; ink: string };
};

export type SaleRow = {
  id: string;
  at: string;
  receiptNo: number;
  student: string;
  university: string;
  item: string;
  cashier: string;
  originalPrice: number;
  discountAmount: number;
  paid: number;
  payment: PaymentType;
};

export type Sales = { rows: SaleRow[]; count: number; sum: number; page: number; pages: number; staff: { id: string; name: string; owner: boolean }[] | null };

export type DiscountStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "REJECTED" | "ENDED";
export type DiscountType = "PERCENT" | "FIXED_PRICE" | "BOGO";
export type StudentLimit = "DAILY" | "WEEKLY" | "UNLIMITED";

export type Stats = {
  business: { id: string; name: string };
  period: Period;
  kpi: { sold: number; delta: { kind: "abs" | "pct"; value: number } | null; revenue: number; average: number; discount: number; fresh: number; returningPercent: number };
  chart: { hourly: boolean; bars: { key: string; count: number; current: boolean }[] };
  funnel: { views: number; qr: number; sold: number };
  /** cells: [hafta kuni 0–6 (Du=0), soat, soni] — faqat bo'sh bo'lmaganlari */
  heat: { hours: number[]; cells: [number, number, number][]; busiest: { weekday: number; from: number; to: number; count: number } | null; quietest: number | null };
  universities: { name: string; count: number }[];
  offers: StatsOffer[];
  offerTotals: { views: number; qr: number; sold: number; revenue: number; discount: number };
  sales: { id: string; at: string; receiptNo: number; student: string; university: string; item: string; cashier: string; paid: number }[];
  cashiers: { rows: { name: string; count: number }[]; rejected: number };
  /** Excel hisobot — imzoli nisbiy havola */
  reportUrl: string;
};

export type StatsOffer = {
  id: string;
  title: string;
  type: DiscountType;
  percent: number | null;
  originalPrice: number | null;
  newPrice: number | null;
  status: DiscountStatus;
  ended: boolean;
  views: number;
  qr: number;
  sold: number;
  revenue: number;
  discount: number;
};

/** Saytdagi `DiscountDraft` (src/lib/discount.ts) */
export type DiscountDraft = {
  title: string;
  type: DiscountType;
  originalPrice: number | null;
  percent: number | null;
  newPrice: number | null;
  /** 1 = dushanba … 7 = yakshanba */
  weekdays: number[];
  fromMinute: number | null;
  toMinute: number | null;
  dailyLimit: number | null;
  perStudentLimit: StudentLimit;
  /** "YYYY-MM-DD" (Toshkent) */
  startsOn: string;
  endsOn: string;
  terms: string;
};

export type OwnerDiscount = {
  id: string;
  title: string;
  type: DiscountType;
  originalPrice: number | null;
  percent: number | null;
  newPrice: number | null;
  weekdays: number[];
  fromMinute: number;
  toMinute: number;
  dailyLimit: number;
  endsOn: string;
  status: DiscountStatus;
  rejectReason: string | null;
  soldToday: number;
  image: string | null;
};

export type DiscountForm = { id: string; status: DiscountStatus; rejectReason: string | null; draft: DiscountDraft; images: { id: string; url: string }[] };

export type Cashiers = {
  canInvite: boolean;
  cashiers: { memberId: string; firstName: string | null; lastName: string | null; phone: string; scansToday: number; shift: "on" | "ended" | "none" }[];
  invites: { id: string; expiresAt: string; phone: string | null }[];
};

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CONFIRMED" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED" | "NO_SHOW" | "EXPIRED";
export type OrderFilter = "new" | "preparing" | "ready" | "done";

export type BusinessOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  title: string;
  quantity: number;
  kind: BookingKind;
  /** Eski buyurtmalarda: olib ketish / joyida */
  mode?: "PICKUP" | "DINE_IN" | null;
  slotStart: string;
  slotEnd: string;
  note: string | null;
  phone: string;
  student: string;
  totalFinal: number;
  prepay: "FULL" | "PARTIAL" | "NONE";
  prepayAmount: number;
  /** Shu vaqtgacha javob berilmasa — avtomatik bekor */
  confirmBy: string | null;
  rejectReason: string | null;
};

export type Orders = {
  enabled: boolean;
  orders: BusinessOrder[];
  counts: Record<OrderFilter, number>;
  newIds: string[];
  report: { orders: number; completed: number; revenue: number; cancelled: number; noShow: number };
  now: number;
};

export type BusinessProfile = {
  id: string;
  name: string;
  address: string;
  landmark: string | null;
  workingHours: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "WARNED" | "REJECTED" | "BLOCKED";
  publicPhone: string | null;
  telegram: string | null;
  instagram: string | null;
  kind: string;
  typeLabel: string | null;
  district: string | null;
  logoUrl: string | null;
  salesToday: number;
  revenueToday: number;
  activeDiscounts: number;
  preorderEnabled: boolean;
};

export type ProfileEdit = { name: string; address: string; workingHours: string; description: string; landmark: string; phone: string; telegram: string; instagram: string };

const enc = encodeURIComponent;

export const bizApi = {
  registerCashier: (body: { registrationTicket: string; firstName: string; lastName: string }) =>
    api<SignedIn>("/cashier/register", { method: "POST", body: { ...body, deviceName }, auth: false }),
  scanSummary: () => api<ScanSummary>("/business/scan"),
  scan: (input: { qr: string } | { code: string; totp: string }) => api<ScanResult>("/business/scan", { method: "POST", body: input }),
  confirm: (body: { couponId: string; ticket: string; paymentType: PaymentType; amount?: number | null }) =>
    api<{ receipt: Receipt; pdfUrl: string }>("/business/scan/confirm", { method: "POST", body }),
  completeOrder: (orderId: string, ticket: string) => api<{ ok: true }>(`/business/orders/${enc(orderId)}`, { method: "POST", body: { action: "complete", ticket } }),
  decideOrder: (orderId: string, action: "accept" | "ready" | "reject", reason?: string) =>
    api<{ ok: true }>(`/business/orders/${enc(orderId)}`, { method: "POST", body: action === "reject" ? { action, reason: reason ?? "" } : { action } }),
  orders: (filter: OrderFilter) => api<Orders>(`/business/orders?filter=${filter}`),
  sales: (period: Period, page: number, cashier?: string | null) =>
    api<Sales>(`/business/sales${query({ period: String(period), page: String(page), ...(cashier ? { cashier } : {}) })}`),
  receipt: (receiptId: string) => api<{ receipt: Receipt; pdfUrl: string }>(`/receipts/${enc(receiptId)}`),
  stats: (period: Period) => api<Stats>(`/business/stats?period=${period}`),
  discounts: () => api<{ discounts: OwnerDiscount[] }>("/business/discounts"),
  discount: (discountId: string) => api<DiscountForm>(`/business/discounts/${enc(discountId)}`),
  saveDiscount: (discountId: string | null, draft: DiscountDraft, intent: "draft" | "publish") =>
    discountId
      ? api<{ id: string; status: DiscountStatus }>(`/business/discounts/${enc(discountId)}`, { method: "PATCH", body: { draft, intent } })
      : api<{ id: string; status: DiscountStatus }>("/business/discounts", { method: "POST", body: { draft, intent } }),
  setDiscountActive: (discountId: string, active: boolean) =>
    api<{ ok: true; status: DiscountStatus }>(`/business/discounts/${enc(discountId)}/active`, { method: "POST", body: { active } }),
  uploadDiscountImage: async (discountId: string, file: LocalFile) =>
    api<{ id: string; url: string }>(`/business/discounts/${enc(discountId)}/images`, { method: "POST", form: await fileForm(file) }),
  removeDiscountImage: (imageId: string) => api<{ ok: true }>(`/business/discount-images/${enc(imageId)}`, { method: "DELETE" }),
  cashiers: () => api<Cashiers>("/business/cashiers"),
  inviteCashier: (phone: string) => api<{ invite: { id: string; phone: string; expiresAt: string } }>("/business/cashiers", { method: "POST", body: { phone } }),
  removeCashier: (memberId: string) => api<{ ok: true }>(`/business/cashiers/${enc(memberId)}`, { method: "DELETE" }),
  revokeInvite: (inviteId: string) => api<{ ok: true }>(`/business/invites/${enc(inviteId)}`, { method: "DELETE" }),
  profile: () => api<{ profile: BusinessProfile }>("/business/profile"),
  editProfile: (body: ProfileEdit) => api<{ ok: true; rereview: boolean }>("/business/profile", { method: "PATCH", body }),
  uploadLogo: async (file: LocalFile) => api<{ ok: true }>("/business/logo", { method: "POST", form: await fileForm(file) }),
  removeLogo: () => api<{ ok: true }>("/business/logo", { method: "DELETE" }),
};
