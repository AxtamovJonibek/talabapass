import Constants from "expo-constants";
import { File as FsFile } from "expo-file-system";
import { Platform } from "react-native";
import { compressImage } from "@/lib/image";
import { FileTooLargeError, MAX_FILE_BYTES } from "@/lib/pick";
import { api } from "./client";

/** `/api/v1` javob tiplari va chaqiruvlar — docs/api-v1.md bilan bir xil. */

export type Intent = "student" | "business";
export type StudentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "BLOCKED";
export type BusinessStatus = "PENDING" | "APPROVED" | "WARNED" | "REJECTED" | "BLOCKED";

export type Me = {
  id: string;
  /** null — Google/Apple bilan ochilgan hisob */
  phone: string | null;
  email: string | null;
  role: "STUDENT" | "BUSINESS_OWNER" | "CASHIER" | "ADMIN";
  firstName: string | null;
  lastName: string | null;
  hasPassword: boolean;
  /** true — ichkariga o'tishdan oldin parol o'rnatish/almashtirish majburiy (`POST /me/password`) */
  mustSetPassword: boolean;
  passwordChangedAt: string | null;
  student: {
    status: StudentStatus;
    publicId: string;
    course: string;
    faculty: string | null;
    districtId: string | null;
    cardExpiresAt: string | null;
    university: { id: string; name: string; shortName: string };
  } | null;
  business: { id: string; name: string; status: BusinessStatus; submitted: boolean; rejectReason: string | null; memberRole: string } | null;
};

export type TokenPair = { tokenType: "Bearer"; accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string };
export type SignedIn = { tokens: TokenPair; user: Me };

/** Ro'yxat turi: `cashier` — yangi raqamga biznes egasi kassir taklifini yuborgan ("Biznes" bilan kirilganda) */
export type NewRole = Intent | "cashier";

/** Ro'yxat kodi, "Parolni unutdim" kodi yoki Google/Apple yangi foydalanuvchisi → parol qadami */
export type VerifyResult = { next: "setPassword"; ticket: string; role: NewRole; isNew: boolean; businessName?: string };

export type SetPasswordResult = ({ next: "signedIn" } & SignedIn) | { next: "register"; registrationTicket: string; role: NewRole };

export type SocialProvider = "GOOGLE" | "APPLE";
/** Google/Apple: hisob bor — kirish; yo'q — avval parol (majburiy), keyin ro'yxat (`profile` — formani oldindan to'ldirish uchun) */
export type SocialResult =
  | ({ next: "signedIn" } & SignedIn)
  | { next: "setPassword"; role: Intent; ticket: string; profile: { firstName: string | null; lastName: string | null; email: string | null } };

export type University = { id: string; name: string; shortName: string; region: string; kind: string };

export type StudentStatusView = {
  status: StudentStatus;
  cardExpiresAt: string | null;
  verification: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; fileName: string; rejectReason: string | null; createdAt: string; queuePosition: number | null } | null;
};

export type BusinessInfo = { name: string; kind: string; address: string; workingHours: string; description: string; tin: string; contactName: string };

export type Application = BusinessInfo & {
  id: string;
  description: string | null;
  contactName: string | null;
  status: BusinessStatus;
  submittedAt: string | null;
  rejectReason: string | null;
  editable: boolean;
  hasLogo: boolean;
  documents: { id: string; kind: "REGISTRATION" | "PHOTO"; fileName: string }[];
};

export type Point = { lat: number; lng: number };

/** Lenta kartasi — saytdagi `FeedDeal` (src/lib/feed.ts). Vaqtlar ISO (UTC), daqiqalar Toshkent vaqtida. */
export type FeedDeal = {
  id: string;
  title: string;
  businessId: string;
  store: string;
  typeLabel: string | null;
  district: string | null;
  address: string;
  landmark: string | null;
  category: string;
  icon: string;
  /** Nisbiy manzillar (`/api/chegirma/rasm/<id>`) — `API_URL` ga qo'shib */
  images: string[];
  tile: string;
  ink: string;
  badge: string;
  price: { now: number; old: number | null } | null;
  note: string | null;
  percent: number;
  fromMinute: number;
  toMinute: number;
  live: boolean;
  closesAt: string | null;
  opensAt: string | null;
  lastDay: boolean;
  left: number;
  total: number;
  point: Point | null;
  distanceKm: number | null;
  createdAt: string;
};

export type Category = { slug: string; name: string; icon: string; tileColor: string; inkColor: string };

export type CouponView = {
  id: string;
  discountId: string;
  code: string;
  /** base64url — QR va 6 raqamli kod shu bilan qurilmada hisoblanadi */
  secret: string;
  expiresAt: string;
  title: string;
  store: string;
  badge: string;
  price: { now: number; old: number | null } | null;
  note: string | null;
  student: { name: string; initials: string; university: string; course: string };
};

export type DealDetail = {
  deal: FeedDeal;
  description: string | null;
  terms: string | null;
  weekdays: number[];
  fromMinute: number;
  toMinute: number;
  perStudentLimit: string;
  endsOn: string;
  business: {
    name: string;
    logoUrl: string | null;
    phone: string | null;
    telegram: string | null;
    instagram: string | null;
    typeLabel: string | null;
    district: string | null;
    address: string;
    landmark: string | null;
    workingHours: string | null;
    point: Point | null;
  };
  nearby: { id: string; badge: string; store: string; live: boolean; opensAt: string | null; distanceKm: number }[];
  saved: boolean;
  coupon: CouponView | null;
};

export type CouponState = { status: "ACTIVE"; coupon: CouponView } | { status: "REDEEMED"; redemptionId: string | null } | { status: "CLOSED" };

export type InboxItem = { id: string; title: string; body: string; at: string; unread: boolean; link: { type: "HOME" | "CATEGORY" | "DISCOUNT"; id: string | null }; href: string };

export type Place = { id: string; name: string; lat: number; lng: number };

/** Masofa nuqtasi so'rov parametrida: GPS (`lat`/`lng`), tuman yoki viloyat */
export type Origin = { lat: number; lng: number } | { districtId: string } | { regionId: string } | null;

function originParams(origin: Origin): Record<string, string> {
  if (!origin) return {};
  if ("lat" in origin) return { lat: String(origin.lat), lng: String(origin.lng) };
  return "districtId" in origin ? { districtId: origin.districtId } : { regionId: origin.regionId };
}

export const query = (params: Record<string, string>) => {
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : "";
};

/** Qurilmadagi fayl (kamera, galereya, hujjat tanlash) */
export type LocalFile = { uri: string; name: string; type: string };

/** Sessiyalar ro'yxatida ko'rinadigan qurilma nomi ("iPhone 15", aks holda platforma) */
export const deviceName = (Constants.deviceName ?? (Platform.OS === "ios" ? "iOS" : "Android")).slice(0, 80);

export const authApi = {
  requestCode: (phone: string) => api<{ phone: string; resendInSeconds: number }>("/auth/code", { method: "POST", body: { phone }, auth: false }),
  verify: (phone: string, code: string, intent: Intent) => api<VerifyResult>("/auth/verify", { method: "POST", body: { phone, code, intent }, auth: false }),
  /** Kirish SMSsiz: telefon raqam yoki email + parol */
  login: (identifier: string, password: string) => api<SignedIn>("/auth/login", { method: "POST", body: { identifier, password, deviceName }, auth: false }),
  /** "Parolni unutdim": javob hisob borligidan qat'i nazar bir xil */
  forgot: (identifier: string) => api<{ channel: "sms" | "email"; resendInSeconds: number }>("/auth/forgot", { method: "POST", body: { identifier }, auth: false }),
  forgotVerify: (identifier: string, code: string) => api<{ next: "setPassword"; ticket: string }>("/auth/forgot/verify", { method: "POST", body: { identifier, code }, auth: false }),
  /** Kirgan foydalanuvchi: majburiy parol (joriysiz) yoki almashtirish (`current` bilan) */
  mePassword: (password: string, confirm: string, current?: string) => api<{ user: Me }>("/me/password", { method: "POST", body: { password, confirm, current, deviceName } }),
  setPassword: (ticket: string, password: string, confirm: string) =>
    api<SetPasswordResult>("/auth/password", { method: "POST", body: { ticket, password, confirm, deviceName }, auth: false }),
  /** Google va Apple (iOS) — `idToken`; Apple Android web oqimi — `ticket` + `verifier` */
  social: (provider: SocialProvider, body: { idToken?: string; ticket?: string; verifier?: string; intent: Intent; firstName?: string; lastName?: string }) =>
    api<SocialResult>(provider === "GOOGLE" ? "/auth/google" : "/auth/apple", { method: "POST", body: { ...body, deviceName }, auth: false }),
  logout: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => api<{ user: Me }>("/me"),
  /** Hisobni o'chirish (do'kon talabi) — parol bilan; parolsiz (Google/Apple) hisob — o'sha provayderning yangi tokeni bilan */
  deleteMe: (confirm: { password: string } | { provider: SocialProvider; idToken?: string; ticket?: string; verifier?: string }) => api<{ ok: true }>("/me", { method: "DELETE", body: confirm }),
};

/** Tasdiqlangan talaba: lenta, tafsilot, saralanganlar, kupon, bildirishnomalar, push (docs/api-v1.md). */
/** Chek (saytdagi `ReceiptData`) */
export type ReceiptData = {
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
  paymentType: string;
  category: { icon: string; tile: string; ink: string };
  pdfUrl: string;
};

/** T7 — tarix (`GET /student/history?oy=`) */
export type StudentHistory = { month: string; months: string[]; saved: number; count: number; receipts: ReceiptData[]; totalSaved: number; totalCount: number; places: number };

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CONFIRMED" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED" | "NO_SHOW" | "EXPIRED";
export type StudentOrderRow = { id: string; status: OrderStatus; title: string; businessName: string; kind: string; slotStart: string; slotEnd: string; quantity: number; totalFinal: number };
export type StudentOrderView = StudentOrderRow & {
  code: string;
  secret: string | null;
  address: string;
  workingHours: string;
  prepayAmount: number;
  rejectReason: string | null;
  cancel: { refund: number; keep: number } | null;
  events: { to: OrderStatus; at: string; reason: string | null }[];
};

export const appApi = {
  orders: () => api<{ orders: StudentOrderRow[] }>("/student/orders"),
  order: (id: string) => api<{ order: StudentOrderView }>(`/student/orders/${encodeURIComponent(id)}`),
  cancelOrder: (id: string) => api<{ ok: true }>(`/student/orders/${encodeURIComponent(id)}/cancel`, { method: "POST" }),
  history: (month?: string) => api<StudentHistory>(`/student/history${month ? `?oy=${month}` : ""}`),
  deals: (origin: Origin) => api<{ deals: FeedDeal[]; categories: Category[]; now: string }>(`/deals${query(originParams(origin))}`),
  nearby: (origin: Origin, radiusKm: number) => api<{ origin: Point; deals: FeedDeal[] }>(`/deals/nearby${query({ ...originParams(origin), radiusKm: String(radiusKm), limit: "100" })}`),
  deal: (id: string, origin: Origin) => api<DealDetail>(`/deals/${encodeURIComponent(id)}${query(originParams(origin))}`),
  saved: (origin: Origin) => api<{ deals: FeedDeal[] }>(`/saved${query(originParams(origin))}`),
  setSaved: (id: string, saved: boolean) => api<{ saved: boolean }>(`/saved/${encodeURIComponent(id)}`, { method: saved ? "PUT" : "DELETE" }),
  claim: (discountId: string) => api<{ coupon: CouponView; existing: boolean }>("/coupons", { method: "POST", body: { discountId } }),
  coupons: () => api<{ coupons: CouponView[] }>("/coupons"),
  coupon: (id: string) => api<CouponState>(`/coupons/${encodeURIComponent(id)}`),
  cancelCoupon: (id: string) => api<{ ok: true }>(`/coupons/${encodeURIComponent(id)}`, { method: "DELETE" }),
  notifications: () => api<{ unread: number; items: InboxItem[] }>("/notifications"),
  /** `ids` berilmasa — hammasi */
  markRead: (ids?: string[]) => api<{ marked: number }>("/notifications/read", { method: "POST", body: ids ? { ids } : {} }),
  places: () => api<{ districts: Place[]; regions: Place[] }>("/districts", { auth: false }),
  registerPush: (token: string, platform: "IOS" | "ANDROID") => api<{ ok: true }>("/push/devices", { method: "POST", body: { token, platform } }),
};

export const studentApi = {
  universities: (q = "") => api<{ universities: University[]; otherId: string }>(`/universities?q=${encodeURIComponent(q)}`, { auth: false }),
  register: (body: { registrationTicket: string; firstName: string; lastName: string; universityId: string; universityOther?: string; course: string }) =>
    api<SignedIn>("/student/register", { method: "POST", body: { ...body, deviceName }, auth: false }),
  status: () => api<StudentStatusView>("/student/status"),
  uploadCard: async (file: LocalFile) => api<{ verificationId: string; status: "PENDING" }>("/student/card", { method: "POST", form: await fileForm(file) }),
  profile: () => api<{ profile: StudentProfile }>("/student/profile"),
  setNotify: (on: boolean) => api<{ notify: boolean }>("/student/notify", { method: "POST", body: { on } }),
  saveProfile: (body: StudentProfileEdit) => api<{ ok: true; user: Me }>("/student/profile", { method: "PATCH", body }),
  uploadAvatar: async (file: LocalFile) => api<{ ok: true }>("/student/avatar", { method: "POST", form: await fileForm(file) }),
  removeAvatar: () => api<{ ok: true }>("/student/avatar", { method: "DELETE" }),
};

/** Talaba profili (`GET /student/profile`): tahrirlanadiganlar va faqat ko'rish uchun (universitet, ID, guvohnoma) */
export type StudentProfile = {
  firstName: string | null;
  lastName: string | null;
  course: string;
  faculty: string | null;
  districtId: string | null;
  publicId: string;
  university: { name: string; shortName: string };
  cardNumber: string | null;
  cardExpiresAt: string | null;
  /** Imzoli havola (1–2 soat) yoki null — bosh harflar */
  avatarUrl: string | null;
  notify: boolean;
};

/** Saytdagi `profileSchema` (`src/lib/profile.ts`): bo'sh fakultet/tuman — o'chiriladi */
export type StudentProfileEdit = { firstName: string; lastName: string; course: string; faculty: string; districtId: string };

export const businessApi = {
  validate: (step: "info" | "details", fields: Partial<BusinessInfo>) =>
    api<{ ok: true; fields: string[] }>("/business/validate", { method: "POST", body: { step, ...fields }, auth: false }),
  register: (registrationTicket: string, info: BusinessInfo) =>
    api<SignedIn>("/business/register", { method: "POST", body: { registrationTicket, ...info, deviceName }, auth: false }),
  application: () => api<{ application: Application }>("/business/application"),
  update: (info: BusinessInfo) => api<{ application: Application }>("/business/application", { method: "PATCH", body: info }),
  upload: async (kind: "registration" | "photo" | "logo", file: LocalFile) =>
    api<{ id: string; kind: string }>(`/business/documents?kind=${kind}`, { method: "POST", form: await fileForm(file) }),
  removeDocument: (id: string) => api<{ ok: true }>(`/business/documents/${id}`, { method: "DELETE" }),
  submit: () => api<{ ok: true; status: "PENDING" }>("/business/submit", { method: "POST", body: { consent: true } }),
};

/**
 * Fayl qismi. SDK 58 da global `fetch` — `expo/fetch`: u RN uslubidagi `{ uri, name, type }` ni o'qimaydi
 * ("Unsupported FormDataPart implementation" — so'rov serverga yetmaydi), faqat Blob yoki `bytes()` li obyektni.
 * Shuning uchun qismda ikkalasi bor: `bytes()` (expo/fetch) va `uri` (RN fetch, `EXPO_PUBLIC_USE_RN_FETCH=1`).
 */
export async function fileForm(original: LocalFile): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === "web") {
    // Web (dizaynni ko'rib chiqish): tanlangan fayl blob: URL — haqiqiy Blob qilib qo'shiladi
    form.append("file", await (await fetch(original.uri)).blob(), original.name);
    return form;
  }
  const file = await compressImage(original);
  const disk = new FsFile(file.uri);
  console.log(`[upload] ${file.name} ${file.type} ${Math.round(disk.size / 1024)} KB (asl: ${original.type})`);
  if (disk.size > MAX_FILE_BYTES) throw new FileTooLargeError();
  form.append("file", { uri: file.uri, name: file.name, type: file.type, bytes: () => disk.bytes() } as unknown as Blob);
  return form;
}
