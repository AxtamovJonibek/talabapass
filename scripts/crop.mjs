/**
 * Solishtiruv rasmidan gorizontal bo'lak kesadi (uzun sahifalarni bo'lib ko'rish uchun).
 *   node scripts/crop.mjs .compare/W1-1440.png <y> <balandlik> [chiqish.png]
 */
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

const [file, yArg, hArg, outArg] = process.argv.slice(2);
const src = PNG.sync.read(await readFile(file));
const y = Math.min(Number(yArg), src.height - 1);
const h = Math.min(Number(hArg), src.height - y);
const out = new PNG({ width: src.width, height: h });
PNG.bitblt(src, out, 0, y, src.width, h, 0, 0);
const target = outArg ?? file.replace(/\.png$/, `-y${y}.png`);
await writeFile(target, PNG.sync.write(out));
console.log(target);
