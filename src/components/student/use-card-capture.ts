"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "@/i18n/navigation";

export type CaptureProblem = "empty" | "bad_type" | "too_large" | "not_allowed" | "daily_limit" | "network";
/** Jonli kamera nega ochilmadi: insecure — sahifa http orqali (brauzer kamerani bermaydi), denied — ruxsat berilmadi */
export type CameraIssue = "insecure" | "denied" | "unsupported";

const subscribeToNothing = () => () => {};
/** Muhit kamerani umuman bera oladimi — faqat brauzerda aniqlanadi (serverda: muammo yo'q deb hisoblanadi). */
const environmentIssue = (): CameraIssue | null =>
  // http:// manzilda (masalan, telefondan kompyuterning lokal IP'si orqali) brauzer kamera API'sini umuman bermaydi.
  !window.isSecureContext ? "insecure" : typeof navigator.mediaDevices?.getUserMedia === "function" ? null : "unsupported";
const MAX_BYTES = 10 * 1024 * 1024;
export const CARD_ACCEPT = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif,application/pdf";

/**
 * Guvohnomani suratga olish yoki fayl yuklash — T2 (sayt) va ilova Guvohnoma ekrani uchun bitta mantiq.
 * Kamera ruxsati bo'lsa ramkada jonli tasvir chiqadi va tugma kadrni oladi; bo'lmasa tugma telefonning
 * o'z kamerasini (fayl tanlash orqali) ochadi. Yuklangach — tekshiruv sahifasi (yoki `uploadToken` bilan "kompyuterga qayting").
 */
export function useCardCapture(uploadToken?: string) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<CaptureProblem | null>(null);
  const [sent, setSent] = useState(false);
  const blocked = useSyncExternalStore(subscribeToNothing, environmentIssue, () => null);
  const [permissionIssue, setPermissionIssue] = useState<CameraIssue | null>(null);

  useEffect(() => {
    // Keng ekranda bu ko'rinish yashirin (veb ko'rinishi chiqadi) — kamera so'ralmaydi.
    if (!rootRef.current?.offsetParent) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (environmentIssue()) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop());
        stream = s;
        trackRef.current = s.getVideoTracks()[0] ?? null;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setLive(true);
        }
      })
      .catch((error: DOMException) => {
        // Kamera umuman yo'q (kompyuter) — jim: tugma fayl tanlashni ochadi. Ruxsat berilmagan bo'lsa — tushuntiramiz.
        if (error.name === "NotAllowedError" || error.name === "SecurityError") setPermissionIssue("denied");
        else if (error.name !== "NotFoundError" && error.name !== "OverconstrainedError") setPermissionIssue("unsupported");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function upload(file: Blob, name: string) {
    if (file.size > MAX_BYTES) return setProblem("too_large");
    setBusy(true);
    setProblem(null);
    try {
      // Mobil tarmoqda bir martalik uzilish bo'lishi mumkin — bir marta qayta urinamiz.
      const send = () => fetch("/api/talaba/guvohnoma", {
        method: "POST",
        body: file,
        headers: {
          "content-type": "application/octet-stream",
          "x-file-name": encodeURIComponent(name),
          ...(uploadToken ? { "x-upload-token": uploadToken } : {}),
        },
      });
      const response = await send().catch(() => new Promise<Response>((r) => setTimeout(() => r(send()), 800)));
      const result = (await response.json()) as { ok: boolean; problem?: CaptureProblem };
      if (result.ok && uploadToken) return setSent(true);
      if (result.ok) {
        // Faqat o'tish: tekshiruv sahifasi har safar serverdan yangi chiziladi. Ketidan refresh() chaqirilsa,
        // u joriy sahifani yangilab, o'tishni bekor qilib qo'yishi mumkin.
        router.replace("/talaba/tekshiruv");
        return;
      }
      setProblem(result.problem ?? "network");
    } catch {
      setProblem("network");
    }
    setBusy(false);
  }

  function shoot() {
    const video = videoRef.current;
    if (!live || !video?.videoWidth) return cameraInput.current?.click();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && upload(blob, "guvohnoma.jpg"), "image/jpeg", 0.9);
  }

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      // `torch` — standart turlarda yo'q, faqat ayrim telefon brauzerlarida ishlaydi.
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      // qurilma chiroqni qo'llab-quvvatlamaydi
    }
  }

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void upload(file, file.name);
  };

  return { rootRef, videoRef, cameraInput, fileInput, live, torch, busy, problem, sent, cameraIssue: blocked ?? permissionIssue, shoot, toggleTorch, onPick };
}
