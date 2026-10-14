/**
 * Sinov serveri (`APP_ENV=staging`) belgisi. Dizaynda yo'q — mavjud tokenlar va mono yorliq uslubidan.
 * Ekranning yuqori o'rtasida, bosishlarni o'tkazib yuboradi (sahifa joylashuviga ta'sir qilmaydi).
 */
export function StagingBadge({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed top-0 left-1/2 z-[2147483647] -translate-x-1/2 rounded-b-[10px] bg-orange px-[10px] py-[4px] font-mono text-11 font-semibold tracking-[0.1em] text-ink uppercase"
    >
      {label}
    </div>
  );
}
