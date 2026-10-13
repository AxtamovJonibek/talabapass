import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";

export default async function LegalIndexPage({ params }: PageProps<"/[locale]/huquqiy">) {
  const locale = await resolveLocale(params);
  redirect({ href: "/huquqiy/maxfiylik", locale });
}
