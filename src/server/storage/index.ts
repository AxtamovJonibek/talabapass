import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { isSafeKey } from "./file-rules";
import { s3ConfigFromEnv, s3Storage } from "./s3";

/**
 * Private fayl ombori: talaba guvohnomalari va biznes hujjatlari.
 * Hech qachon public URL bermaydi — fayl faqat ruxsat tekshirilgan server kodi orqali o'qiladi.
 *
 * Lokal disk (`STORAGE_LOCAL_DIR`, standart `.data/private`) yoki S3-mos private bucket — R2 / Supabase
 * (`STORAGE_DRIVER=s3`, s3.ts).
 * R2'da 10 MB gacha fayl to'g'ridan-to'g'ri presigned URL bilan yuklanadi (Vercel so'rov hajmini 4.5 MB bilan cheklaydi).
 */
export interface PrivateStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  /** Fayl yo'q bo'lsa null */
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

function localDisk(root: string): PrivateStorage {
  const base = resolve(root);
  const pathFor = (key: string) => {
    if (!isSafeKey(key)) throw new Error(`Yaroqsiz saqlash kaliti: ${key}`);
    const full = resolve(base, key);
    if (!full.startsWith(base + sep)) throw new Error(`Kalit ombordan tashqariga chiqadi: ${key}`);
    return full;
  };
  return {
    async put(key, data) {
      const path = pathFor(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data, { flag: "wx" }); // mavjud faylni ustidan yozmaydi
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathFor(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}

let instance: PrivateStorage | undefined;

export function storage(): PrivateStorage {
  if (instance) return instance;
  const driver = (process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase();
  if (driver === "local") return (instance = localDisk(process.env.STORAGE_LOCAL_DIR ?? ".data/private"));
  if (driver === "s3") return (instance = s3Storage(s3ConfigFromEnv()));
  throw new Error(`Noma'lum STORAGE_DRIVER: ${driver}`);
}
