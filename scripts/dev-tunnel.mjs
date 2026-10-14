/**
 * Telefonda kamera va QR o'tkazmasini sinash uchun lokal dev serverni HTTPS orqali ochadi
 * (Cloudflare quick tunnel, hisob talab qilinmaydi). Brauzerlar kamerani faqat HTTPS (yoki localhost) da beradi.
 *
 *   npm run dev            # bir terminalda
 *   npm run dev:tunnel     # ikkinchisida — https://….trycloudflare.com manzilini chiqaradi
 *
 * Ctrl+C — tunnel yopiladi.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { bin, install } from "cloudflared";

const PORT = Number(process.env.PORT ?? 3000);
const LOCAL = `http://localhost:${PORT}`;

try {
  await fetch(LOCAL, { signal: AbortSignal.timeout(5000) });
} catch {
  console.error(`\n${LOCAL} javob bermadi. Avval boshqa terminalda \`npm run dev\` ni ishga tushiring.\n`);
  process.exit(1);
}

if (!existsSync(bin)) {
  console.log("cloudflared yuklab olinmoqda (bir marta)…");
  await install(bin);
}

const child = spawn(bin, ["tunnel", "--no-autoupdate", "--url", LOCAL], { stdio: ["ignore", "pipe", "pipe"] });
let announced = false;

function watch(chunk) {
  const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk))?.[0];
  if (!url || announced) return;
  announced = true;
  const line = "═".repeat(78);
  console.log(`
${line}
  Tunnel ochiq:  ${url}
  Telefonda shu manzilni oching (masalan ${url}/talaba/royxat).

  ⚠ DIQQAT — tunnel ochiq ekan:
    • bu manzil INTERNETDA OCHIQ: havolani bilgan har kim kompyuteringizdagi dev serverga kira oladi;
    • .env.development dagi OTP_FIXED_CODE ishlaydi — istalgan raqam bilan 000000 kodi orqali,
      jumladan seed'dagi admin hisobiga ham kirish mumkin;
    • lokal bazadagi barcha ma'lumotlar shu server orqali ko'rinadi.
  Sinovdan keyin darhol Ctrl+C bilan yoping. Havolani hech kimga yubormang.
${line}
`);
}
child.stdout.on("data", watch);
child.stderr.on("data", watch);

const stop = () => {
  child.kill();
  console.log("\nTunnel yopildi.");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  if (!announced) console.error(`cloudflared to'xtadi (kod ${code}). Internet aloqasini tekshiring.`);
  process.exit(code ?? 1);
});
