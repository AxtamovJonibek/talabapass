// Ilova tovushlari (skaner natijasi, yangi buyurtma): sintez qilingan qisqa WAV, tashqi fayl/litsenziya yo'q.
// Ishga tushirish (ildizdan): node mobile/scripts/sounds.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RATE = 22050;
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "sounds");

/** Ohanglar: [chastota Hz, davomiylik s, pauza s] — yumshoq kirish/chiqish bilan sinus */
function render(notes, volume = 0.5) {
  const samples = [];
  for (const [freq, dur, gap = 0] of notes) {
    const n = Math.round(dur * RATE);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, i / (RATE * 0.01)) * Math.min(1, (n - i) / (RATE * 0.04));
      samples.push(volume * env * (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t)) / 1.25);
    }
    for (let i = 0; i < Math.round(gap * RATE); i++) samples.push(0);
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

writeFileSync(join(out, "success.wav"), render([[880, 0.09, 0.02], [1318, 0.16]]));
writeFileSync(join(out, "error.wav"), render([[220, 0.14, 0.05], [196, 0.22]], 0.6));
writeFileSync(join(out, "order.wav"), render([[784, 0.12, 0.04], [988, 0.12, 0.04], [1175, 0.24]]));
console.log("tovushlar:", out);
