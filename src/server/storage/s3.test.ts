import { afterEach, describe, expect, it, vi } from "vitest";
import { s3ConfigFromEnv, s3Storage } from "./s3";

const config = {
  endpoint: "https://acc.r2.cloudflarestorage.com",
  bucket: "talabapass-staging",
  accessKeyId: "id",
  secretAccessKey: "secret",
  region: "auto",
};
const KEY = "verifications/u1/0b9c.jpg";
const URL_FOR_KEY = `${config.endpoint}/${config.bucket}/${KEY}`;

function mockFetch(response: () => Response) {
  const calls: Request[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: Request) => {
    calls.push(input);
    return response();
  }));
  return calls;
}

describe("S3 ombori (R2 / Supabase)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("put: path-style manzil, imzolangan, ustidan yozmaydi", async () => {
    const calls = mockFetch(() => new Response(null, { status: 200 }));
    await s3Storage(config).put(KEY, new Uint8Array([1, 2, 3]));
    expect(calls[0]!.method).toBe("PUT");
    expect(calls[0]!.url).toBe(URL_FOR_KEY);
    expect(calls[0]!.headers.get("if-none-match")).toBe("*");
    expect(calls[0]!.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=id\/\d{8}\/auto\/s3\//);
  });

  it("put: mavjud fayl (412) — xato", async () => {
    mockFetch(() => new Response("PreconditionFailed", { status: 412 }));
    await expect(s3Storage(config).put(KEY, new Uint8Array([1]))).rejects.toThrow(/412/);
  });

  it("get: fayl bor — baytlar, yo'q — null, boshqa xato — tashlanadi", async () => {
    mockFetch(() => new Response(new Uint8Array([7, 8])));
    expect(await s3Storage(config).get(KEY)).toEqual(new Uint8Array([7, 8]));
    mockFetch(() => new Response("NoSuchKey", { status: 404 }));
    expect(await s3Storage(config).get(KEY)).toBeNull();
    mockFetch(() => new Response("AccessDenied", { status: 403 }));
    await expect(s3Storage(config).get(KEY)).rejects.toThrow(/403/);
  });

  it("delete: yo'q fayl xato emas", async () => {
    const calls = mockFetch(() => new Response(null, { status: 404 }));
    await s3Storage(config).delete(KEY);
    expect(calls[0]!.method).toBe("DELETE");
  });

  it("yaroqsiz kalit so'rov yuborilmasdan rad etiladi", async () => {
    const calls = mockFetch(() => new Response(null));
    for (const key of ["../boshqa", "/abs", "a/../b", "a b"]) {
      await expect(s3Storage(config).get(key), key).rejects.toThrow(/Yaroqsiz/);
    }
    expect(calls).toHaveLength(0);
  });

  it("env'dan sozlama: yo'q qiymat aniq xato bilan, region standart 'auto'", () => {
    const env = { S3_ENDPOINT: "https://x.supabase.co/storage/v1/s3/", S3_BUCKET: "b", S3_ACCESS_KEY_ID: "i", S3_SECRET_ACCESS_KEY: "s" };
    expect(s3ConfigFromEnv(env)).toMatchObject({ endpoint: "https://x.supabase.co/storage/v1/s3", region: "auto" });
    expect(() => s3ConfigFromEnv({ ...env, S3_BUCKET: "" })).toThrow(/S3_BUCKET/);
  });
});
