#!/usr/bin/env node
/**
 * Stamps every translated lab with the SHA of the English file it matches.
 *
 *   node scripts/i18n/stamp-source-rev.mjs            every locale
 *   node scripts/i18n/stamp-source-rev.mjs fr          one locale
 *   node scripts/i18n/stamp-source-rev.mjs fr --check  writes nothing, lists what would change
 *
 * `source_rev` is what makes a translation checkable: it names the version of
 * the English page the translation was made from, so
 * scripts/i18n/check-translations.mjs can say which ones the source has moved
 * past. Writing those SHAs by hand, thirty at a time, is how they end up wrong.
 *
 * **Run it after the English side of the change is committed.** The SHA it
 * stamps is the last commit that touched labs/en/<file>, so a stamp taken while
 * the English file is still uncommitted is a stamp for the version before yours,
 * and it says the translation is up to date when it is not.
 *
 * It refuses to stamp a translation whose English source does not exist, and it
 * leaves everything else in the file alone: only the source_rev line changes.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const wanted = args.filter((arg) => !arg.startsWith("--"));

function git(argv) {
  const res = spawnSync("git", argv, { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 ? (res.stdout || "").trim() : "";
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
  .map((entry) => entry.name)
  .filter((locale) => wanted.length === 0 || wanted.includes(locale));

if (locales.length === 0) {
  console.log(wanted.length > 0 ? `No such locale under labs/: ${wanted.join(", ")}` : "English only: nothing to stamp.");
  process.exit(wanted.length > 0 ? 1 : 0);
}

let stamped = 0;
let already = 0;
const problems = [];

for (const locale of locales) {
  for (const rel of walk(path.join(LABS, locale))) {
    const target = path.join(LABS, locale, rel);
    const englishPath = `labs/en/${rel}`;
    if (!fs.existsSync(path.join(ROOT, englishPath))) {
      problems.push(`labs/${locale}/${rel} has no English source at ${englishPath}`);
      continue;
    }
    const sha = git(["log", "-1", "--format=%H", "--", englishPath]);
    if (!sha) {
      problems.push(`${englishPath} has no commit yet: commit the English side first, then stamp`);
      continue;
    }
    const text = fs.readFileSync(target, "utf8");
    const front = text.match(/^---\r?\n([\s\S]*?\r?\n)---/);
    if (!front) {
      problems.push(`labs/${locale}/${rel} has no front matter`);
      continue;
    }
    if (!/^source_rev:/m.test(front[1])) {
      problems.push(`labs/${locale}/${rel} has no source_rev key: add one, even empty`);
      continue;
    }
    const updated = text.replace(/^source_rev:.*$/m, `source_rev: "${sha}"`);
    if (updated === text) {
      already++;
      continue;
    }
    stamped++;
    console.log(`  ${CHECK ? "would stamp" : "stamped"}  labs/${locale}/${rel}  ${sha.slice(0, 8)}`);
    if (!CHECK) {
      fs.writeFileSync(target, updated, "utf8");
    }
  }
}

console.log("");
console.log(`${stamped} file(s) ${CHECK ? "to stamp" : "stamped"}, ${already} already current.`);

if (problems.length > 0) {
  console.error("");
  console.error(`${problems.length} problem(s):`);
  problems.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}
