import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatSom } from "@/lib/format";
import { formatMinute, fromTashkent, toTashkent } from "@/lib/time";
import type { PaymentType, Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { snapshotBadge } from "./coupons";

/** Chek (B4, T7, WT4, PDF) — bitta manbadan. Summalar `Redemption` dan, nom va yorliq kupon snapshot'idan. */
export type ReceiptData = {
  id: string;
  /** "004821" */
  no: string;
  business: { name: string; address: string; tin: string | null };
  /** "13.10.2026 14:31" (Toshkent) */
  time: string;
  /** ISO */
  createdAt: string;
  /** "D. Karimova, TATU" */
  student: string;
  /** "Jasur T." */
  cashier: string;
  item: string;
  badge: string;
  originalPrice: number;
  discountAmount: number;
  paidAmount: number;
  paymentType: PaymentType;
  category: { icon: string; tile: string; ink: string };
};

const RECEIPT_SELECT = {
  id: true,
  receiptNo: true,
  createdAt: true,
  originalPrice: true,
  discountAmount: true,
  paidAmount: true,
  paymentType: true,
  businessId: true,
  studentId: true,
  business: { select: { name: true, address: true, tin: true } },
  student: { select: { firstName: true, lastName: true, student: { select: { university: { select: { shortName: true } } } } } },
  cashier: { select: { firstName: true, lastName: true } },
  coupon: { select: { termsTitle: true, termsType: true, termsPercent: true, termsOriginalPrice: true, termsFinalPrice: true } },
  discount: { select: { icon: true, tileColor: true, inkColor: true, category: { select: { icon: true, tileColor: true, inkColor: true } } } },
} satisfies Prisma.RedemptionSelect;

type Row = Prisma.RedemptionGetPayload<{ select: typeof RECEIPT_SELECT }>;

const pad = (n: number) => String(n).padStart(2, "0");
export function receiptTime(at: Date): string {
  const t = toTashkent(at);
  return `${pad(t.date.getUTCDate())}.${pad(t.date.getUTCMonth() + 1)}.${t.date.getUTCFullYear()} ${formatMinute(t.minute)}`;
}

/** "Jasur Toshmatov" → "Jasur T." */
const shortName = (first?: string | null, last?: string | null) => [first, last ? `${last.charAt(0)}.` : null].filter(Boolean).join(" ");

function toReceipt(r: Row): ReceiptData {
  const uni = r.student.student?.university.shortName;
  return {
    id: r.id,
    no: String(r.receiptNo).padStart(6, "0"),
    business: { name: r.business.name, address: r.business.address, tin: r.business.tin },
    time: receiptTime(r.createdAt),
    createdAt: r.createdAt.toISOString(),
    student: [[r.student.firstName ? `${r.student.firstName.charAt(0)}.` : null, r.student.lastName].filter(Boolean).join(" "), uni].filter(Boolean).join(", "),
    cashier: shortName(r.cashier.firstName, r.cashier.lastName),
    item: r.coupon.termsTitle,
    badge: snapshotBadge(r.coupon),
    originalPrice: r.originalPrice,
    discountAmount: r.discountAmount,
    paidAmount: r.paidAmount,
    paymentType: r.paymentType,
    category: {
      icon: r.discount.icon ?? r.discount.category.icon,
      tile: r.discount.tileColor ?? r.discount.category.tileColor,
      ink: r.discount.inkColor ?? r.discount.category.inkColor,
    },
  };
}

/** Chek va kimga tegishliligi (ruxsat tekshiruvi uchun — `canViewReceipt`). */
export async function receipt(redemptionId: string): Promise<{ data: ReceiptData; businessId: string; studentId: string } | null> {
  const row = await db.redemption.findUnique({ where: { id: redemptionId }, select: RECEIPT_SELECT });
  return row ? { data: toReceipt(row), businessId: row.businessId, studentId: row.studentId } : null;
}

/** Chekni kim ko'ra oladi: talabaning o'zi, biznes egasi, shu biznesning faol kassiri, admin (parol bilan). */
export async function canViewReceipt(user: { id: string; role: string }, r: { businessId: string; studentId: string }, adminUnlocked: boolean): Promise<boolean> {
  if (user.role === "STUDENT") return user.id === r.studentId;
  if (user.role === "ADMIN") return adminUnlocked;
  if (user.role === "BUSINESS_OWNER") return (await db.business.count({ where: { id: r.businessId, ownerId: user.id } })) > 0;
  if (user.role === "CASHIER") return (await db.businessMember.count({ where: { businessId: r.businessId, userId: user.id, role: "CASHIER", active: true } })) > 0;
  return false;
}

// ───────── talaba tarixi (T7 / WT4) ─────────

/** "2026-10" */
export type MonthKey = string;
export const monthKey = (at: Date): MonthKey => toTashkent(at).date.toISOString().slice(0, 7);

function monthRange(key: MonthKey) {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return { from: fromTashkent(new Date(Date.UTC(y, m - 1, 1))), to: fromTashkent(new Date(Date.UTC(y, m, 1))) };
}

export type StudentHistory = {
  month: MonthKey;
  /** Xaridi bor oylar (yangisi oldin), joriy oy doim bor */
  months: MonthKey[];
  saved: number;
  count: number;
  receipts: ReceiptData[];
  /** Butun davr (WT4 profil kartalari) */
  totalSaved: number;
  totalCount: number;
  places: number;
};

export async function studentHistory(studentId: string, requested: string | null, now = new Date()): Promise<StudentHistory> {
  const current = monthKey(now);
  const monthRows = await db.$queryRaw<{ month: string }[]>`
    SELECT DISTINCT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM') AS month
    FROM "Redemption" WHERE "studentId" = ${studentId} ORDER BY 1 DESC`;
  const months = [...new Set([current, ...monthRows.map((r) => r.month)])].sort().reverse();
  const month = requested && months.includes(requested) ? requested : current;
  const { from, to } = monthRange(month);

  const [rows, total, places] = await Promise.all([
    db.redemption.findMany({ where: { studentId, createdAt: { gte: from, lt: to } }, orderBy: { createdAt: "desc" }, select: RECEIPT_SELECT }),
    db.redemption.aggregate({ where: { studentId }, _sum: { discountAmount: true }, _count: true }),
    db.redemption.groupBy({ by: ["businessId"], where: { studentId } }),
  ]);
  const receipts = rows.map(toReceipt);
  return {
    month,
    months,
    saved: receipts.reduce((s, r) => s + r.discountAmount, 0),
    count: receipts.length,
    receipts,
    totalSaved: total._sum.discountAmount ?? 0,
    totalCount: total._count,
    places: places.length,
  };
}

// ───────── PDF ─────────

/** Standart PDF shriftlarida (WinAnsi) yo'q belgilar: minus, o'zbekcha tutuq, "№". */
export const pdfSafe = (text: string) =>
  text
    .replace(/[−–—]/g, "-")
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/№/g, "No")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");

export type PdfLabels = {
  title: string;
  no: string;
  date: string;
  student: string;
  cashier: string;
  discount: string;
  total: string;
  payment: string;
  paymentType: string;
  currency: string;
  footer: string;
};

/** Chek PDF'i (80 mm kenglikdagi lenta ko'rinishida). */
export async function receiptPdf(r: ReceiptData, l: PdfLabels): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${l.title} ${r.no}`));
  pdf.setProducer("talabaPass");
  pdf.setCreator("talabaPass");
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const bold = await pdf.embedFont(StandardFonts.CourierBold);
  const width = 227; // 80 mm
  const margin = 14;
  const lines: { left: string; right?: string; size?: number; font?: typeof mono; center?: boolean; muted?: boolean; rule?: boolean }[] = [
    { left: r.business.name.toUpperCase(), center: true, font: bold, size: 10 },
    { left: [r.business.address, r.business.tin ? `STIR ${r.business.tin.replace(/(\d{3})(?=\d)/g, "$1 ")}` : null].filter(Boolean).join(" · "), center: true, size: 7, muted: true },
    { left: "", rule: true },
    { left: l.no, right: r.no },
    { left: l.date, right: r.time },
    { left: l.student, right: r.student },
    { left: l.cashier, right: r.cashier },
    { left: "", rule: true },
    { left: r.item, right: formatSom(r.originalPrice) },
    { left: `talabaPass ${r.badge}`, right: `-${formatSom(r.discountAmount)}` },
    { left: l.total, right: `${formatSom(r.paidAmount)} ${l.currency}`, font: bold, size: 11 },
    { left: l.payment, right: l.paymentType, muted: true },
    { left: "", rule: true },
    { left: l.footer, center: true, size: 7, muted: true },
  ];
  const lineHeight = (size: number) => size + 6;
  const height = margin * 2 + lines.reduce((s, x) => s + (x.rule ? 10 : lineHeight(x.size ?? 8)), 0);
  const page = pdf.addPage([width, height]);
  let y = height - margin;
  const ink = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.37, 0.36, 0.34);
  for (const line of lines) {
    if (line.rule) {
      y -= 5;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.6, color: muted, dashArray: [2, 2] });
      y -= 5;
      continue;
    }
    const size = line.size ?? 8;
    const font = line.font ?? mono;
    y -= lineHeight(size);
    const color = line.muted ? muted : ink;
    const left = pdfSafe(line.left);
    if (line.center) {
      // Uzun manzil — kesiladi
      let text = left;
      while (text.length > 3 && font.widthOfTextAtSize(text, size) > width - margin * 2) text = `${text.slice(0, -4)}...`;
      page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
      continue;
    }
    const right = pdfSafe(line.right ?? "");
    const rightWidth = font.widthOfTextAtSize(right, size);
    let text = left;
    while (text.length > 3 && font.widthOfTextAtSize(text, size) > width - margin * 2 - rightWidth - 8) text = `${text.slice(0, -4)}...`;
    page.drawText(text, { x: margin, y, size, font, color });
    page.drawText(right, { x: width - margin - rightWidth, y, size, font, color });
  }
  return pdf.save();
}
