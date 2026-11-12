import "server-only";

/**
 * Telegram bot orqali xabar (Telegram orqali kirgan foydalanuvchilarga — `User.telegramChatId`). `TELEGRAM_BOT_TOKEN`
 * yo'q bo'lsa o'chiq: ilova ichi va push baribir ishlaydi. Telegram kirishi hali ulanmagan — chatId to'ldirilganda ishlaydi.
 */
export const telegramEnabled = () => Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return false;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) console.warn("[telegram] yuborilmadi:", response.status);
  return response.ok;
}
