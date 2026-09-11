// @vitest-environment node
import { describe, it, expect } from "vitest";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

/**
 * Functions in src/lib/data.ts take an optional userId and, in production,
 * refuse to run without it (resolveUserId throws before any request is sent).
 * Local development substitutes a dev user instead, so a call site that
 * forgets the id works on a laptop and fails for every real user. That is how
 * the Settings CSV import and the Buy List and History remove actions broke.
 *
 * Because the parameter is optional, TypeScript cannot catch the omission.
 * This test does: it finds every data.ts function that resolves a userId,
 * then every call to one of them elsewhere in src, and fails on any call
 * that does not pass enough arguments to reach the userId.
 */

const SRC = path.resolve(process.cwd(), "src");
const DATA = path.join(SRC, "lib", "data.ts");

function parse(file: string) {
  return ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
}

function userIdFunctions(): Map<string, number> {
  const out = new Map<string, number>();
  parse(DATA).forEachChild((node) => {
    if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) return;
    const exported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const index = node.parameters.findIndex((p) => p.name.getText() === "userId");
    if (exported && index >= 0 && /resolveUserId\(\s*userId\b/.test(node.body.getText())) {
      out.set(node.name.text, index);
    }
  });
  return out;
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function callsMissingUserId(needs: Map<string, number>): string[] {
  const problems: string[] = [];
  for (const file of sourceFiles(SRC)) {
    if (file === DATA) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("@/lib/data")) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const imported = new Set<string>();
    sf.forEachChild((node) => {
      if (!ts.isImportDeclaration(node)) return;
      if ((node.moduleSpecifier as ts.StringLiteral).text !== "@/lib/data") return;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) imported.add((el.propertyName ?? el.name).text);
      }
    });
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const index = needs.get(name);
        if (index !== undefined && imported.has(name) && node.arguments.length <= index) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          problems.push(`${path.relative(SRC, file)}:${line} ${name}() without userId`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return problems;
}

describe("data layer calls pass the userId", () => {
  const needs = userIdFunctions();

  it("finds the data functions that need a userId", () => {
    // Guards against this test silently checking nothing after a refactor.
    expect(needs.size).toBeGreaterThan(10);
    expect(needs.has("bulkCreateWines")).toBe(true);
  });

  it("every call site passes it", () => {
    expect(callsMissingUserId(needs)).toEqual([]);
  });
});
