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
  // Server action argumentlari (parol, SMS/email kodi) terminal log'iga chiqmasin
  logging: { serverFunctions: false },
  // Noma'lum manzillar uchun o'zbekcha 404 (ildiz layout [locale] dinamik bo'lgani uchun oddiy not-found yetmaydi)
  experimental: {
    globalNotFound: true,
    // VPS'da Nginx orqasida Host sarlavhasiga ishonish: aks holda next-intl rewrite'i localhost:3000 ga proksi bo'lib,
    // "/" -> "/" cheksiz 307 aylanasi chiqadi. Opsiya Next ichida o'qiladi, lekin NextConfig tipida e'lon qilinmagan.
    // @ts-expect-error -- trustHostHeader NextConfig["experimental"] tipida yo'q
    trustHostHeader: true,
  },
  // API javoblari hech qachon indekslanmaydi (sahifalar — src/proxy.ts va metadata)
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  // Do'kon formalari va ilova uchun qisqa, barqaror manzillar (hujjatlar /huquqiy/* da)
  async redirects() {
    return [
      // www → asosiy domen (bitta 301). Asosiysi nginx'da (docs/seo.md); bu — nginx sozlanmaguncha zaxira.
      { source: "/:path*", has: [{ type: "host", value: "www.talabapass.uz" }], destination: "https://talabapass.uz/:path*", statusCode: 301 },
      { source: "/:locale(uz)/maxfiylik", destination: "/:locale/huquqiy/maxfiylik", permanent: true },
      { source: "/:locale(uz)/shartlar", destination: "/:locale/huquqiy/shartlar", permanent: true },
      { source: "/maxfiylik", destination: "/uz/huquqiy/maxfiylik", permanent: true },
      { source: "/shartlar", destination: "/uz/huquqiy/shartlar", permanent: true },
      { source: "/hisobni-ochirish", destination: "/uz/hisobni-ochirish", permanent: true },
    ];
  },
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
