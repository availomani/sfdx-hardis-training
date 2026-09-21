#!/usr/bin/env node
/**
 * Aligns the pipes of every markdown table under labs/, so that each column is
 * the width of its widest cell and the pipes line up down the page.
 *
 *   node scripts/i18n/align-tables.mjs            every locale
 *   node scripts/i18n/align-tables.mjs fr          one locale
 *   node scripts/i18n/align-tables.mjs fr --check  writes nothing, lists what is out
 *
 * This is markdownlint's MD060 in "aligned" style, which the shared sfdx-hardis
 * configuration turns on. A translation is where it bites: the English table was
 * padded by hand to its own widths, and the moment a cell says "Contributeur
 * avancé" where it said "advanced", every pipe under it is one character out.
 *
 * Tables inside a code fence are left alone, and so is the indentation of a
 * table inside an admonition.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const wanted = args.filter((arg) => !arg.startsWith("--"));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

/** The cells of a table row, without the outer pipes. A \| stays in its cell. */
function cells(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      current += "\\|";
      i++;
      continue;
    }
    if (trimmed[i] === "|") {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += trimmed[i];
  }
  out.push(current.trim());
  return out;
}

const isDelimiter = (line) => /^\s*\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)?\|?\s*$/.test(line.trim());
const isRow = (line) => /^\s*\|/.test(line);

/** The width markdownlint counts, which is UTF-16 units, emoji included. */
const width = (text) => text.length;

function alignTable(rows, indent) {
  const grid = rows.map((line) => cells(line));
  const columns = Math.max(...grid.map((row) => row.length));
  const alignments = grid[1].map((cell) => ({
    left: cell.startsWith(":"),
    right: cell.endsWith(":")
  }));
  const widths = [];
  for (let c = 0; c < columns; c++) {
    let max = 3;
    grid.forEach((row, r) => {
      if (r === 1) {
        return;
      }
      max = Math.max(max, width(row[c] || ""));
    });
    const marks = (alignments[c] ? (alignments[c].left ? 1 : 0) + (alignments[c].right ? 1 : 0) : 0);
    widths.push(Math.max(max, 3 + marks));
  }
  return grid.map((row, r) => {
    // The delimiter row is written the way the English labs write it, with the
    // dashes running pipe to pipe and no space inside. MD060 accepts either,
    // and matching what is already there keeps a locale's diff to the cells
    // that actually changed.
    if (r === 1) {
      const out = widths.map((w, c) => {
        const align = alignments[c] || {};
        const dashes = "-".repeat(w + 2 - (align.left ? 1 : 0) - (align.right ? 1 : 0));
        return `${align.left ? ":" : ""}${dashes}${align.right ? ":" : ""}`;
      });
      return `${indent}|${out.join("|")}|`;
    }
    const out = [];
    for (let c = 0; c < columns; c++) {
      const cell = row[c] || "";
      out.push(cell + " ".repeat(widths[c] - width(cell)));
    }
    return `${indent}| ${out.join(" | ")} |`;
  });
}

function align(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opening = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      out.push(line);
      if (opening && line.trim().startsWith(fence)) {
        fence = null;
      }
      continue;
    }
    if (opening) {
      fence = opening[1];
      out.push(line);
      continue;
    }
    if (isRow(line) && i + 1 < lines.length && isDelimiter(lines[i + 1]) && isRow(lines[i + 1])) {
      const block = [line];
      let j = i + 1;
      while (j < lines.length && isRow(lines[j])) {
        block.push(lines[j]);
        j++;
      }
      const indent = (line.match(/^\s*/) || [""])[0];
      out.push(...alignTable(block, indent));
      i = j - 1;
      continue;
    }
    out.push(line);
  }
  return out.join(eol);
}

const locales = fs
  .readdirSync(LABS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
  .map((entry) => entry.name)
  .filter((locale) => wanted.length === 0 || wanted.includes(locale));

let changed = 0;
for (const locale of locales) {
  for (const file of walk(path.join(LABS, locale))) {
    const original = fs.readFileSync(file, "utf8");
    const updated = align(original);
    if (updated === original) {
      continue;
    }
    changed++;
    console.log(`  ${CHECK ? "misaligned" : "aligned"}  ${path.relative(ROOT, file).split(path.sep).join("/")}`);
    if (!CHECK) {
      fs.writeFileSync(file, updated, "utf8");
    }
  }
}

console.log("");
console.log(`${changed} file(s) ${CHECK ? "with a misaligned table" : "aligned"}.`);
if (CHECK && changed > 0) {
  console.error("Run: node scripts/i18n/align-tables.mjs");
  process.exit(1);
}
