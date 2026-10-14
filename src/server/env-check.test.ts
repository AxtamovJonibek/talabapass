import { describe, expect, it } from "vitest";
import { register } from "@/instrumentation";
import { assertProductionEnv, devShortcutsAllowed, isStaging, productionEnvProblems } from "./env-check";

const SAFE = {
  NODE_ENV: "production",
  AUTH_SECRET: "x".repeat(43),
  DATABASE_URL: "postgres://u:p@host/db",
  SMS_PROVIDER: "eskiz",
};

describe("production muhit tekshiruvi", () => {
  it("xavfsiz sozlamada muammo yo'q", () => {
    expect(productionEnvProblems(SAFE)).toEqual([]);
    expect(() => assertProductionEnv(SAFE)).not.toThrow();
  });

  it("OTP_FIXED_CODE bo'lsa to'xtaydi", () => {
    expect(() => assertProductionEnv({ ...SAFE, OTP_FIXED_CODE: "000000" })).toThrow(/OTP_FIXED_CODE/);
  });

  it("SMS_PROVIDER=dev bo'lsa to'xtaydi (katta-kichik harf va bo'sh joydan qat'i nazar)", () => {
    for (const value of ["dev", "DEV", " dev "]) {
      expect(() => assertProductionEnv({ ...SAFE, SMS_PROVIDER: value }), value).toThrow(/SMS_PROVIDER=dev/);
    }
  });

  it("SMS provayder, sir yoki baza manzili yo'q bo'lsa to'xtaydi", () => {
    expect(() => assertProductionEnv({ ...SAFE, SMS_PROVIDER: undefined })).toThrow(/SMS_PROVIDER o'rnatilmagan/);
    expect(() => assertProductionEnv({ ...SAFE, AUTH_SECRET: "qisqa" })).toThrow(/AUTH_SECRET/);
    expect(() => assertProductionEnv({ ...SAFE, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("barcha muammolar bitta xabarda sanab o'tiladi", () => {
    const problems = productionEnvProblems({ NODE_ENV: "production", OTP_FIXED_CODE: "000000", SMS_PROVIDER: "dev" });
    expect(problems).toHaveLength(4);
  });

  it("ishlab chiqish va test muhitida xuddi shu sozlamalar ruxsat etiladi", () => {
    for (const NODE_ENV of ["development", "test", undefined]) {
      expect(productionEnvProblems({ NODE_ENV, OTP_FIXED_CODE: "000000", SMS_PROVIDER: "dev" })).toEqual([]);
    }
  });
});

const STAGING = {
  NODE_ENV: "production",
  APP_ENV: "staging",
  STAGING_PASSWORD: "p".repeat(16),
  AUTH_SECRET: "x".repeat(43),
  DATABASE_URL: "postgres://u:p@host/db",
  OTP_FIXED_CODE: "000000",
  SMS_PROVIDER: "dev",
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
  S3_BUCKET: "talabapass-staging",
  S3_ACCESS_KEY_ID: "id",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("sinov serveri (APP_ENV=staging)", () => {
  it("OTP_FIXED_CODE va SMS_PROVIDER=dev ruxsat etiladi (parol va bucket bor bo'lsa)", () => {
    expect(productionEnvProblems(STAGING)).toEqual([]);
    expect(productionEnvProblems({ ...STAGING, SMS_PROVIDER: undefined })).toEqual([]);
    expect(productionEnvProblems({ ...STAGING, APP_ENV: " Staging " })).toEqual([]);
  });

  it("STAGING_PASSWORD yo'q yoki qisqa bo'lsa to'xtaydi", () => {
    expect(() => assertProductionEnv({ ...STAGING, STAGING_PASSWORD: undefined })).toThrow(/STAGING_PASSWORD/);
    expect(() => assertProductionEnv({ ...STAGING, STAGING_PASSWORD: "qisqa" })).toThrow(/STAGING_PASSWORD/);
  });

  it("lokal disk yoki to'liq bo'lmagan S3 sozlamasi bilan to'xtaydi", () => {
    expect(() => assertProductionEnv({ ...STAGING, STORAGE_DRIVER: undefined })).toThrow(/STORAGE_DRIVER=s3 kerak/);
    expect(() => assertProductionEnv({ ...STAGING, S3_SECRET_ACCESS_KEY: "" })).toThrow(/S3_SECRET_ACCESS_KEY/);
  });

  it("sir va baza talablari staging'da ham saqlanadi", () => {
    expect(() => assertProductionEnv({ ...STAGING, AUTH_SECRET: "qisqa" })).toThrow(/AUTH_SECRET/);
    expect(() => assertProductionEnv({ ...STAGING, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("production qoidalari o'zgarmagan: APP_ENV yo'q, 'production' yoki boshqa qiymatda OTP_FIXED_CODE taqiqlangan", () => {
    for (const APP_ENV of [undefined, "", "production", "stage", "staging-old"]) {
      const env = { ...STAGING, APP_ENV };
      expect(productionEnvProblems(env).join("\n"), String(APP_ENV)).toMatch(/OTP_FIXED_CODE/);
      expect(productionEnvProblems(env).join("\n"), String(APP_ENV)).toMatch(/SMS_PROVIDER=dev/);
      expect(devShortcutsAllowed(env), String(APP_ENV)).toBe(false);
    }
  });

  it("dev qulayliklari: ishlab chiqish, test va staging'da bor; production'da yo'q", () => {
    expect(devShortcutsAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(devShortcutsAllowed({ NODE_ENV: "test" })).toBe(true);
    expect(devShortcutsAllowed({ NODE_ENV: "production", APP_ENV: "staging" })).toBe(true);
    expect(devShortcutsAllowed({ NODE_ENV: "production" })).toBe(false);
  });

  it("isStaging faqat aniq 'staging' qiymatida", () => {
    expect(isStaging({ APP_ENV: "staging" })).toBe(true);
    expect(isStaging({ APP_ENV: "production" })).toBe(false);
    expect(isStaging({})).toBe(false);
  });
});

describe("server start (instrumentation.register)", () => {
  async function registerWith(env: Record<string, string>) {
    const saved = { ...process.env };
    for (const key of ["NODE_ENV", "OTP_FIXED_CODE", "SMS_PROVIDER", "AUTH_SECRET", "DATABASE_URL", "NEXT_RUNTIME", ...Object.keys(STAGING)]) delete process.env[key];
    Object.assign(process.env, env, { NEXT_RUNTIME: "nodejs" });
    try {
      await register();
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  }

  it("production + OTP_FIXED_CODE: start xato bilan to'xtaydi", async () => {
    await expect(registerWith({ ...SAFE, OTP_FIXED_CODE: "000000" })).rejects.toThrow(/OTP_FIXED_CODE/);
  });

  it("production + SMS_PROVIDER=dev: start xato bilan to'xtaydi", async () => {
    await expect(registerWith({ ...SAFE, SMS_PROVIDER: "dev" })).rejects.toThrow(/SMS_PROVIDER=dev/);
  });

  it("xavfsiz production sozlamasida start o'tadi", async () => {
    await expect(registerWith(SAFE)).resolves.toBeUndefined();
  });

  it("staging: to'liq sozlamada start o'tadi, parolsiz to'xtaydi", async () => {
    await expect(registerWith(STAGING)).resolves.toBeUndefined();
    const noPassword = Object.fromEntries(Object.entries(STAGING).filter(([key]) => key !== "STAGING_PASSWORD"));
    await expect(registerWith(noPassword)).rejects.toThrow(/STAGING_PASSWORD/);
  });

  it("development'da start o'tadi", async () => {
    await expect(registerWith({ NODE_ENV: "development", OTP_FIXED_CODE: "000000" })).resolves.toBeUndefined();
  });
});
