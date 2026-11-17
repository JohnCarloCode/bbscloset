// Regla sencilla: los componentes de src/components, src/features y src/app
// no llevan textos visibles escritos a mano; reciben los textos por props o
// usan t(). Detecta texto JSX con letras y atributos de texto (aria-label,
// title, placeholder, alt, label…) con un literal, también dentro de {"…"}
// o de una plantilla sin variables.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const TEXT_ATTRS = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "title",
  "placeholder",
  "alt",
  "label",
]);
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
  // "texto", {"texto"} o {`texto`} (sin variables)
  const literalText = (node: ts.Node | undefined): string | null => {
    if (!node) return null;
    if (ts.isJsxExpression(node)) return literalText(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    return null;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && LETTERS.test(node.text)) {
      found.push(node.text.trim());
    } else if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
      LETTERS.test(literalText(node) ?? "")
    ) {
      found.push(`{${JSON.stringify(literalText(node))}}`);
    } else if (ts.isJsxAttribute(node) && TEXT_ATTRS.has(node.name.getText(source))) {
      const text = literalText(node.initializer);
      if (text !== null && LETTERS.test(text)) {
        found.push(`${node.name.getText(source)}="${text}"`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found.map((text) => `${file.slice(root.length)}: ${text}`);
}

describe("sin textos visibles en el código", () => {
  it("src/components, src/features y src/app no tienen literales en JSX", () => {
    const files = ["components", "features", "app"].flatMap((dir) => tsxFiles(join(root, dir)));
    expect(files.length).toBeGreaterThan(0);
    expect(files.flatMap(findLiterals)).toEqual([]);
  });
});
