#!/usr/bin/env node
/**
 * Writes the time learners were observed to take into the pages of the course.
 *
 *   node scripts/build/lab-times.mjs            every locale
 *   node scripts/build/lab-times.mjs --check    writes nothing, fails when a page is out of date
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
 * About the translations. A translation names, in source_rev, the content hash
 * of the English page it was made from (git hash-object, as stamp-source-rev.mjs
 * writes it: a commit would not survive the squash merge of a Pull Request), and
 * this script changes the English page and its translations together. A
 * translation that was up to date before the run still says what the English
 * page says, so the run restamps it with the hash of the rewritten English page,
 * once the tables are aligned, since the alignment is part of the content. A
 * translation that was already behind is left alone: this run did not catch it
 * up. Nothing to commit first and nothing to stamp afterwards.
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

const args = process.argv.slice(2);
const CHECK = args.includes("--check");

run();

function run() {
  const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
  const statsFile = path.join(ROOT, "stats", "course-stats.json");
  const stats = fs.existsSync(statsFile) ? JSON.parse(fs.readFileSync(statsFile, "utf8")) : null;
  const times = announcedTimes(stats, announcedByLab(universe));

  const locales = fs
    .readdirSync(LABS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
    .map((entry) => entry.name);

  // The English pages as they are before anything is rewritten: a translation
  // whose stamp matches is current, and stays so once both are rewritten together
  const englishBefore = new Map();
  for (const rel of pagesOf(universe)) {
    const english = `labs/${REFERENCE}/${rel}`;
    if (fs.existsSync(path.join(ROOT, english))) {
      englishBefore.set(rel, hashObject(english));
    }
  }

  const changed = [];
  const englishChanged = new Set();
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
      if (locale === REFERENCE) {
        englishChanged.add(rel);
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
  // A translation that was current before the run still says what its rewritten
  // English page says, whether the run touched it or not: stamp it with that page
  // as it is now, aligned tables included
  let stamped = 0;
  for (const rel of englishChanged) {
    const rev = hashObject(`labs/${REFERENCE}/${rel}`);
    for (const locale of locales.filter((one) => one !== REFERENCE)) {
      const file = path.join(LABS, locale, rel);
      if (!rev || !fs.existsSync(file)) {
        continue;
      }
      const text = fs.readFileSync(file, "utf8");
      const was = (text.match(/^source_rev:\s*"?([0-9a-f]+)"?\s*$/m) || [])[1];
      if (!was || was !== englishBefore.get(rel)) {
        continue;
      }
      const next = text.replace(/^source_rev:.*$/m, `source_rev: "${rev}"`);
      if (next !== text) {
        fs.writeFileSync(file, next, "utf8");
        stamped++;
      }
    }
  }
  console.log(`${changed.length} page(s) written:`);
  changed.forEach((file) => console.log(`  ${file}`));
  if (stamped > 0) {
    console.log(`${stamped} translation(s) stamped with their rewritten English page.`);
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

/** The content hash git gives a file as it is on disk, the one source_rev holds, or null. */
function hashObject(file) {
  const res = spawnSync("git", ["hash-object", "--", file], { cwd: ROOT, encoding: "utf8" });
  return res.status === 0 && res.stdout.trim() ? res.stdout.trim() : null;
}
