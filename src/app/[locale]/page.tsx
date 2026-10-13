import { Logo } from "@/components/ui/logo";
import { resolveLocale } from "@/i18n/locale";

// Vaqtinchalik: landing (W1) 2-bosqichda shu yerga keladi.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Logo size={22} />
    </main>
  );
}
