#!/usr/bin/env node
/**
 * Writes a learner's badge: the SVG, the machine readable record and the page.
 *
 *   node scripts/badges/render.mjs --audit /tmp/audit.json --issue 42 --trailblazer nvuillamy
 *
 * A badge exists the moment these three files are committed. The site only
 * renders them, so a broken Pages build never blocks an award.
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

// ------------------------------------------------------------------- SVG
// The GitHub display name, set by the claim workflow from the GitHub API. A
// handle without a display name shows the handle twice, which is fine.
const fullName = (typeof args.name === "string" && args.name.trim()) || handle;

function svg() {
  return renderSvg({ level, handle, fullName, trailblazer: args.trailblazer || null, date: today });
}

fs.mkdirSync(path.join(BADGES, "img"), { recursive: true });
fs.writeFileSync(path.join(BADGES, "img", `${handle}-level-${level}.svg`), svg(), "utf8");

// ------------------------------------------------------- machine readable
const recordPath = path.join(BADGES, `${handle}.json`);
const record = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath, "utf8")) : { recipient: handle, badges: [] };

record.recipient = handle;
record.trailblazer = args.trailblazer || record.trailblazer || null;
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
  image: `${SITE}/badges/img/${handle}-level-${level}.svg`,
  checksPassed: audit.passed,
  checksTotal: audit.total
});
record.badges.sort((a, b) => a.level - b.level);
fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", "utf8");

// ------------------------------------------------------------- badge page
const rows = record.badges
  .map((badge) => `| ![${badge.name}](img/${handle}-level-${badge.level}.svg) | **${badge.name}** | ${badge.issuedOn} | ${badge.checksPassed}/${badge.checksTotal} checks |`)
  .join("\n");

const page = `---
title: ${handle}
---

# Badges earned by ${handle}

${record.trailblazer ? `Trailblazer profile: [${record.trailblazer}](https://www.salesforce.com/trailblazer/${record.trailblazer})\n` : ""}
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

fs.writeFileSync(path.join(BADGES, `${handle}.md`), page, "utf8");

console.log(`Badge written for ${handle}, level ${level}:`);
console.log(`  badges/${handle}.md`);
console.log(`  badges/${handle}.json`);
console.log(`  badges/img/${handle}-level-${level}.svg`);
