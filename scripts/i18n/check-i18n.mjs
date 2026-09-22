#!/usr/bin/env node
/**
 * Checks the translations of the generated pages, `i18n/<locale>.json`.
 *
 *   node scripts/i18n/check-i18n.mjs
 *   node scripts/i18n/check-i18n.mjs --stamp     (write source_rev from git)
 *
 * The labs have `source_rev` and `check-translations.mjs`; these files had
 * nothing. They are the backlog, the story pages and the badge pages, and
 * `strings()` falls back to English key by key on purpose, so a missing one is
 * invisible: the page still builds, and a French reader gets an English
 * sentence in the middle of a French paragraph with nothing saying so.
 *
 * Two different things, and only one of them fails:
 *
 *   - a key of `i18n/en.json` that a locale does not answer, or a story, level
 *     or cast member of `training-universe.json` it never translated, **fails**.
 *     It is mechanical, and it is exactly the silent hole described above
 *   - a locale whose `source_rev` is behind the last commit of `i18n/en.json` is
 *     **reported**. English is the reference and a translation is allowed to
 *     lag: the list is what to re-read, like the labs
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const I18N = path.join(ROOT, "i18n");
const STAMP = process.argv.includes("--stamp");

// Keys that belong to a locale file and have no English counterpart
const OWN_KEYS = new Set(["$comment", "lang", "source_rev", "universe"]);

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return result.status === 0 ? (result.stdout || "").trim() : "";
}

/** Every leaf of an object, as dotted paths, with arrays counted by length. */
function leaves(value, prefix = "", out = []) {
  if (Array.isArray(value)) {
    out.push(`${prefix}[${value.length}]`);
    return out;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      leaves(value[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push(prefix);
  return out;
}

const english = read(path.join(I18N, "en.json"));
const universe = read(path.join(ROOT, "training-universe.json"));
const englishLeaves = leaves(english).filter((one) => !OWN_KEYS.has(one.split(".")[0]));

const locales = fs
  .readdirSync(I18N)
  .filter((name) => name.endsWith(".json") && name !== "en.json")
  .map((name) => name.replace(/\.json$/, ""));

if (locales.length === 0) {
  console.log("English only: no translation of the generated pages to check.");
  process.exit(0);
}

const problems = [];
let behind = 0;

for (const locale of locales) {
  const file = path.join(I18N, `${locale}.json`);
  const translated = read(file);
  const found = new Set(leaves(translated));
  console.log(`\n${locale}:`);

  // 1. Every English key answered, arrays of the same length
  const missing = englishLeaves.filter((one) => !found.has(one));
  for (const key of missing) {
    problems.push(`i18n/${locale}.json: ${key} is missing, so that line reads in English`);
  }

  // 2. Every piece of the fiction translated
  const fiction = translated.universe || {};
  const stories = fiction.stories || {};
  for (const story of universe.userStories) {
    const one = stories[story.id];
    if (!one) {
      problems.push(`i18n/${locale}.json: universe.stories.${story.id} is missing`);
      continue;
    }
    for (const field of ["title", "story"]) {
      if (!one[field]) {
        problems.push(`i18n/${locale}.json: universe.stories.${story.id}.${field} is missing`);
      }
    }
    const criteria = Array.isArray(one.acceptance) ? one.acceptance.length : 0;
    if (criteria !== story.acceptance.length) {
      problems.push(
        `i18n/${locale}.json: universe.stories.${story.id}.acceptance has ${criteria} criteria, the story has ${story.acceptance.length}`
      );
    }
  }
  for (const person of universe.cast) {
    if (!(fiction.cast || {})[person.handle]) {
      problems.push(`i18n/${locale}.json: universe.cast.${person.handle} is missing`);
    }
  }
  for (const level of universe.levels) {
    if (!(fiction.levels || {})[String(level.level)]) {
      problems.push(`i18n/${locale}.json: universe.levels.${level.level} is missing`);
    }
  }
  if (!(fiction.company || {}).pitch) {
    problems.push(`i18n/${locale}.json: universe.company.pitch is missing`);
  }

  console.log(`  ${found.size} value(s), ${missing.length} missing against i18n/en.json`);

  // 3. Staleness, reported like the labs
  const latest = git(["log", "-1", "--format=%H", "--", "i18n/en.json"]);
  if (STAMP) {
    if (latest) {
      const stamped = { ...translated, source_rev: latest };
      fs.writeFileSync(file, `${JSON.stringify(stamped, null, 2)}\n`, "utf8");
      console.log(`  stamped source_rev ${latest.slice(0, 8)}`);
    }
    continue;
  }
  const rev = translated.source_rev;
  if (!rev) {
    console.log("  NO REV    set source_rev to the commit of i18n/en.json this was translated from");
    console.log("            node scripts/i18n/check-i18n.mjs --stamp");
  } else if (latest && rev !== latest) {
    console.log(`  BEHIND    i18n/en.json has moved to ${latest.slice(0, 8)}, this says ${rev.slice(0, 8)}`);
    behind++;
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} hole(s) that would read in English:`);
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

console.log(
  `\nEvery locale answers every key${behind > 0 ? `, ${behind} behind their English source and worth re-reading` : ""}.`
);
