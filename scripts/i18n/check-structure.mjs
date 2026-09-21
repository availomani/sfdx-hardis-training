#!/usr/bin/env node
/**
 * Compares the shape of every translated lab with its English source: headings,
 * images, code fences, "Under the hood" blocks, pill references, admonitions
 * and tables.
 *
 *   node scripts/i18n/check-structure.mjs
 *   node scripts/i18n/check-structure.mjs fr
 *
 * It says nothing about the words, and that is the point. A translation loses
 * things quietly: a paragraph skipped, an image left out, an "Under the hood"
 * block that never got carried over. None of that fails a build, none of it
 * shows up in a diff anybody reads, and a learner meets it as a step that
 * refers to a picture which is not there.
 *
 * **It reports, it never fails.** A deliberate difference is allowed, and the
 * course has one: the French home page carries an extra admonition saying the
 * product stays in English. Read the list, do not silence it.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");

const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));

function walk(dir, prefix = "", out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      walk(path.join(dir, entry.name), rel, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

const count = (text, pattern) => (text.match(pattern) || []).length;

/** What has to survive a translation, whatever the words become. */
const SHAPE = {
  "## headings": /^## /gm,
  "### headings": /^### /gm,
  images: /^!\[/gm,
  "code fences": /^```/gm,
  "Under the hood blocks": /<details/g,
  "pill references": /\*\*\(\d+\)\*\*/g,
  admonitions: /^!!! /gm,
  tables: /^\|[-: ]+\|/gm
};

const locales = fs
  .readdirSync(LABS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name) && entry.name !== "en")
  .map((entry) => entry.name)
  .filter((locale) => wanted.length === 0 || wanted.includes(locale));

if (locales.length === 0) {
  console.log("English only: nothing to compare.");
  process.exit(0);
}

const english = walk(path.join(LABS, "en"));
let compared = 0;
let differing = 0;

for (const locale of locales) {
  for (const rel of english) {
    const translated = path.join(LABS, locale, rel);
    if (!fs.existsSync(translated)) {
      console.log(`MISSING  labs/${locale}/${rel}`);
      differing++;
      continue;
    }
    compared++;
    const source = fs.readFileSync(path.join(LABS, "en", rel), "utf8");
    const target = fs.readFileSync(translated, "utf8");
    const gaps = Object.entries(SHAPE)
      .map(([name, pattern]) => [name, count(source, pattern), count(target, pattern)])
      .filter(([, a, b]) => a !== b);
    if (gaps.length === 0) {
      continue;
    }
    differing++;
    console.log(`labs/${locale}/${rel}`);
    gaps.forEach(([name, a, b]) => console.log(`   ${name}: en=${a} ${locale}=${b}`));
  }
}

console.log("");
console.log(
  differing === 0
    ? `${compared} translated lab(s) match their English source, shape for shape.`
    : `${compared} compared, ${differing} differ. Each one is either something the translation lost, or a difference somebody meant.`
);
