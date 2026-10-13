/**
 * Dizayn ekranini (design/screens/<ID>.html) JSX bo'laklariga o'giradi — yangi ekran yozishda boshlang'ich nuqta.
 * Qiymatlar (o'lcham, joylashuv) aynan ko'chiriladi; ranglar globals.css dagi tokenlarga almashtiriladi;
 * matnlar messages kalitlariga chiqariladi.
 *
 *   node scripts/design-to-jsx.mjs <ID> <namespace> [--out=.design-gen]
 *
 * scripts/design-maps/<ID>.json bo'lsa — tayyor komponent fayllari yoziladi va (--messages=messages/uz.json) matnlar qo'shiladi.
 * Aks holda: <out>/<ID>/<n>-<teg>.tsx qoralamalari va <out>/<ID>/messages.json.
 * Bu qoralama: {{…}} dinamik qismlar, sc-for / sc-if va havolalar qo'lda tugallanadi.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse, NodeType } from "node-html-parser";

const [id, namespace, ...rest] = process.argv.slice(2);
if (!id || !namespace) {
  console.error("Foydalanish: node scripts/design-to-jsx.mjs <ID> <namespace> [--out=dir]");
  process.exit(1);
}
const opts = Object.fromEntries(rest.map((a) => a.replace(/^--/, "").split("=")));
const outDir = `${opts.out ?? ".design-gen"}/${id}`;

// ── tokenlar: globals.css dan hex → var(--color-x)
const css = await readFile("src/app/globals.css", "utf8");
const tokenByHex = new Map();
for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
  if (!tokenByHex.has(m[2].toLowerCase())) tokenByHex.set(m[2].toLowerCase(), m[1]);
}
const unmapped = new Map();
function mapColors(value) {
  return value.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const token = tokenByHex.get(hex.toLowerCase());
    if (token) return `var(--color-${token})`;
    unmapped.set(hex.toUpperCase(), (unmapped.get(hex.toUpperCase()) ?? 0) + 1);
    return hex;
  });
}

// ── ichki havolalar
const ROUTES = {
  "web-bosh-sahifa": "/",
  "web-kirish": "/kirish",
  "web-maxfiylik": "/huquqiy/maxfiylik",
  "web-talaba-royxat": "/talaba/royxat",
  "web-talaba-chegirmalar": "/chegirmalar",
  "web-talaba-chegirma": "/chegirmalar",
  "web-talaba-profil": "/profil",
  "web-biznes-royxat": "/biznes/royxat",
  "web-biznes-chegirma": "/biznes/chegirmalar/yangi",
  "biznes-dashboard": "/biznes",
};

const ATTR = {
  class: "className", for: "htmlFor", tabindex: "tabIndex", maxlength: "maxLength", readonly: "readOnly",
  "sc-camel-view-box": "viewBox", "sc-camel-on-click": "onClick", "sc-camel-on-change": "onChange",
  autocomplete: "autoComplete", colspan: "colSpan", rowspan: "rowSpan",
};
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const expr = (s) => s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, e) => "${" + e + "}");
const isPureExpr = (s) => /^\{\{\s*[^}]+?\s*\}\}$/.test(s.trim());
const pureExpr = (s) => s.trim().replace(/^\{\{\s*|\s*\}\}$/g, "");

function styleObject(text) {
  const entries = [];
  for (const decl of text.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    let value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    if (prop === "font-family") {
      if (/IBM Plex Mono/.test(value)) value = "var(--font-mono)";
      else if (/Archivo/.test(value)) value = "var(--font-sans)";
    }
    value = mapColors(value);
    const key = prop.startsWith("--") ? JSON.stringify(prop) : camel(prop);
    const numeric = /^-?\d+(\.\d+)?$/.test(value) && ["flex-grow", "flex-shrink", "opacity", "z-index", "order", "line-height", "font-weight", "flex", "aspect-ratio"].includes(prop);
    const rendered = value.includes("{{")
      ? isPureExpr(value) ? pureExpr(value) : "`" + expr(value).replace(/`/g, "\\`") + "`"
      : numeric ? value : JSON.stringify(value);
    entries.push(`${key}: ${rendered}`);
  }
  return `{{ ${entries.join(", ")} }}`;
}

// ── matnlar → kalitlar
const messages = {};
const keyByText = new Map();
function slug(text) {
  const words = text.toLowerCase().replace(/[ʻʼ'’`]/g, "").replace(/[^a-z0-9Ѐ-ӿ]+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, 4).join("_").slice(0, 40) || "t";
}
function keyFor(section, text) {
  const id = `${section}\u0000${text}`;
  if (keyByText.has(id)) return keyByText.get(id);
  messages[section] ??= {};
  let key = slug(text);
  for (let n = 2; key in messages[section]; n++) key = `${slug(text)}_${n}`;
  messages[section][key] = text;
  keyByText.set(id, key);
  return key;
}
const LITERAL = new Set(["talaba", "Pass"]);
const hasLetters = (s) => !LITERAL.has(s.trim()) && /[A-Za-zЀ-ӿ]/.test(s);
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

const VOID = new Set(["input", "br", "img", "hr", "circle", "path", "rect", "line", "polyline", "polygon", "ellipse", "use"]);
const pad = (n) => "  ".repeat(n);

function renderText(raw, section, depth) {
  const text = decode(raw);
  if (!text.trim()) return /\s/.test(text) && !text.includes("\n") ? [`${pad(depth)}{" "}`] : [];
  const lead = /^\s/.test(text) && !/^\s*\n/.test(text) ? '{" "}' : "";
  const trail = /\s$/.test(text) && !/\n\s*$/.test(text) ? '{" "}' : "";
  const core = text.trim().replace(/\s+/g, " ");
  let body;
  if (core.includes("{{")) {
    body = isPureExpr(core) ? `{${pureExpr(core)}}` : "{`" + expr(core).replace(/`/g, "\\`") + "`}";
  } else if (hasLetters(core)) {
    body = `{t("${keyFor(section, core)}")}`;
  } else {
    body = /[{}<>]/.test(core) ? `{${JSON.stringify(core)}}` : core;
  }
  return [`${pad(depth)}${lead}${body}${trail}`];
}

function renderNode(node, section, depth) {
  if (node.nodeType === NodeType.TEXT_NODE) return renderText(node.rawText, section, depth);
  if (node.nodeType !== NodeType.ELEMENT_NODE) return [];
  let tag = node.rawTagName.toLowerCase();
  const children = () => node.childNodes.flatMap((c) => renderNode(c, section, depth + 1));

  if (tag === "sc-for") {
    const list = pureExpr(node.getAttribute("list") ?? "");
    const as = node.getAttribute("as") ?? "item";
    return [`${pad(depth)}{${list}.map((${as}, i) => (`, `${pad(depth + 1)}<Fragment key={i}>`, ...node.childNodes.flatMap((c) => renderNode(c, section, depth + 2)), `${pad(depth + 1)}</Fragment>`, `${pad(depth)}))}`];
  }
  if (tag === "sc-if") {
    const cond = pureExpr(node.getAttribute("value") ?? "");
    return [`${pad(depth)}{${cond} ? (`, `${pad(depth + 1)}<>`, ...node.childNodes.flatMap((c) => renderNode(c, section, depth + 2)), `${pad(depth + 1)}</>`, `${pad(depth)}) : null}`];
  }
  if (tag.startsWith("sc-raw-")) tag = tag.slice(7);

  const attrs = [];
  let isLink = false;
  for (const [rawName, rawValue] of Object.entries(node.attributes)) {
    const name = rawName.toLowerCase();
    const value = decode(rawValue);
    if (name.startsWith("hint-")) continue;
    if (name === "style") { attrs.push(`style=${styleObject(value)}`); continue; }
    if (name === "href" && tag === "a") {
      const m = /^([a-z-]+)\.dc\.html$/.exec(value);
      if (m) { isLink = true; attrs.push(`href="${ROUTES[m[1]] ?? "/TODO-" + m[1]}"`); continue; }
    }
    let jsxName = ATTR[name] ?? (name.startsWith("aria-") || name.startsWith("data-") ? name : camel(name));
    if (tag === "input" || tag === "textarea") {
      if (jsxName === "value") jsxName = "defaultValue";
      if (jsxName === "checked") jsxName = "defaultChecked";
    }
    if (value === "" && ["checked", "defaultChecked", "multiple", "disabled", "readOnly"].includes(jsxName)) { attrs.push(jsxName); continue; }
    if (value.includes("{{")) attrs.push(`${jsxName}={${isPureExpr(value) ? pureExpr(value) : "`" + expr(value) + "`"}}`);
    else if ((name === "aria-label" || name === "placeholder" || name === "title") && hasLetters(value)) attrs.push(`${jsxName}={t("${keyFor(section, value)}")}`);
    else if (["rows", "maxLength", "tabIndex", "colSpan", "rowSpan"].includes(jsxName)) attrs.push(`${jsxName}={${value}}`);
    else attrs.push(`${jsxName}=${JSON.stringify(value)}`);
  }
  if (isLink) tag = "Link";
  const open = `${pad(depth)}<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  if (VOID.has(tag) || (tag === "textarea")) {
    if (tag === "textarea" && node.text.trim()) return [`${open} defaultValue={t("${keyFor(section, decode(node.text.trim()))}")} />`];
    return [`${open} />`];
  }
  const inner = children();
  if (inner.length === 0) return [`${open} />`];
  if (inner.length === 1 && inner[0].trim().length + open.length < 110) return [`${open}>${inner[0].trim()}</${tag}>`];
  return [`${open}>`, ...inner, `${pad(depth)}</${tag}>`];
}

const html = await readFile(`design/screens/${id}.html`, "utf8");
const body = html.slice(html.indexOf("</helmet>") + 9, html.indexOf("</x-dc>"));
const rootEl = parse(body, { comment: false }).childNodes.find((n) => n.nodeType === NodeType.ELEMENT_NODE);
await mkdir(outDir, { recursive: true });

const mapPath = `scripts/design-maps/${id}.json`;
const map = existsSync(mapPath) ? JSON.parse(await readFile(mapPath, "utf8")) : null;
const index = [`// ${id} ildiz: style=${styleObject(rootEl.getAttribute("style") ?? "")}`];
const elements = rootEl.childNodes.filter((c) => c.nodeType === NodeType.ELEMENT_NODE);
if (map && map.sections.length !== elements.length) {
  console.error(`Xarita ${map.sections.length} bo'lim, dizaynda ${elements.length} ta`);
  process.exit(1);
}
let n = 0;
for (const child of elements) {
  const spec = map?.sections[n];
  n += 1;
  const tag = child.rawTagName.toLowerCase();
  const section = spec?.name ?? `s${String(n).padStart(2, "0")}_${tag}`;
  const lines = renderNode(child, section, 2);
  const code = lines.join("\n");
  if (!spec) {
    const file = `${String(n).padStart(2, "0")}-${tag}.tsx`;
    await writeFile(`${outDir}/${file}`, code + "\n");
    index.push(`${file}  (${lines.length} qator)`);
    continue;
  }
  const file = `${map.dir}/${spec.file}.tsx`;
  if (existsSync(file) && !opts.force) {
    index.push(`${file}  — mavjud, o'tkazib yuborildi (--force bilan qayta yoziladi)`);
    continue;
  }
  const imports = [];
  if (code.includes("<Fragment")) imports.push('import { Fragment } from "react";');
  imports.push('import { useTranslations } from "next-intl";');
  if (code.includes("<Link")) imports.push('import { Link } from "@/i18n/navigation";');
  const usesT = code.includes("{t(") || code.includes("=t(");
  const source = [
    `// Manba: design/screens/${id}.html — qiymatlar dizayndan aynan ko'chirilgan.`,
    ...imports.filter((line) => usesT || !line.includes("useTranslations")),
    "",
    `export function ${spec.component}() {`,
    ...(usesT ? [`  const t = useTranslations("${map.namespace}.${section}");`] : []),
    "  return (",
    code,
    "  );",
    "}",
    "",
  ].join("\n");
  await mkdir(map.dir, { recursive: true });
  await writeFile(file, source);
  index.push(`${file}  (${lines.length} qator)`);
}
await writeFile(`${outDir}/messages.json`, JSON.stringify({ [namespace]: messages }, null, 2) + "\n");
if (map && opts.messages) {
  const all = JSON.parse(await readFile(opts.messages, "utf8"));
  all[map.namespace] = { ...(all[map.namespace] ?? {}), ...messages };
  await writeFile(opts.messages, JSON.stringify(all, null, 2) + "\n");
}
const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html);
if (script) await writeFile(`${outDir}/logic.js`, script[1].trim() + "\n");

console.log(index.join("\n"));
console.log(`matnlar: ${Object.values(messages).reduce((a, s) => a + Object.keys(s).length, 0)}`);
if (unmapped.size) console.log("token yo'q ranglar:", [...unmapped].sort((a, b) => b[1] - a[1]).map(([hex, c]) => `${hex}×${c}`).join(" "));
