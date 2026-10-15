import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { StatePage } from "@/components/state/state-page";
import { buttonClass } from "@/components/ui/button";
import messages from "../../messages/uz.json";
import "./globals.css";

// Hech bir sahifaga mos kelmaydigan manzil (noma'lum til/yo'l). Layout o'tkazib yuboriladi — shriftlar va tema shu yerda.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = { title: messages.state.notFoundTitle };

export default function GlobalNotFound() {
  const t = messages.state;
  return (
    <html lang="uz" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        <StatePage testId="not-found-page" title={t.notFoundTitle} lead={t.notFoundLead}>
          <Link href="/" className={buttonClass({ variant: "blue" })}>
            {t.home}
          </Link>
        </StatePage>
      </body>
    </html>
  );
}
