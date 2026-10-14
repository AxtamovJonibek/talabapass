/**
 * Buyruqni boshqa env fayli bilan ishga tushirish: `node scripts/with-env.mjs .env.staging prisma db seed`.
 * Fayldagi qiymatlar `.env` dagilardan ustun (dotenv mavjud o'zgaruvchini qayta yozmaydi).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const [file, ...command] = process.argv.slice(2);
if (!file || command.length === 0) {
  console.error("Ishlatish: node scripts/with-env.mjs <env-fayl> <buyruq...>");
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`${file} topilmadi. .env.staging.example dan nusxa oling.`);
  process.exit(2);
}
process.loadEnvFile(file);
const result = spawnSync(command.join(" "), { stdio: "inherit", shell: true, env: process.env });
process.exit(result.status ?? 1);
