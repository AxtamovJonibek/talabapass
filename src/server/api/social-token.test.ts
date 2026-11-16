import { generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { audiences, profileFromClaims, SocialTokenError, verifySocialToken } from "./social-token";

const ENV = {
  GOOGLE_CLIENT_ID_WEB: "web.apps.googleusercontent.com",
  GOOGLE_CLIENT_ID_IOS: "ios.apps.googleusercontent.com",
  APPLE_CLIENT_ID: "uz.talabapass.app",
};
const NOW = new Date("2026-11-17T10:00:00Z");

let key: CryptoKey;
let other: CryptoKey;
let keys: () => Promise<CryptoKey>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  key = pair.privateKey;
  other = (await generateKeyPair("RS256")).privateKey;
  keys = async () => pair.publicKey;
});

function token(claims: Record<string, unknown>, { iss = "https://accounts.google.com", aud = ENV.GOOGLE_CLIENT_ID_WEB, exp = NOW.getTime() / 1000 + 600, signer = key } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(NOW.getTime() / 1000 - 10)
    .setExpirationTime(exp)
    .sign(signer);
}

const reason = (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof SocialTokenError ? e.reason : String(e)));

describe("Google/Apple ID token", () => {
  it("client ID'lar env'dan, bo'shlari tashlanadi", () => {
    expect(audiences("GOOGLE", { ...ENV, GOOGLE_CLIENT_ID_ANDROID: " " })).toEqual([ENV.GOOGLE_CLIENT_ID_WEB, ENV.GOOGLE_CLIENT_ID_IOS]);
    expect(audiences("APPLE", { APPLE_CLIENT_ID: "a, b" })).toEqual(["a", "b"]);
    expect(audiences("APPLE", {})).toEqual([]);
  });

  it("to'g'ri Google tokeni — profil (email kichik harfda, ism oldindan to'ldirish uchun)", async () => {
    const t = await token({ sub: "1001", email: "Ali@Gmail.com", email_verified: true, given_name: "Ali", family_name: "Valiyev" });
    expect(await verifySocialToken("GOOGLE", t, { env: ENV, keys, now: NOW })).toEqual({
      provider: "GOOGLE",
      subject: "1001",
      email: "ali@gmail.com",
      emailVerified: true,
      firstName: "Ali",
      lastName: "Valiyev",
    });
  });

  it("iOS client ID li token ham qabul qilinadi", async () => {
    const t = await token({ sub: "1001" }, { aud: ENV.GOOGLE_CLIENT_ID_IOS, iss: "accounts.google.com" });
    expect((await verifySocialToken("GOOGLE", t, { env: ENV, keys, now: NOW })).subject).toBe("1001");
  });

  it("begona aud, begona iss, muddati o'tgan, boshqa kalit — rad", async () => {
    expect(await reason(verifySocialToken("GOOGLE", await token({ sub: "1" }, { aud: "begona.apps.googleusercontent.com" }), { env: ENV, keys, now: NOW }))).toBe("invalid");
    expect(await reason(verifySocialToken("GOOGLE", await token({ sub: "1" }, { iss: "https://evil.example" }), { env: ENV, keys, now: NOW }))).toBe("invalid");
    expect(await reason(verifySocialToken("GOOGLE", await token({ sub: "1" }, { exp: NOW.getTime() / 1000 - 120 }), { env: ENV, keys, now: NOW }))).toBe("invalid");
    expect(await reason(verifySocialToken("GOOGLE", await token({ sub: "1" }, { signer: other }), { env: ENV, keys, now: NOW }))).toBe("invalid");
    expect(await reason(verifySocialToken("GOOGLE", "buzilgan.token.qator", { env: ENV, keys, now: NOW }))).toBe("invalid");
  });

  it("Google tokeni Apple sifatida o'tmaydi (iss va aud boshqa)", async () => {
    const t = await token({ sub: "1" });
    expect(await reason(verifySocialToken("APPLE", t, { env: ENV, keys, now: NOW }))).toBe("invalid");
  });

  it("client ID sozlanmagan — unconfigured", async () => {
    const t = await token({ sub: "1" });
    expect(await reason(verifySocialToken("GOOGLE", t, { env: {}, keys, now: NOW }))).toBe("unconfigured");
    expect(await reason(verifySocialToken("APPLE", t, { env: { GOOGLE_CLIENT_ID_WEB: "x" }, keys, now: NOW }))).toBe("unconfigured");
  });

  it("Apple: email_verified satr ko'rinishida; sub'siz token rad", async () => {
    const t = await token({ sub: "000123.abc", email: "x@privaterelay.appleid.com", email_verified: "true" }, { iss: "https://appleid.apple.com", aud: ENV.APPLE_CLIENT_ID });
    const p = await verifySocialToken("APPLE", t, { env: ENV, keys, now: NOW });
    expect(p).toMatchObject({ provider: "APPLE", subject: "000123.abc", emailVerified: true, firstName: null });
    expect(() => profileFromClaims("APPLE", { email: "x@y.uz" })).toThrow(SocialTokenError);
  });

  it("tasdiqlanmagan email — bog'lash uchun ishlatilmaydi", () => {
    expect(profileFromClaims("GOOGLE", { sub: "1", email: "a@b.uz", email_verified: false })).toMatchObject({ email: "a@b.uz", emailVerified: false });
    expect(profileFromClaims("GOOGLE", { sub: "1", email: "emas-email" })).toMatchObject({ email: null, emailVerified: false });
  });
});
