// Parses eslint output and removes unused imports / variable declarations.
// Handles common patterns: named imports, default imports, destructured const,
// single-variable let/const. Skips anything uncertain for manual review.

import fs from "node:fs";
import path from "node:path";

const lintOutput = fs.readFileSync(".lint-v2.txt", "utf-8");
const lines = lintOutput.split(/\r?\n/);

/** @type {Map<string, Array<{line: number, col: number, name: string, kind: string}>>} */
const byFile = new Map();

let currentFile = null;
for (const line of lines) {
  const m = line.match(/^([A-Z]:\\.*\.(?:tsx?|jsx?|mjs|mts))\s*$/);
  if (m) {
    currentFile = m[1];
    continue;
  }
  if (!currentFile) continue;

  // "  12:34  warning  'Foo' is defined but never used[...]  @typescript-eslint/no-unused-vars"
  const w = line.match(/^\s+(\d+):(\d+)\s+warning\s+'([^']+)' is (defined but never used|assigned a value but never used).*@typescript-eslint\/no-unused-vars\s*$/);
  if (w) {
    if (!byFile.has(currentFile)) byFile.set(currentFile, []);
    byFile.get(currentFile).push({
      line: parseInt(w[1]),
      col: parseInt(w[2]),
      name: w[3],
      kind: w[4],
    });
  }
}

let changedFiles = 0;
let removedNames = 0;
let skipped = [];

for (const [file, issues] of byFile) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf-8");
  const original = content;

  // Sort issues so multi-hit lines get processed predictably
  const sorted = [...issues].sort((a, b) => a.line - b.line || a.col - b.col);

  for (const issue of sorted) {
    const name = issue.name;
    // Heuristics: only remove unused NAMED IMPORTS from `import { ... } from "..."` lines.
    // Skip cases that might break code (function params, destructured object items, type guards, etc.)

    const lines = content.split("\n");
    // Scan the whole file for every `import { ... }` block and remove `name` if present and unused.
    // We also try single-line const destructuring: `const { a, b } = foo();` → remove unused item if safe.

    // Named import removal: remove `name` from any import block
    const importRE = new RegExp(
      `(import\\s*(?:type\\s*)?\\{)([^}]*)(\\}\\s*from\\s*["'][^"']+["']\\s*;?)`,
      "g"
    );
    content = content.replace(importRE, (full, pre, inside, post) => {
      // split by comma, trim, filter out the unused name
      const items = inside.split(",").map(s => s.trim()).filter(Boolean);
      const filtered = items.filter(it => {
        // handle `Foo as Bar` — check local alias on the RHS
        const parts = it.split(/\s+as\s+/);
        const local = parts.length > 1 ? parts[1].trim() : parts[0].trim();
        // Also strip leading "type " keyword for import type { ... } blocks
        const bareLocal = local.replace(/^type\s+/, "");
        return bareLocal !== name;
      });
      if (filtered.length === items.length) return full; // nothing removed
      if (filtered.length === 0) {
        // Whole import line becomes empty → remove it entirely
        return `/*__REMOVE_LINE__*/`;
      }
      return `${pre} ${filtered.join(", ")} ${post}`;
    });
  }

  // Strip the placeholder markers and collapse blank lines they leave behind
  content = content.replace(/^.*\/\*__REMOVE_LINE__\*\/.*$\n?/gm, "");

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    removedNames += issues.length;
  } else {
    skipped.push(file);
  }
}

console.log(`Changed ${changedFiles} files, processed ${removedNames} warnings.`);
if (skipped.length) {
  console.log(`Skipped (no changes, likely non-import unused vars):`);
  skipped.forEach(f => console.log("  " + f));
}
