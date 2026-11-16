import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import { NotFoundScreen } from "@/components/state/not-found-screen";
import { notFoundText } from "@/components/state/not-found-text";
import { localizedPath } from "@/i18n/routing";
import messages from "../../messages/uz.json";
import "./globals.css";

// Hech bir sahifaga mos kelmaydigan manzil (noma'lum til/yo'l). Layout o'tkazib yuboriladi — shriftlar va tema shu yerda.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap" });

export const metadata: Metadata = { title: messages.state.notFoundTitle, robots: { index: false, follow: false }, icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/favicon.svg", type: "image/svg+xml" }] } };

export default function GlobalNotFound() {
  return (
    <html lang="uz" className={`${archivo.variable}`}>
      <body>
        <NotFoundScreen
          text={notFoundText(messages.state)}
          renderLink={(href, className, label) => (
            <Link href={localizedPath(href)} className={className}>
              {label}
            </Link>
          )}
        />
      </body>
    </html>
  );
}
