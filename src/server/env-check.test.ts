import { describe, expect, it } from "vitest";
import { register } from "@/instrumentation";
import { assertProductionEnv, productionEnvProblems } from "./env-check";

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

describe("server start (instrumentation.register)", () => {
  async function registerWith(env: Record<string, string>) {
    const saved = { ...process.env };
    for (const key of ["NODE_ENV", "OTP_FIXED_CODE", "SMS_PROVIDER", "AUTH_SECRET", "DATABASE_URL", "NEXT_RUNTIME"]) delete process.env[key];
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

  it("development'da start o'tadi", async () => {
    await expect(registerWith({ NODE_ENV: "development", OTP_FIXED_CODE: "000000" })).resolves.toBeUndefined();
  });
});
