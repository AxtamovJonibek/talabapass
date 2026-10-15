import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** Telefondan sinash: lokal tarmoq manzillari (http://192.168…) va `npm run dev:tunnel` (https://….trycloudflare.com). */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  // Faqat `next dev` uchun ahamiyatli: dev resurslarini boshqa manzildan so'rashga ruxsat.
  allowedDevOrigins: ["*.trycloudflare.com", ...lanAddresses],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Noma'lum manzillar uchun o'zbekcha 404 (ildiz layout [locale] dinamik bo'lgani uchun oddiy not-found yetmaydi)
  experimental: { globalNotFound: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
