// Prefix unused function parameters + destructured vars with `_`
// to signal intentional-unused and silence the lint warning.
//
// Parses .lint-v3.txt, reads each warning's line:col, and if the exact
// token at that position is a simple identifier, replaces it with `_name`.

import fs from "node:fs";

const lint = fs.readFileSync(".lint-v3.txt", "utf-8");
const lines = lint.split(/\r?\n/);

/** @type {Array<{file: string, line: number, col: number, name: string}>} */
const items = [];
let file = null;
for (const l of lines) {
  const fm = l.match(/^([A-Z]:\\.*\.(?:tsx?|jsx?|mts|mjs))\s*$/);
  if (fm) { file = fm[1]; continue; }
  if (!file) continue;
  const wm = l.match(/^\s+(\d+):(\d+)\s+warning\s+'([^']+)'.*@typescript-eslint\/no-unused-vars\s*$/);
  if (wm) {
    items.push({ file, line: parseInt(wm[1]), col: parseInt(wm[2]), name: wm[3] });
  }
}

// Group by file, process from bottom-up so line offsets stay valid
const byFile = new Map();
for (const it of items) {
  if (!byFile.has(it.file)) byFile.set(it.file, []);
  byFile.get(it.file).push(it);
}

let changedFiles = 0;
let renamed = 0;

for (const [fp, its] of byFile) {
  if (!fs.existsSync(fp)) continue;
  const content = fs.readFileSync(fp, "utf-8");
  const contentLines = content.split("\n");

  // Sort desc so we edit bottom-first (col-based, same line doesn't shift)
  its.sort((a, b) => b.line - a.line || b.col - a.col);

  let modified = false;
  for (const it of its) {
    if (it.name.startsWith("_")) continue;
    const lineIdx = it.line - 1;
    const colIdx = it.col - 1;
    if (lineIdx < 0 || lineIdx >= contentLines.length) continue;
    const row = contentLines[lineIdx];
    // Check that the identifier actually sits at this position
    const slice = row.slice(colIdx, colIdx + it.name.length);
    if (slice !== it.name) continue;
    // Make sure the char before is a boundary so we don't corrupt identifiers
    const before = colIdx > 0 ? row[colIdx - 1] : "";
    const after = row[colIdx + it.name.length] ?? "";
    const isBoundary = (c) => !/[A-Za-z0-9_$]/.test(c);
    if (!isBoundary(before) || !isBoundary(after)) continue;
    contentLines[lineIdx] =
      row.slice(0, colIdx) + "_" + it.name + row.slice(colIdx + it.name.length);
    modified = true;
    renamed++;
  }

  if (modified) {
    fs.writeFileSync(fp, contentLines.join("\n"));
    changedFiles++;
  }
}

console.log(`Renamed ${renamed} identifiers in ${changedFiles} files.`);
