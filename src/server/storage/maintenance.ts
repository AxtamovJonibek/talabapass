import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { db } from "../db";
import { sniffType } from "./file-rules";
import { storage } from "./index";
import { sanitizeDocument, UnreadableFileError } from "./sanitize";

/**
 * Ombordagi fayllarga xizmat: (1) mavjud fayllarni tozalash pipeline'idan qayta o'tkazish,
 * (2) seed yozuvlari uchun yo'q fayllarni namunaviy hujjat bilan to'ldirish (moderatsiya ekranida ko'rinsin).
 * `npm run files:sanitize` va seed chaqiradi.
 */

type Report = { sanitized: number; generated: number; unreadable: string[] };

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Namunaviy talaba guvohnomasi rasmi (haqiqiy hujjat emas — "NAMUNA" yozuvi bilan). */
async function sampleCard(lines: { university: string; name: string; meta: string }): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760">
    <rect width="1200" height="760" rx="36" fill="#f4f1e8"/>
    <rect width="1200" height="120" rx="36" fill="#1e2a9e"/><rect y="84" width="1200" height="36" fill="#1e2a9e"/>
    <text x="60" y="78" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#fff">${escapeXml(lines.university.toUpperCase())}</text>
    <text x="60" y="190" font-family="Arial, sans-serif" font-size="30" fill="#5f5d57">TALABA GUVOHNOMASI</text>
    <rect x="60" y="230" width="300" height="380" rx="16" fill="#d6d3ca"/>
    <circle cx="210" cy="360" r="80" fill="#bdbab2"/><rect x="110" y="460" width="200" height="120" rx="60" fill="#bdbab2"/>
    <text x="420" y="300" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#141414">${escapeXml(lines.name)}</text>
    <text x="420" y="370" font-family="Arial, sans-serif" font-size="32" fill="#3a3a36">${escapeXml(lines.meta)}</text>
    <text x="420" y="560" font-family="Arial, sans-serif" font-size="96" font-weight="900" fill="#b4230c" opacity="0.18" transform="rotate(-12 700 520)">NAMUNA</text>
  </svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer());
}

/** Namunaviy biznes hujjati (PDF). */
async function sampleBusinessDoc(title: string, business: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("NAMUNA HUJJAT", { x: 60, y: 760, size: 22, font });
  page.drawText(title.replace(/[^\x20-\x7e]/g, "?"), { x: 60, y: 720, size: 14, font });
  page.drawText(business.replace(/[^\x20-\x7e]/g, "?"), { x: 60, y: 696, size: 14, font });
  return pdf.save();
}

async function store(folder: string, owner: string, bytes: Uint8Array): Promise<{ key: string; size: number; mime: string } | null> {
  const type = sniffType(bytes);
  if (!type) return null;
  const clean = await sanitizeDocument(bytes, type);
  const key = `${folder}/${owner}/${randomUUID()}.${clean.ext}`;
  await storage().put(key, clean.bytes);
  return { key, size: clean.bytes.byteLength, mime: clean.mime };
}

export async function maintainStoredFiles(options: { generateMissing: boolean }): Promise<Report> {
  const report: Report = { sanitized: 0, generated: 0, unreadable: [] };

  const verifications = await db.verification.findMany({
    select: { id: true, studentId: true, fileKey: true, student: { select: { course: true, faculty: true, university: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } } } },
  });
  for (const v of verifications) {
    const current = await storage().get(v.fileKey).catch(() => null);
    let source = current;
    if (!source) {
      if (!options.generateMissing) continue;
      const name = [v.student.user.firstName, v.student.user.lastName].filter(Boolean).join(" ");
      const course = v.student.course === "MASTER" ? "Magistratura" : `${v.student.course.slice(1)}-kurs`;
      source = await sampleCard({ university: v.student.university.name, name, meta: [v.student.faculty, course].filter(Boolean).join(" · ") });
    }
    try {
      const saved = await store("verifications", v.studentId, source);
      if (!saved) {
        report.unreadable.push(`Verification ${v.id}`);
        continue;
      }
      await db.verification.update({ where: { id: v.id }, data: { fileKey: saved.key, fileSize: saved.size, mime: saved.mime } });
      if (current) await storage().delete(v.fileKey);
      if (current) report.sanitized += 1;
      else report.generated += 1;
    } catch (error) {
      if (!(error instanceof UnreadableFileError)) throw error;
      report.unreadable.push(`Verification ${v.id}`);
    }
  }

  const docs = await db.businessDoc.findMany({ select: { id: true, businessId: true, fileKey: true, fileName: true, business: { select: { name: true } } } });
  for (const d of docs) {
    const current = await storage().get(d.fileKey).catch(() => null);
    let source = current;
    if (!source) {
      if (!options.generateMissing) continue;
      // Seed'da rasm nomli hujjatlar ham bor (Guvohnoma_skan.jpg) — namunasi baribir PDF.
      source = await sampleBusinessDoc(d.fileName, d.business.name);
    }
    try {
      const saved = await store("business", d.businessId, source);
      if (!saved) {
        report.unreadable.push(`BusinessDoc ${d.id}`);
        continue;
      }
      await db.businessDoc.update({ where: { id: d.id }, data: { fileKey: saved.key } });
      if (current) await storage().delete(d.fileKey);
      if (current) report.sanitized += 1;
      else report.generated += 1;
    } catch (error) {
      if (!(error instanceof UnreadableFileError)) throw error;
      report.unreadable.push(`BusinessDoc ${d.id}`);
    }
  }
  return report;
}
