import { AwsClient } from "aws4fetch";
import { isSafeKey } from "./file-rules";
import type { PrivateStorage } from "./index";

/**
 * S3-mos private bucket: Cloudflare R2 (`S3_REGION=auto`) yoki Supabase Storage (S3 endpoint, loyiha regioni).
 * Path-style manzil (`<endpoint>/<bucket>/<kalit>`) — ikkalasi ham qo'llaydi. Bucket private bo'lishi shart:
 * fayl faqat shu adapter orqali, server kalitlari bilan o'qiladi.
 */
export type S3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export function s3ConfigFromEnv(env: Record<string, string | undefined> = process.env): S3Config {
  const read = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`STORAGE_DRIVER=s3: ${name} o'rnatilmagan.`);
    return value;
  };
  return {
    endpoint: read("S3_ENDPOINT").replace(/\/+$/, ""),
    bucket: read("S3_BUCKET"),
    accessKeyId: read("S3_ACCESS_KEY_ID"),
    secretAccessKey: read("S3_SECRET_ACCESS_KEY"),
    region: env.S3_REGION?.trim() || "auto",
  };
}

export function s3Storage(config: S3Config): PrivateStorage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: config.region,
  });
  const urlFor = (key: string) => {
    if (!isSafeKey(key)) throw new Error(`Yaroqsiz saqlash kaliti: ${key}`);
    return `${config.endpoint}/${encodeURIComponent(config.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  };
  const fail = async (action: string, key: string, response: Response) =>
    new Error(`S3 ${action} ${key}: ${response.status} ${(await response.text().catch(() => "")).slice(0, 300)}`);

  return {
    async put(key, data) {
      const response = await client.fetch(urlFor(key), {
        method: "PUT",
        body: new Uint8Array(data),
        // Mavjud faylni ustidan yozmaydi (lokal diskdagi `wx` bilan bir xil).
        headers: { "Content-Type": "application/octet-stream", "If-None-Match": "*" },
      });
      if (!response.ok) throw await fail("put", key, response);
    },
    async get(key) {
      const response = await client.fetch(urlFor(key), { method: "GET" });
      if (response.status === 404) return null;
      if (!response.ok) throw await fail("get", key, response);
      return new Uint8Array(await response.arrayBuffer());
    },
    async delete(key) {
      const response = await client.fetch(urlFor(key), { method: "DELETE" });
      if (!response.ok && response.status !== 404) throw await fail("delete", key, response);
    },
  };
}
