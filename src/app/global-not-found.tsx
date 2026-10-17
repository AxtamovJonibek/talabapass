import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { NotFoundScreen } from "@/components/state/not-found-screen";
import { notFoundText } from "@/components/state/not-found-text";
import messages from "../../messages/uz.json";
import "./globals.css";

// Hech bir sahifaga mos kelmaydigan manzil (noma'lum til/yo'l). Layout o'tkazib yuboriladi — shriftlar va tema shu yerda.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = { title: messages.state.notFoundTitle };

export default function GlobalNotFound() {
  return (
    <html lang="uz" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <NotFoundScreen
          text={notFoundText(messages.state)}
          renderLink={(href, className, label) => (
            <Link href={href} className={className}>
              {label}
            </Link>
          )}
        />
      </body>
    </html>
  );
}
