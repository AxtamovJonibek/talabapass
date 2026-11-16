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

export type VerifyResult =
  | { next: "password"; ticket: string; role: Intent; masked: string; initial: string | null }
  | { next: "setPassword"; ticket: string; role: NewRole; isNew: boolean; businessName?: string };

export type SetPasswordResult = ({ next: "signedIn" } & SignedIn) | { next: "register"; registrationTicket: string; role: NewRole };

export type SocialProvider = "GOOGLE" | "APPLE";
/** Google/Apple: hisob bor — kirish; yo'q — SMS va parolsiz ro'yxat (`profile` — formani oldindan to'ldirish uchun) */
export type SocialResult =
  | ({ next: "signedIn" } & SignedIn)
  | { next: "register"; role: Intent; registrationTicket: string; profile: { firstName: string | null; lastName: string | null; email: string | null } };

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
  login: (ticket: string, password: string) => api<SignedIn>("/auth/login", { method: "POST", body: { ticket, password, deviceName }, auth: false }),
  setPassword: (ticket: string, password: string, confirm: string) =>
    api<SetPasswordResult>("/auth/password", { method: "POST", body: { ticket, password, confirm, deviceName }, auth: false }),
  social: (provider: SocialProvider, body: { idToken: string; intent: Intent; firstName?: string; lastName?: string }) =>
    api<SocialResult>(provider === "GOOGLE" ? "/auth/google" : "/auth/apple", { method: "POST", body: { ...body, deviceName }, auth: false }),
  logout: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => api<{ user: Me }>("/me"),
  /** Hisobni o'chirish (do'kon talabi) — parol bilan; parolsiz (Google/Apple) hisob — o'sha provayderning yangi tokeni bilan */
  deleteMe: (confirm: { password: string } | { provider: SocialProvider; idToken: string }) => api<{ ok: true }>("/me", { method: "DELETE", body: confirm }),
};

/** Tasdiqlangan talaba: lenta, tafsilot, saralanganlar, kupon, bildirishnomalar, push (docs/api-v1.md). */
export const appApi = {
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
};

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
