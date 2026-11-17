import { describe, expect, it } from "vitest";
import { APPLE_TICKET_TTL_MS, appleAuthorizeUrl, appReturnUrl, openAppleTicket, parseAppleUser, sealAppleTicket, STATE_RE, stateOf } from "./apple-web";
import { seal } from "./rules";

const SECRET = "test-secret-test-secret-test-secret-1234";
const VERIFIER = "v".repeat(20) + "Ab3_-" + "x".repeat(25);
const TOKEN = "eyJhbGciOiJSUzI1NiJ9." + "a".repeat(900) + ".sig";

describe("Apple web oqimi (Android)", () => {
  it("state — verifier'ning sha256 i (43 belgi)", () => {
    expect(stateOf(VERIFIER)).toMatch(STATE_RE);
    expect(stateOf(VERIFIER)).not.toBe(stateOf(VERIFIER + "1"));
  });

  it("Apple manzili: Services ID, callback, form_post, ism va email", () => {
    const url = new URL(appleAuthorizeUrl("uz.talabapass.signin", stateOf(VERIFIER)));
    expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("client_id")).toBe("uz.talabapass.signin");
    expect(url.searchParams.get("redirect_uri")).toBe("https://talabapass.uz/api/v1/auth/apple/callback");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("response_type")).toBe("code id_token");
    expect(url.searchParams.get("scope")).toBe("name email");
    expect(url.searchParams.get("state")).toBe(stateOf(VERIFIER));
  });

  it("ilovaga qaytish: Android — intent:// (paket bilan), boshqasi — talabapass://", () => {
    expect(appReturnUrl({ ticket: "T" }, "Mozilla/5.0 (Linux; Android 14) Chrome/130")).toBe("intent://auth/apple?ticket=T#Intent;scheme=talabapass;package=uz.talabapass.app;end");
    expect(appReturnUrl({ error: "cancelled" }, "Mozilla/5.0 (iPhone)")).toBe("talabapass://auth/apple?error=cancelled");
  });

  it("ticket faqat to'g'ri verifier bilan ochiladi", () => {
    const ticket = sealAppleTicket(stateOf(VERIFIER), { idToken: TOKEN, firstName: "Ali", lastName: "Valiyev" }, SECRET);
    expect(openAppleTicket(ticket, VERIFIER, SECRET)).toEqual({ idToken: TOKEN, firstName: "Ali", lastName: "Valiyev" });
    // Deep link'ni ushlagan boshqa ilovada verifier yo'q
    expect(openAppleTicket(ticket, VERIFIER.replace("A", "B"), SECRET)).toBeNull();
    expect(openAppleTicket(ticket, "", SECRET)).toBeNull();
    expect(openAppleTicket(ticket, VERIFIER, "boshqa-sir-boshqa-sir-boshqa-sir-boshqa-1")).toBeNull();
  });

  it("muddati o'tgan yoki boshqa turdagi muhr ochilmaydi", () => {
    const ticket = sealAppleTicket(stateOf(VERIFIER), { idToken: TOKEN }, SECRET, 1_000);
    expect(openAppleTicket(ticket, VERIFIER, SECRET, 1_000 + APPLE_TICKET_TTL_MS + 1)).toBeNull();
    const register = seal("register", { state: stateOf(VERIFIER), idToken: TOKEN }, 60_000, SECRET);
    expect(openAppleTicket(register, VERIFIER, SECRET)).toBeNull();
  });

  it("Apple `user` maydoni: faqat ism, buzug'i — bo'sh", () => {
    expect(parseAppleUser('{"name":{"firstName":" Ali ","lastName":"Valiyev"},"email":"a@b.uz"}')).toEqual({ firstName: "Ali", lastName: "Valiyev" });
    expect(parseAppleUser("{buzuq")).toEqual({});
    expect(parseAppleUser(null)).toEqual({});
  });
});
