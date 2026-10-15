import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import ExcelJS from "exceljs";
import { parseTxFilter } from "@/lib/admin-transactions";
import { formatMinute, toTashkent } from "@/lib/time";
import { audit } from "@/server/audit";
import { getUnlockedAdmin } from "@/server/auth/session";
import { transactionExport } from "@/server/admin/transactions";

const dotted = (date: Date) => {
  const iso = date.toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
};

/**
 * Admin "Tranzaksiyalar" — Excel eksport (ekrandagi filtr bilan bir xil). Faqat parol bilan ochilgan admin
 * (`getUnlockedAdmin`); boshqalarga 404. Har eksport audit logda.
 */
export async function GET(request: Request) {
  const admin = await getUnlockedAdmin();
  if (!admin) return new NextResponse(null, { status: 404 });

  const filter = parseTxFilter(Object.fromEntries(new URL(request.url).searchParams));
  const [{ rows, truncated }, t, course, reasons] = await Promise.all([
    transactionExport(filter),
    getTranslations({ locale: "uz", namespace: "admin.transactions.export" }),
    getTranslations({ locale: "uz", namespace: "course" }),
    getTranslations({ locale: "uz", namespace: "admin.transactions.reason" }),
  ]);

  const book = new ExcelJS.Workbook();
  book.creator = "talabaPass";
  const sheet = book.addWorksheet(t("sheet"));
  sheet.columns = [
    { header: t("date"), width: 12 },
    { header: t("time"), width: 9 },
    { header: t("receipt"), width: 10 },
    { header: t("student"), width: 24 },
    { header: t("university"), width: 14 },
    { header: t("business"), width: 26 },
    { header: t("cashier"), width: 16 },
    { header: t("item"), width: 30 },
    { header: t("original"), width: 12 },
    { header: t("discount"), width: 12 },
    { header: t("paid"), width: 12 },
    { header: t("status"), width: 26 },
  ];
  for (const r of rows) {
    const local = toTashkent(r.at);
    sheet.addRow([
      dotted(local.date),
      formatMinute(local.minute),
      r.receiptNo ? String(r.receiptNo).padStart(6, "0") : "",
      r.student,
      [r.university, r.course ? (r.course === "MASTER" ? course("MASTER_long") : course("nth", { n: r.course.slice(1) })) : null].filter(Boolean).join(" · "),
      r.business,
      r.cashier,
      r.item,
      r.original ?? "",
      r.discount ?? "",
      r.paid ?? "",
      r.ok ? t("ok") : t("rejected", { reason: reasons(r.reason ?? "INVALID") }),
    ]);
  }
  if (truncated) sheet.addRow([t("truncated")]);
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  await audit({ actorId: admin.id, action: "transactions.export", entity: "Redemption", entityId: "export", meta: { ...filter, rows: rows.length } });

  const buffer = await book.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="talabapass-tranzaksiyalar-${toTashkent(new Date()).date.toISOString().slice(0, 10)}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
