/**
 * Tashqaridan kelgan havolalar. `talabapass://auth/apple?…` — Apple web oqimining qaytishi (Android): uni
 * `WebBrowser.openAuthSessionAsync` o'zi qabul qiladi (`src/auth/use-social.ts`), router hech qayerga o'tmaydi.
 * Ilova shu havola bilan noldan ochilgan bo'lsa (brauzerda turganda tizim uni yopgan) — oddiy ishga tushish ekrani.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (/(^|\/\/|\/)auth\/apple(\?|$)/.test(path)) return initial ? "/" : null;
    return path;
  } catch {
    return "/";
  }
}
