/**
 * Admin parolining xeshi: `npm run admin:hash` → parolni kiriting → chiqqan qatorni `ADMIN_PASSWORD_HASH` ga qo'ying
 * (Vercel Environment Variables). Parolning o'zi hech qayerda saqlanmaydi.
 */
import { createInterface } from "node:readline/promises";
import { ADMIN_PASSWORD_MIN, hashAdminPassword } from "../src/server/auth/admin-password";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question("Admin paroli: ")).trim();
rl.close();
if (password.length < ADMIN_PASSWORD_MIN) {
  console.error(`Parol kamida ${ADMIN_PASSWORD_MIN} belgi bo'lsin.`);
  process.exit(1);
}
console.log(`\nADMIN_PASSWORD_HASH=${hashAdminPassword(password)}\n`);
