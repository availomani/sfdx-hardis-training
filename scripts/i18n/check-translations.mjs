#!/usr/bin/env node
/**
 * Lists the translated lab files whose English source has moved since they were
 * translated, using the source_rev front matter each translation carries.
 *
 *   node scripts/i18n/check-translations.mjs
 *   node scripts/i18n/check-translations.mjs --strict   (exit 1 when anything is behind)
 *
 * A translation behind its source is not an error by default: it is a list of
 * what to re-read. CI runs it in --strict mode only once a locale is declared
 * as maintained.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");
const STRICT = process.argv.includes("--strict");

function git(args) {
  const res = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 ? (res.stdout || "").trim() : "";
}

/**
 * Whether this clone knows that commit. A source_rev naming one it does not,
 * a squashed or rebased SHA for instance, cannot be compared with anything,
 * and staying silent would pass a stale translation forever.
 */
function isKnownCommit(rev) {
  const res = spawnSync("git", ["cat-file", "-e", `${rev}^{commit}`], { cwd: ROOT, encoding: "utf8" });
  return res.status === 0;
}

function sourceRev(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }
  const rev = match[1].match(/^source_rev:\s*["']?([^"'\s]*)["']?\s*$/m);
  return rev ? rev[1] : "";
}

function walk(dir, prefix = "") {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walk(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

const locales = fs
  .readdirSync(LABS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name) && entry.name !== "en")
  .map((entry) => entry.name);

if (locales.length === 0) {
  console.log("English only: no translation to check.");
  process.exit(0);
}

const englishFiles = new Set(walk(path.join(LABS, "en")));
let behind = 0;
let missing = 0;
let untracked = 0;

for (const locale of locales) {
  const files = walk(path.join(LABS, locale));
  console.log(`\n${locale}: ${files.length} file(s)`);

  for (const rel of englishFiles) {
    if (!files.includes(rel)) {
      console.log(`  MISSING   ${rel}`);
      missing++;
    }
  }

  for (const rel of files) {
    if (!englishFiles.has(rel)) {
      console.log(`  ORPHAN    ${rel}  (no English source any more)`);
      continue;
    }
    const rev = sourceRev(path.join(LABS, locale, rel));
    if (!rev) {
      console.log(`  NO REV    ${rel}  (set source_rev to the SHA of the English file)`);
      untracked++;
      continue;
    }
    const englishPath = `labs/en/${rel}`;
    const latest = git(["log", "-1", "--format=%H", "--", englishPath]);
    if (!latest) {
      continue;
    }
    if (latest === rev) {
      continue;
    }
    if (!isKnownCommit(rev)) {
      console.log(`  UNKNOWN   ${rel}  (source_rev ${rev} is not a commit this clone knows)`);
      behind++;
      continue;
    }
    const changed = git(["log", "--oneline", `${rev}..HEAD`, "--", englishPath]);
    if (changed) {
      console.log(`  BEHIND    ${rel}`);
      for (const line of changed.split("\n")) {
        console.log(`              ${line}`);
      }
      behind++;
    }
  }
}

console.log("");
console.log(`${behind} behind, ${missing} missing, ${untracked} without a source_rev.`);
if (STRICT && (behind > 0 || missing > 0 || untracked > 0)) {
  process.exit(1);
}
