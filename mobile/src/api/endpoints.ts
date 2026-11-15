import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./client";

/** `/api/v1` javob tiplari va chaqiruvlar — docs/api-v1.md bilan bir xil. */

export type Intent = "student" | "business";
export type StudentStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "BLOCKED";
export type BusinessStatus = "PENDING" | "APPROVED" | "WARNED" | "REJECTED" | "BLOCKED";

export type Me = {
  id: string;
  phone: string;
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

export type VerifyResult =
  | { next: "password"; ticket: string; role: Intent; masked: string; initial: string | null }
  | { next: "setPassword"; ticket: string; role: Intent; isNew: boolean };

export type SetPasswordResult = ({ next: "signedIn" } & SignedIn) | { next: "register"; registrationTicket: string; role: Intent };

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

/** Qurilmadagi fayl (kamera, galereya, hujjat tanlash) */
export type LocalFile = { uri: string; name: string; type: string };

/** Sessiyalar ro'yxatida ko'rinadigan qurilma nomi ("iPhone 15", aks holda platforma) */
const deviceName = (Constants.deviceName ?? (Platform.OS === "ios" ? "iOS" : "Android")).slice(0, 80);

export const authApi = {
  requestCode: (phone: string) => api<{ phone: string; resendInSeconds: number }>("/auth/code", { method: "POST", body: { phone }, auth: false }),
  verify: (phone: string, code: string, intent: Intent) => api<VerifyResult>("/auth/verify", { method: "POST", body: { phone, code, intent }, auth: false }),
  login: (ticket: string, password: string) => api<SignedIn>("/auth/login", { method: "POST", body: { ticket, password, deviceName }, auth: false }),
  setPassword: (ticket: string, password: string, confirm: string) =>
    api<SetPasswordResult>("/auth/password", { method: "POST", body: { ticket, password, confirm, deviceName }, auth: false }),
  logout: () => api<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => api<{ user: Me }>("/me"),
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

async function fileForm(file: LocalFile): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === "web") {
    // Web (dizaynni ko'rib chiqish): tanlangan fayl blob: URL — haqiqiy Blob qilib qo'shiladi
    form.append("file", await (await fetch(file.uri)).blob(), file.name);
  } else {
    // React Native FormData fayl qismi: { uri, name, type } — fetch uni o'zi o'qiydi
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
  return form;
}
