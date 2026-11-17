#!/usr/bin/env node
// Revisa src/messages/{es,en}.json:
// - claves que faltan en uno de los dos archivos (fallo);
// - textos vacíos (fallo);
// - valores de en.json que parecen castellano (fallo);
// - claves que no se usan en el código (aviso: la búsqueda es aproximada y
//   las claves dinámicas pueden dar falsos positivos).
// Uso: node scripts/check-messages.mjs  (npm run check:messages)
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const load = (lang) => JSON.parse(readFileSync(join(src, "messages", `${lang}.json`), "utf8"));

/** Aplana {a: {b: "x"}} → [["a.b", "x"]]. */
function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

const es = new Map(flatten(load("es")));
const en = new Map(flatten(load("en")));
const errors = [];
const warnings = [];

// 1. Claves que faltan
for (const k of es.keys()) if (!en.has(k)) errors.push(`falta en en.json: ${k}`);
for (const k of en.keys()) if (!es.has(k)) errors.push(`falta en es.json: ${k}`);

// 2. Textos vacíos
for (const [lang, map] of [
  ["es", es],
  ["en", en],
]) {
  for (const [k, v] of map) {
    if (typeof v !== "string") errors.push(`${lang}.json: ${k} no es un texto`);
    else if (!v.trim()) errors.push(`${lang}.json: ${k} está vacío`);
  }
}

// 3. Castellano en en.json. Se ignoran los nombres de idioma ("Español").
const SPANISH_CHARS = /[áéíóúñ¿¡]/i;
const SPANISH_WORDS = /\b(de|la|las|los|el|una|prenda|prendas|que|con|para|por|tu|tus)\b/i;
const SPANISH_ALLOWED = new Set(["common.languages.es"]);
for (const [k, v] of en) {
  if (SPANISH_ALLOWED.has(k) || typeof v !== "string") continue;
  // Las variables y los selectores ICU ({n}, {count, plural, …}) no cuentan
  const text = v.replace(/\{[^{}]*\}/g, " ");
  if (SPANISH_CHARS.test(text) || SPANISH_WORDS.test(text)) {
    errors.push(`en.json: ${k} parece castellano: ${JSON.stringify(v)}`);
  }
}

// 4. Claves sin usar (aproximado)
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "messages" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [path] : [];
  });
}

const files = sourceFiles(src).map((path) => {
  const code = readFileSync(path, "utf8");
  // Literales completos: "x.y" / 'x.y' / `x.y`
  const literals = new Set([...code.matchAll(/(["'`])([A-Za-z0-9_.-]+)\1/g)].map((m) => m[2]));
  // Comienzos de plantillas dinámicas: `catalog.${kind}` → "catalog."
  const dynamic = [...code.matchAll(/`([A-Za-z0-9_.-]*)\$\{/g)].map((m) => m[1]);
  // Espacios de nombres: useTranslations("ns") / getTranslations("ns" | {namespace})
  const namespaces = new Set([""]);
  for (const m of code.matchAll(
    /(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?(["'`])([^"'`]*)\1/g,
  )) {
    namespaces.add(m[2].includes("${") ? m[2].split("${")[0] : m[2]);
  }
  for (const m of code.matchAll(/(?:useTranslations|getTranslations)\(\s*`([^`$]*)\$\{/g)) {
    dynamic.push(m[1]);
  }
  // t(slot), t(type)… con una variable: la clave sale de una lista de ids
  const variableCall = /\bt\(\s*[A-Za-z_$][\w$.]*\s*[,)]/.test(code);
  return { path, literals, dynamic, namespaces, variableCall };
});

const allLiterals = new Set(files.flatMap((f) => [...f.literals]));
const variableNamespaces = new Set(
  files.filter((f) => f.variableCall).flatMap((f) => [...f.namespaces]),
);
const allDynamic = files.flatMap((f) => f.dynamic.filter(Boolean));

function isUsed(key) {
  for (const f of files) {
    for (const ns of f.namespaces) {
      const prefix = ns ? `${ns}.` : "";
      if (ns && !key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (f.literals.has(rest)) return true;
      // t(`filters.${x}`) o un subárbol pasado entero (t.raw("x"))
      if (f.dynamic.some((d) => d && rest.startsWith(d))) return true;
    }
  }
  // Ids de dominio (slots, tipos, colores…): t(slot) con el id en otra lista
  const last = key.split(".").pop();
  const parent = key.slice(0, key.length - last.length - 1);
  if (variableNamespaces.has(parent) && allLiterals.has(last)) return true;
  if (allDynamic.some((d) => key.startsWith(d) && d.includes("."))) return true;
  return false;
}

for (const k of es.keys()) if (!isUsed(k)) warnings.push(`sin uso aparente: ${k}`);

for (const w of warnings) console.warn(`aviso  ${w}`);
for (const e of errors) console.error(`error  ${e}`);
console.log(
  `\n${es.size} claves · ${errors.length} errores · ${warnings.length} avisos` +
    ` (${relative(root, join(src, "messages"))})`,
);
process.exit(errors.length ? 1 : 0);
