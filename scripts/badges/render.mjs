#!/usr/bin/env node
/**
 * Writes a learner's badge: the SVG, the machine readable record and the page.
 *
 *   node scripts/badges/render.mjs --audit /tmp/audit.json --issue 42 \
 *     --trailblazer nvuillamy --trailblazer-name "Nicolas Vuillamy" --name "Nicolas Vuillamy"
 *
 * `--trailblazer-name` is the name on the Trailblazer profile and `--name` the
 * GitHub display name. The badge prefers the first and falls back to the second,
 * then to the handle.
 *
 * A badge exists the moment these three files are committed. The site only
 * renders them, so a broken Pages build never blocks an award.
 *
 * ## Everything is keyed by the Trailblazer username
 *
 * `badges/<trailblazer>.json`, `badges/<trailblazer>.md` and
 * `badges/img/<trailblazer>-level-N.svg`, so that anything holding a Trailblazer
 * username can ask the site what that person earned, with one GET and no index
 * to walk:
 *
 *     https://hardisgroupcom.github.io/sfdx-hardis-training/badges/nvuillamy.json
 *
 * The Trailhead Banner project works from a Trailblazer username, and a badge
 * filed under a GitHub login would be invisible to it. The GitHub handle stays
 * inside the record as `recipient`, because that is the thing the audit actually
 * proved.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "../lib/util.mjs";
import { LEVELS, renderSvg } from "./badge-svg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BADGES = path.join(ROOT, "badges");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
const SITE = universe.course.site;
const UPSTREAM = universe.course.upstreamRepo;


const args = parseArgs(process.argv.slice(2));
if (!args.audit) {
  console.error("Usage: node scripts/badges/render.mjs --audit <audit.json> [--issue N] [--trailblazer name]");
  process.exit(2);
}

const audit = JSON.parse(fs.readFileSync(args.audit, "utf8"));
if (!audit.ok) {
  console.error("The audit did not pass: no badge is rendered.");
  process.exit(1);
}

const handle = audit.handle;
const level = audit.level;
const today = new Date().toISOString().slice(0, 10);
const definition = LEVELS[level];
const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

// The Trailblazer username is the key of everything this writes, so it is
// required, and it is checked again here rather than trusted. parse-claim.mjs
// already accepts only this shape, but this value becomes a file path: "." or
// ".." or a separator slipping through would write outside badges/.
const key = text(args.trailblazer);
if (!key || !/^[A-Za-z0-9._-]{1,60}$/.test(key) || key === "." || key === "..") {
  console.error(
    `--trailblazer is required and must be a plain Trailblazer username, got ${JSON.stringify(args.trailblazer)}`
  );
  process.exit(2);
}

// ------------------------------------------------------------------- SVG
// Whose name this is, in the order of who is most likely to have spelled it the
// way the person wants it read: their Trailblazer profile first, since this is a
// Salesforce badge and that profile is the one it links to; then their GitHub
// display name; then their handle, for somebody who set neither.
const trailblazerName = text(args["trailblazer-name"]);
const githubName = text(args.name);
const fullName = trailblazerName || githubName || handle;

function svg() {
  return renderSvg({ level, handle, fullName, trailblazer: key, date: today });
}

// ------------------------------------------------------------- the old key
/**
 * The same person's badge filed under another name, which has to move here.
 *
 * Two ways it happens: a badge awarded before badges were keyed by Trailblazer
 * username, and somebody claiming a second level after changing that username.
 * Both are the same situation, one record under the wrong name, and leaving it
 * behind would publish two pages for one person and let the older one rot.
 */
function findRecordUnderAnotherKey() {
  if (!fs.existsSync(BADGES)) {
    return null;
  }
  for (const file of fs.readdirSync(BADGES)) {
    if (!file.endsWith(".json") || file.startsWith("_") || file === `${key}.json`) {
      continue;
    }
    try {
      const candidate = JSON.parse(fs.readFileSync(path.join(BADGES, file), "utf8"));
      if (candidate && candidate.recipient === handle) {
        return { oldKey: file.replace(/\.json$/, ""), record: candidate };
      }
    } catch {
      // A record that cannot be read is not this person's problem
    }
  }
  return null;
}

fs.mkdirSync(path.join(BADGES, "img"), { recursive: true });

// ------------------------------------------------------- machine readable
const recordPath = path.join(BADGES, `${key}.json`);
let record = { recipient: handle, badges: [] };
let movedFrom = null;
if (fs.existsSync(recordPath)) {
  record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
} else {
  const previous = findRecordUnderAnotherKey();
  if (previous) {
    record = previous.record;
    movedFrom = previous.oldKey;
    // The badges of the levels this run is not re-rendering keep their images,
    // so those files move too and their URLs move with them
    for (const badge of record.badges || []) {
      const from = path.join(BADGES, "img", `${movedFrom}-level-${badge.level}.svg`);
      const to = path.join(BADGES, "img", `${key}-level-${badge.level}.svg`);
      if (fs.existsSync(from)) {
        fs.renameSync(from, to);
      }
      badge.image = `${SITE}/badges/img/${key}-level-${badge.level}.svg`;
    }
    for (const stale of [`${movedFrom}.json`, `${movedFrom}.md`]) {
      const file = path.join(BADGES, stale);
      if (fs.existsSync(file)) {
        fs.rmSync(file);
      }
    }
  }
}

fs.writeFileSync(path.join(BADGES, "img", `${key}-level-${level}.svg`), svg(), "utf8");

record.recipient = handle;
record.trailblazer = key;
// Kept in the record so the index can list people by name without asking the
// Trailblazer API again on every site build, and so a badge still reads right
// when that API is unreachable or the profile later goes private.
record.name = fullName;
record.trailblazerName = trailblazerName || record.trailblazerName || null;
record.badges = (record.badges || []).filter((badge) => badge.level !== level);
record.badges.push({
  // An Open Badges shaped structure, unsigned in v1. Real certifications, if
  // Cloudity ever issues them, are a different scheme: this shape does not block
  // it and these URLs do not have to move.
  type: "Achievement",
  level,
  name: definition.name,
  description: definition.blurb,
  issuer: {
    name: "Cloudity",
    url: "https://cloudity.com",
    course: SITE
  },
  issuedOn: today,
  evidence: [
    { type: "Repository", url: audit.repo || null },
    { type: "ClaimIssue", url: args.issue ? `https://github.com/${UPSTREAM}/issues/${args.issue}` : null }
  ].filter((item) => item.url),
  image: `${SITE}/badges/img/${key}-level-${level}.svg`,
  checksPassed: audit.passed,
  checksTotal: audit.total
});
record.badges.sort((a, b) => a.level - b.level);
fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", "utf8");

// ------------------------------------------------------------- badge page
const rows = record.badges
  .map((badge) => `| ![${badge.name}](img/${key}-level-${badge.level}.svg) | **${badge.name}** | ${badge.issuedOn} | ${badge.checksPassed}/${badge.checksTotal} checks |`)
  .join("\n");

const page = `---
title: ${record.name}
---

# Badges earned by ${record.name}

GitHub: [@${handle}](https://github.com/${handle})
${record.trailblazer ? `<br/>Trailblazer: [${record.trailblazer}](https://www.salesforce.com/trailblazer/${record.trailblazer})\n` : ""}
| | Badge | Awarded | Verified |
|---|---|---|---|
${rows}

## What these mean

Each badge was awarded by a job that cloned ${record.badges[0] && record.badges[0].evidence[0] ? `[the repository](${record.badges[0].evidence[0].url})` : "the learner's public repository"}
and re-ran every check of the level against its actual content and history. A level 2 badge also
re-ran the level 1 checks, and a level 3 badge re-ran all three.

What is verified is the work in the repository: the fields, the deployment actions, the resolved
conflicts, the pipeline configuration. What is **not** verified is the state of anybody's Salesforce
orgs. Nobody is asked for org credentials, and this is not an exam.

## It is a badge, not a certification

There is no exam and no accreditation here. Share this page under *Featured* on LinkedIn, or as a
course. Not under *Licenses & certifications*.

[Take the course](${SITE}/){ .md-button }
`;

fs.writeFileSync(path.join(BADGES, `${key}.md`), page, "utf8");

console.log(`Badge written for ${handle} as ${key}, level ${level}:`);
console.log(`  badges/${key}.md`);
console.log(`  badges/${key}.json`);
console.log(`  badges/img/${key}-level-${level}.svg`);
if (movedFrom) {
  console.log(`  (moved from ${movedFrom}, which was removed)`);
}
