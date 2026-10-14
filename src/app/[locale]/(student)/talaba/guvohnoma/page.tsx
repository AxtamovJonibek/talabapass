import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import QRCode from "qrcode";
import { CaptureScreen } from "@/components/student/capture-screen";
import { CardUploadDesktop } from "@/components/student/card-upload-desktop";
import { PhoneOrWeb } from "@/components/student/responsive";
import { redirect } from "@/i18n/navigation";
import { requireStudent } from "@/server/auth/student";
import { canUploadCard } from "@/server/auth/student-status";
import { authSecret } from "@/server/env";
import { createUploadToken } from "@/server/student/upload-token";
import { latestVerification } from "@/server/student/verification";

/** Telefonga o'tish havolasi QR kodi: kataklar matritsasi (true — qora). */
function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "L" });
  return Array.from({ length: modules.size }, (_, y) => Array.from({ length: modules.size }, (_, x) => modules.get(y, x) === 1));
}

// T2 / WT1 (2-qadam) — guvohnomani suratga olish yoki yuklash
export default async function StudentCardPage() {
  const user = await requireStudent();
  const { status } = user.student;
  if (!canUploadCard(status)) redirect({ href: "/chegirmalar", locale: await getLocale() });

  const hasSubmission = status === "PENDING" || status === "REJECTED";
  const backHref = hasSubmission ? "/talaba/tekshiruv" : null;
  const pending = status === "PENDING" ? await latestVerification(user.id) : null;

  // Havola shu so'rov kelgan manzilga quriladi (lokalda — kompyuterning tarmoq manzili bilan ochilgan bo'lsa telefon ham kira oladi).
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const handoffUrl = `${origin}/talaba/guvohnoma/telefon?t=${encodeURIComponent(createUploadToken(user.id, authSecret()))}`;

  return (
    <PhoneOrWeb
      phone={<CaptureScreen backHref={backHref ?? "/"} expired={status === "EXPIRED"} />}
      web={<CardUploadDesktop qr={qrMatrix(handoffUrl)} pendingFileName={pending?.fileName ?? null} backHref={backHref} />}
    />
  );
}
