import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import ExcelJS from "exceljs";
import { parsePeriod, periodRange } from "@/lib/stats";
import { formatMinute, toTashkent } from "@/lib/time";
import { getCurrentUser } from "@/server/auth/session";
import { exportSales } from "@/server/business/sales";
import { businessStats, ownerStatsBusiness } from "@/server/business/stats";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const dotted = (date: Date) => `${iso(date).slice(8, 10)}.${iso(date).slice(5, 7)}.${iso(date).slice(0, 4)}`;

/**
 * B6 "Excel hisobot": davr bo'yicha umumiy ko'rsatkichlar, barcha sotuvlar va chegirmalar samaradorligi.
 * Faqat biznes egasi o'z biznesi uchun (biznes faqat sessiyadan); boshqalarga 404.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "BUSINESS_OWNER") return new NextResponse(null, { status: 404 });
  const business = await ownerStatsBusiness(user.id);
  if (!business) return new NextResponse(null, { status: 404 });

  const period = parsePeriod(new URL(request.url).searchParams.get("davr") ?? undefined);
  const now = new Date();
  const range = periodRange(period, now);
  const [stats, sales, t, stat, pay] = await Promise.all([
    businessStats(business.id, period, now),
    exportSales(business.id, period, now),
    getTranslations({ locale: "uz", namespace: "businessStats.export" }),
    getTranslations({ locale: "uz", namespace: "businessStats" }),
    getTranslations({ locale: "uz", namespace: "paymentType" }),
  ]);

  const book = new ExcelJS.Workbook();
  book.creator = "talabaPass";
  const header = (sheet: ExcelJS.Worksheet) => {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  };

  const summary = book.addWorksheet(t("summary"));
  summary.columns = [
    { header: t("metric"), width: 32 },
    { header: t("value"), width: 22 },
  ];
  const k = stats.kpi;
  const f = stats.funnel;
  summary.addRows([
    [business.name, ""],
    [t("period"), stat(`periodName.${period}` as "periodName.1")],
    [t("from"), dotted(range.days[0]!)],
    [t("to"), dotted(range.days[range.days.length - 1]!)],
    [stat("sold"), k.sold],
    [stat("revenue"), k.revenue],
    [t("average"), k.average],
    [stat("given"), k.discount],
    [stat("fresh"), k.fresh],
    [`${stat("returning")} %`, k.returningPercent],
    [stat("funnel.views"), f.views],
    [stat("funnel.qr"), f.qr],
    [stat("funnel.sold"), f.sold],
    [stat("cashiers.rejected"), stats.cashiers.rejected],
  ]);
  header(summary);

  const sheet = book.addWorksheet(t("sales"));
  sheet.columns = [
    { header: t("date"), width: 12 },
    { header: t("time"), width: 8 },
    { header: t("receipt"), width: 10 },
    { header: t("student"), width: 22 },
    { header: t("university"), width: 16 },
    { header: t("item"), width: 30 },
    { header: t("cashier"), width: 18 },
    { header: t("payment"), width: 12 },
    { header: t("original"), width: 12 },
    { header: t("discount"), width: 12 },
    { header: t("paid"), width: 12 },
  ];
  for (const s of sales) {
    const local = toTashkent(s.at);
    sheet.addRow([dotted(local.date), formatMinute(local.minute), String(s.receiptNo).padStart(6, "0"), s.student, s.university, s.item, s.cashier, pay(s.payment), s.originalPrice, s.discountAmount, s.paid]);
  }
  header(sheet);

  const offers = book.addWorksheet(t("offers"));
  offers.columns = [
    { header: stat("offers.discount"), width: 34 },
    { header: stat("offers.status"), width: 14 },
    { header: stat("offers.views"), width: 10 },
    { header: stat("offers.qr"), width: 10 },
    { header: stat("offers.sold"), width: 10 },
    { header: stat("offers.revenue"), width: 14 },
    { header: stat("offers.given"), width: 14 },
  ];
  for (const o of stats.offers) {
    offers.addRow([o.title, stat(`offers.state.${o.ended ? "ENDED" : o.status}` as "offers.state.ACTIVE"), o.views, o.qr, o.sold, o.revenue, o.discount]);
  }
  const total = stats.offerTotals;
  offers.addRow([stat("offers.total"), "", total.views, total.qr, total.sold, total.revenue, total.discount]);
  header(offers);

  const buffer = await book.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="talabapass-hisobot-${iso(toTashkent(now).date)}-${period}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
