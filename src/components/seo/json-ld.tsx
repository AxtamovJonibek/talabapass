/** `<script type="application/ld+json">` — ma'lumotlar src/lib/seo.ts dagi quruvchilardan. `<` qochiriladi (skript ichidan chiqib bo'lmaydi). */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\u003c") }} />;
}
