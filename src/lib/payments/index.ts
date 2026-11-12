import "server-only";
import { devShortcutsAllowed } from "@/server/env-check";
import { authSecret } from "@/server/env";
import { MockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export type * from "./types";

let mock: MockProvider | null = null;

/**
 * Joriy provayder. Hozir faqat soxta (`mock`) — ishlab chiqish va sinov serverida (`APP_ENV=staging`). Production'da
 * haqiqiy provayder ulanmaguncha null: oldindan to'lovli band qilish yopiq (to'lovsiz bron ishlayveradi).
 */
export function paymentProvider(): PaymentProvider | null {
  if (!devShortcutsAllowed()) return null;
  return mockProvider();
}

export function mockProvider(): MockProvider {
  mock ??= new MockProvider(authSecret());
  return mock;
}

/** Callback va eski yozuvlar uchun: nom bo'yicha */
export function providerByName(name: string): PaymentProvider | null {
  return name === "mock" && devShortcutsAllowed() ? mockProvider() : null;
}
