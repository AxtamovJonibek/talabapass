/**
 * To'lov provayderi interfeysi. Model — avval ushlab turish (hold), keyin yechish (capture) yoki bo'shatish (cancelHold);
 * yechilgan puldan qaytarish (refund) — to'liq yoki qisman. Provayder bazaga tegmaydi: holatni `src/server/payments`
 * saqlaydi. Hozir faqat `MockProvider` (sinov serveri); haqiqiy provayder shu interfeysga ulanadi.
 */

export type ProviderPaymentStatus = "CREATED" | "HELD" | "CAPTURED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "FAILED";

export type CreatePaymentInput = {
  /** Bizning Payment.id */
  paymentId: string;
  /** so'm */
  amount: number;
  /** Bir xil kalit bilan qayta chaqirilsa — yangi to'lov yaratilmaydi */
  idempotencyKey: string;
  description: string;
  /** To'lovdan keyin talaba qaytadigan sahifa (nisbiy yo'l) */
  returnPath: string;
};

export type CreatedPayment = {
  providerPaymentId: string;
  /** Talaba yo'naltiriladigan to'lov sahifasi (nisbiy yoki to'liq URL) */
  checkoutUrl: string;
};

export type OperationResult = { ok: true; raw?: unknown } | { ok: false; error: string; raw?: unknown };

/** Provayder callback'i tekshirilgandan keyin: qaysi to'lov va qanday natija. */
export type CallbackEvent = {
  providerPaymentId: string;
  status: Extract<ProviderPaymentStatus, "HELD" | "FAILED" | "CAPTURED" | "CANCELLED">;
  amount: number;
};

export interface PaymentProvider {
  readonly name: string;
  /**
   * Pulni necha kungacha ushlab tura oladi (karta tizimi chegarasi). Buyurtma bundan uzoq yashasa (uzoq muddatli
   * PREPAID_PICKUP) — to'langanda darhol yechiladi, qaytarish refund orqali. Berilmasa — cheklovsiz (doim hold).
   */
  readonly holdMaxDays?: number;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Avtorizatsiya: pul kartada ushlanadi (ko'p provayderlarda createPayment bilan birga — callback HELD keladi) */
  hold(providerPaymentId: string, amount: number): Promise<OperationResult>;
  /** Ushlangan puldan `amount` yechiladi, qolgani bo'shatiladi */
  capture(providerPaymentId: string, amount: number): Promise<OperationResult>;
  /** Ushlangan pul to'liq bo'shatiladi */
  cancelHold(providerPaymentId: string): Promise<OperationResult>;
  /** Yechilgan puldan qaytarish (to'liq yoki qisman) */
  refund(providerPaymentId: string, amount: number): Promise<OperationResult>;
  /** Callback imzosi va mazmuni; soxta bo'lsa null */
  verifyCallback(body: string, headers: Headers): Promise<CallbackEvent | null>;
  /** Provayderdagi holat (qo'llamasa null — bizning yozuvga tayaniladi) */
  getStatus(providerPaymentId: string): Promise<ProviderPaymentStatus | null>;
}
