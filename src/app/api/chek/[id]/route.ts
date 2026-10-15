import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentUser, getUnlockedAdmin } from "@/server/auth/session";
import { canViewReceipt, receipt, receiptPdf } from "@/server/coupons/receipts";

/** Chek PDF'i (WT4 "PDF yuklab olish"). Talaba, biznes egasi/kassiri, admin; boshqalarga 404. */
export async function GET(_request: Request, { params }: RouteContext<"/api/chek/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !/^[a-z0-9_]{10,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  const found = await receipt(id);
  const admin = user.role === "ADMIN" && (await getUnlockedAdmin()) !== null;
  if (!found || !(await canViewReceipt(user, found, admin))) return new NextResponse(null, { status: 404 });
  const data = found.data;

  const t = await getTranslations({ locale: "uz", namespace: "receipt" });
  const pay = await getTranslations({ locale: "uz", namespace: "paymentType" });
  const pdf = await receiptPdf(data, {
    title: t("title"),
    no: t("no"),
    date: t("date"),
    student: t("student"),
    cashier: t("cashier"),
    discount: t("discount"),
    total: t("total"),
    payment: t("payment"),
    paymentType: pay(data.paymentType),
    currency: t("currency"),
    footer: t("footer"),
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="chek-${data.no}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
