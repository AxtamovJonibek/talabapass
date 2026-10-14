import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Baza bilan ishlaydigan testlar (`*.itest.ts`): `npm run test:db`. Lokal baza (`npm run db:dev`) va .env kerak.
 * Testlar o'zi yaratgan yozuvlarnigina o'chiradi; seed ma'lumotlariga tegmaydi.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` faqat Next ichida import qilinadi; testda bo'sh modul.
      "server-only": fileURLToPath(new URL("./src/server/testing/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.itest.ts"],
    setupFiles: ["dotenv/config"],
    fileParallelism: false,
  },
});
