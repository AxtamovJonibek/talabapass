import "server-only";

/** Tanani o'qiydi, lekin chegaradan oshgan zahoti to'xtaydi (Content-Length yolg'on bo'lsa ham xotiraga to'liq olinmaydi). */
export async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** `x-file-name` sarlavhasidagi (URL-kodlangan) asl fayl nomi. */
export function uploadedFileName(request: Request): string {
  try {
    return decodeURIComponent(request.headers.get("x-file-name") ?? "");
  } catch {
    return ""; // noto'g'ri kodlangan nom — standart nom ishlatiladi
  }
}
