/**
 * Deploy (deploy/deploy.sh) boshida: production muhit tekshiruvi build'dan oldin. Muammo bo'lsa deploy aniq xabar bilan
 * to'xtaydi — aks holda xato faqat ishga tushganda (500) ko'rinadi.
 */
import { isAdminPasswordHash } from "../src/server/auth/admin-password";
import { buildEnvProblems } from "../src/server/env-check";

const problems = buildEnvProblems({ ...process.env, NODE_ENV: "production" }, isAdminPasswordHash);
if (problems.length) {
  console.error(`\nMuhit sozlamalari xato — deploy to'xtatildi:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
  process.exit(1);
}
console.log(`Muhit tekshiruvi o'tdi (${(process.env.APP_ENV ?? "").trim() || "production"}).`);
