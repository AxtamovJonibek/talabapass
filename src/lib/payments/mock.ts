import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CallbackEvent, CreatedPayment, CreatePaymentInput, OperationResult, PaymentProvider } from "./types";

/**
 * SOXTA provayder (faqat ishlab chiqish va sinov serveri): pul hech qayerga ketmaydi. To'lov sahifasi — bizning
 * `/test-tolov/<paymentId>` ("Muvaffaqiyatli" / "Rad etildi"); u callback'ni shu yerdagi imzo bilan yuboradi.
 * hold/capture/cancelHold/refund darhol muvaffaqiyatli. Haqiqiy provayder ulanganda production'da bu ishlatilmaydi
 * (`paymentProvider()` — `devShortcutsAllowed`).
 */
export const MOCK_SIGNATURE_HEADER = "x-mock-signature";

export class MockProvider implements PaymentProvider {
  readonly name = "mock";
  /** Haqiqiy kartalarda ushlash odatda bir necha kun — sinovda ham shunday: 3 kundan uzoq buyurtma darhol yechiladi */
  readonly holdMaxDays = 3;

  constructor(private readonly secret: string) {}

  private sign(body: string): string {
    return createHmac("sha256", `tp-mock-pay:${this.secret}`).update(body).digest("base64url");
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    // Idempotent: bir xil to'lov uchun har doim bir xil id (haqiqiy provayder idempotencyKey bo'yicha shunday qiladi)
    return { providerPaymentId: `mock_${input.paymentId}`, checkoutUrl: `/test-tolov/${input.paymentId}` };
  }

  async hold(): Promise<OperationResult> {
    return { ok: true };
  }

  async capture(_id: string, amount: number): Promise<OperationResult> {
    return { ok: true, raw: { captured: amount } };
  }

  async cancelHold(): Promise<OperationResult> {
    return { ok: true };
  }

  async refund(_id: string, amount: number): Promise<OperationResult> {
    return { ok: true, raw: { refunded: amount } };
  }

  /** Test sahifasi chaqiradi: imzolangan callback tanasi */
  signedCallback(event: CallbackEvent): { body: string; headers: Headers } {
    const body = JSON.stringify(event);
    return { body, headers: new Headers({ [MOCK_SIGNATURE_HEADER]: this.sign(body) }) };
  }

  async verifyCallback(body: string, headers: Headers): Promise<CallbackEvent | null> {
    const given = Buffer.from(headers.get(MOCK_SIGNATURE_HEADER) ?? "");
    const expected = Buffer.from(this.sign(body));
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    try {
      const event = JSON.parse(body) as CallbackEvent;
      const okStatus = event.status === "HELD" || event.status === "FAILED" || event.status === "CAPTURED" || event.status === "CANCELLED";
      return typeof event.providerPaymentId === "string" && Number.isInteger(event.amount) && okStatus ? event : null;
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<null> {
    return null;
  }
}
