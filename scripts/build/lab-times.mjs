#!/usr/bin/env node
/**
 * Writes the time learners were observed to take into the pages of the course.
 *
 *   node scripts/build/lab-times.mjs            every locale
 *   node scripts/build/lab-times.mjs --check    writes nothing, fails when a page is out of date
 *   node scripts/build/lab-times.mjs --stamp    after committing: the translations this run touched
 *
 * Three kinds of page announce a time, in every locale:
 *
 *   a lab          **Time**: ~55 min (observed: median 56 min, 11 learners, fastest 16 min)
 *   a level page   one row per lab, and the time of the whole level
 *   the home page  one row per level
 *
 * The figures are stats/course-stats.json, which scripts/stats/course-stats.mjs
 * writes once a week, and the rules are scripts/stats/lab-times.mjs: the median,
 * rounded down to five minutes for a lab and to a quarter of an hour for a
 * level. A lab fewer than three learners went through takes the estimate
 * training-universe.json gives it, which is where the estimates live now that
 * the pages follow the learners.
 *
 * Nobody edits a time by hand to follow the figures. The weekly workflow runs
 * this and commits what it changed.
 *
 * About --stamp. A translation names the commit of the English page it was
 * made from, and this script changes the English page and its translations
 * together. Once the English side is committed, the translations that were up
 * to date before the run are stamped with the new commit: they still say what
 * the English page says. A translation that was already behind is left alone,
 * because this run did not catch it up.
 *
 * Stamp once the English commit has its final name. A rebase renames it, and a
 * stamp written before would name a commit that no longer exists.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { strings, fill } from "../lib/strings.mjs";
import { announcedByLab } from "../stats/compute.mjs";
import { announcedTimes, withAnnouncedTimes, duration } from "../stats/lab-times.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");
const REFERENCE = "en";
// What --stamp has to do, written by the run before it. Git ignores .cache/
const PENDING = path.join(ROOT, ".cache", "lab-times-stamp.json");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");

if (args.includes("--stamp")) {
  stamp();
} else {
  run();
}

function run() {
  const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
  const statsFile = path.join(ROOT, "stats", "course-stats.json");
  const stats = fs.existsSync(statsFile) ? JSON.parse(fs.readFileSync(statsFile, "utf8")) : null;
  const times = announcedTimes(stats, announcedByLab(universe));

  const locales = fs
    .readdirSync(LABS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
    .map((entry) => entry.name);

  const changed = [];
  // A run before this one may be waiting for its stamp. What it noted about a
  // translation is what counts: by now that page has been rewritten once, and
  // comparing it again would say nothing about how it stood before.
  const waiting = !CHECK && fs.existsSync(PENDING) ? JSON.parse(fs.readFileSync(PENDING, "utf8")) : [];
  const pending = [...waiting];
  for (const locale of locales) {
    const describe = observedIn(locale);
    for (const rel of pagesOf(universe)) {
      const file = path.join(LABS, locale, rel);
      if (!fs.existsSync(file)) {
        continue;
      }
      const before = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      const after = withAnnouncedTimes(before, rel, times, universe, describe);
      if (shape(after) === shape(before)) {
        continue;
      }
      changed.push(`labs/${locale}/${rel}`);
      if (CHECK) {
        continue;
      }
      if (locale !== REFERENCE && !waiting.some((one) => one.file === `labs/${locale}/${rel}`)) {
        const english = `labs/${REFERENCE}/${rel}`;
        const rev = (before.match(/^source_rev:\s*"?([0-9a-f]+)"?\s*$/m) || [])[1];
        pending.push({ file: `labs/${locale}/${rel}`, english, wasCurrent: Boolean(rev) && rev === lastCommit(english) });
      }
      fs.writeFileSync(file, after, "utf8");
    }
  }

  if (CHECK) {
    if (changed.length > 0) {
      console.error(`${changed.length} page(s) announce a time the figures no longer give. Run: node scripts/build/lab-times.mjs`);
      changed.forEach((file) => console.error(`  ${file}`));
      process.exit(1);
    }
    console.log("Every page announces the time the figures give.");
    return;
  }
  if (changed.length === 0) {
    console.log("Every page already announces the time the figures give.");
    return;
  }
  // A time that gains or loses a digit moves every pipe of its table
  const aligned = spawnSync(process.execPath, [path.join(ROOT, "scripts", "i18n", "align-tables.mjs")], { cwd: ROOT, encoding: "utf8" });
  if (aligned.status !== 0) {
    console.error(`The tables could not be aligned again:\n${aligned.stdout}${aligned.stderr}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(PENDING), { recursive: true });
  fs.writeFileSync(PENDING, JSON.stringify(pending, null, 2) + "\n", "utf8");
  console.log(`${changed.length} page(s) written:`);
  changed.forEach((file) => console.log(`  ${file}`));
  if (pending.some((one) => one.wasCurrent)) {
    console.log(`Commit labs/${REFERENCE}/, then run: node scripts/build/lab-times.mjs --stamp`);
  }
}

/** The pages that announce a time, as paths inside a locale. */
function pagesOf(universe) {
  const out = ["index.md"];
  for (const level of universe.levels) {
    out.push(`${level.slug}/index.md`, ...level.labs.map((lab) => `${level.slug}/${lab.slug}.md`));
  }
  return out;
}

/**
 * A page without the padding of its tables: two versions that differ only by
 * the width of a column say the same thing, and align-tables.mjs settles it.
 */
function shape(text) {
  return text
    .split("\n")
    .map((line) => (line.trimStart().startsWith("|") ? line.replace(/ +/g, " ").replace(/-+/g, "-") : line))
    .join("\n");
}

/**
 * What was observed behind a time, as a sentence of this language: the median,
 * how many learners they were, and the fastest of them when it is worth saying. A lab timed alone
 * says so in a parenthesis, a lab timed with its neighbours names them, and a
 * level names the labs its figure covers.
 */
function observedIn(locale) {
  const w = strings(locale).stats;
  return (observation, own) => {
    const labs = observation.labs.length === 1
      ? fill(w.lab, { lab: observation.labs[0] })
      : fill(observation.labs.length === 2 ? w.labsPair : w.labs, { first: observation.labs[0], last: observation.labs[observation.labs.length - 1] });
    const values = {
      labs,
      fastest: observation.fastest === null ? "" : fill(w.fastest, { time: duration(observation.fastest) }),
      median: duration(observation.median),
      learners: observation.sample === 1 ? w.learnerOne : fill(w.learnerMany, { sample: observation.sample })
    };
    if (own.length > 1) {
      return fill(w.observedLevel, values);
    }
    return fill(observation.labs.length === 1 ? w.observed : w.observedTogether, values);
  };
}

/** The last commit that touched a file, or null. */
function lastCommit(file) {
  const res = spawnSync("git", ["log", "-1", "--format=%H", "--", file], { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 && res.stdout.trim() ? res.stdout.trim() : null;
}

function stamp() {
  if (!fs.existsSync(PENDING)) {
    console.log("Nothing to stamp: no run wrote a translation since the last stamp.");
    return;
  }
  const pending = JSON.parse(fs.readFileSync(PENDING, "utf8"));
  let stamped = 0;
  for (const one of pending.filter((entry) => entry.wasCurrent)) {
    const file = path.join(ROOT, one.file);
    const rev = lastCommit(one.english);
    const text = fs.readFileSync(file, "utf8");
    const next = text.replace(/^source_rev:.*$/m, `source_rev: "${rev}"`);
    if (rev && next !== text) {
      fs.writeFileSync(file, next, "utf8");
      stamped++;
    }
  }
  fs.rmSync(PENDING, { force: true });
  console.log(`${stamped} translation(s) stamped with the commit of their English page.`);
}
