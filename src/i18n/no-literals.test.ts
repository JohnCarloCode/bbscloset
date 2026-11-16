// Regla sencilla: los componentes de src/components y src/features no llevan
// textos visibles escritos a mano; reciben los textos por props o usan t().
// Detecta texto JSX con letras y atributos de texto (aria-label, title,
// placeholder, alt, label) con un literal. Las páginas /dev quedan fuera.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const TEXT_ATTRS = new Set(["aria-label", "title", "placeholder", "alt", "label"]);
const LETTERS = /\p{L}{2,}/u;

function tsxFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return tsxFiles(path);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [path] : [];
  });
}

function findLiterals(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && LETTERS.test(node.text)) {
      found.push(node.text.trim());
    } else if (
      ts.isJsxAttribute(node) &&
      TEXT_ATTRS.has(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      LETTERS.test(node.initializer.text)
    ) {
      found.push(`${node.name.getText(source)}="${node.initializer.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.map((text) => `${file.slice(root.length)}: ${text}`);
}

describe("sin textos visibles en el código", () => {
  it("src/components y src/features no tienen literales en JSX", () => {
    const files = [...tsxFiles(join(root, "components")), ...tsxFiles(join(root, "features"))];
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap(findLiterals)).toEqual([]);
  });
});
