#!/usr/bin/env node
/**
 * Puts a "Learn by doing" block into the documentation of the product, so a
 * reader of a command page, of a guide or of a README finds the lab that walks
 * through the same thing on a free org.
 *
 * Where it writes, all of them sibling clones:
 *
 *   ../sfdx-hardis/src/commands/hardis/**\/*.ts   the command descriptions
 *   ../sfdx-hardis/docs/*.md                      the hand written guides
 *   ../sfdx-hardis/README.md                      the course, once, and a teaser near the top
 *   ../vscode-sfdx-hardis/README.md               the course, once
 *   ../sfdx-hardis/docs/salesforce-devops-training.md   the course page of the documentation site, whole
 *   ../sfdx-hardis/docs/salesforce-devops-*-home.md      a callout at the top of each guide
 *
 * The teaser and the callouts go between markers placed by hand, and a page
 * without them is reported as missing rather than appended to.
 *
 * What it writes comes from training-manifest.json, which universe.mjs
 * generates from the `depends_on` front matter of the labs. So a lab that
 * starts using a command, or stops, moves its link here on the next run.
 *
 * The block sits between two HTML comments and is rewritten in place, so
 * running this twice changes nothing. Run it after universe.mjs, and commit
 * the three repositories together.
 *
 *   node scripts/build/doc-links.mjs [--check]
 *
 * --check writes nothing and exits non-zero when a file is out of date, which
 * is what CI needs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const CLI = path.resolve(ROOT, "..", "sfdx-hardis");
const EXTENSION = path.resolve(ROOT, "..", "vscode-sfdx-hardis");

const START = "<!-- training-links:start -->";
const END = "<!-- training-links:end -->";
const CHECK = process.argv.includes("--check");

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "training-manifest.json"), "utf8"));
const labsById = new Map(manifest.labs.map((lab) => [lab.id, lab]));
const site = manifest.site.replace(/\/$/, "");

/** "Lab 2.3 - Fix broken records with an Apex deployment action" */
function labLabel(id) {
  const lab = labsById.get(id);
  return `Lab ${lab.level}.${lab.lab} - ${lab.title}`;
}

function labLink(id) {
  return `[${labLabel(id)}](${labsById.get(id).url})`;
}

/** The block, with the labs sorted the way a learner meets them. */
function block(ids, lead) {
  const sorted = [...new Set(ids)].sort((a, b) => {
    const left = labsById.get(a);
    const right = labsById.get(b);
    return left.level - right.level || left.lab - right.lab;
  });
  const lines = [START, "", "## Learn by doing", "", lead, ""];
  for (const id of sorted) {
    lines.push(`- ${labLink(id)}`);
  }
  lines.push("", END);
  return lines.join("\n");
}

/**
 * Replaces the block of a file, or appends it. Returns true when the file
 * changed, which is all --check needs to know.
 */
function write(file, text) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const original = fs.readFileSync(file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const body = text.split("\n").join(eol);
  let updated;
  if (original.includes(START) && original.includes(END)) {
    const before = original.slice(0, original.indexOf(START));
    const after = original.slice(original.indexOf(END) + END.length);
    updated = before + body + after;
  } else {
    updated = original.replace(/\s*$/, "") + eol + eol + body + eol;
  }
  if (updated === original) {
    return false;
  }
  if (!CHECK) {
    fs.writeFileSync(file, updated, "utf8");
  }
  return true;
}

/**
 * A file this script owns entirely, like the course page of the documentation
 * site: written whole, created when it does not exist yet. Null when the folder
 * it goes in does not exist, which means the sibling clone is missing.
 */
function writeWhole(file, text) {
  if (!fs.existsSync(path.dirname(file))) {
    return null;
  }
  const original = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const eol = original && original.includes("\r\n") ? "\r\n" : "\n";
  const body = text.split("\n").join(eol);
  if (body === original) {
    return false;
  }
  if (!CHECK) {
    fs.writeFileSync(file, body, "utf8");
  }
  return true;
}

/**
 * Replaces what sits between two markers, and only that. Unlike write(), a file
 * without the markers is reported rather than appended to: where a teaser or a
 * callout goes on a page is chosen by hand, and the end of the page is the one
 * place it must not land.
 */
function writeBetween(file, [start, end], text) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const original = fs.readFileSync(file, "utf8");
  if (!original.includes(start) || !original.includes(end)) {
    return null;
  }
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const body = text.split("\n").join(eol);
  const updated = original.slice(0, original.indexOf(start)) + body + original.slice(original.indexOf(end) + end.length);
  if (updated === original) {
    return false;
  }
  if (!CHECK) {
    fs.writeFileSync(file, updated, "utf8");
  }
  return true;
}

/**
 * The same, inside the `public static description` of a command: the block goes
 * at the end of the template literal, so it lands at the end of the generated
 * command page and in the extension's command help.
 */
function writeInDescription(file, text) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const original = fs.readFileSync(file, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const body = text.split("\n").join(eol);
  // Some commands type it: `public static description: string = \`...\``
  const match = original.match(/public static description(?::\s*string)? = `([\s\S]*?)`;/);
  if (!match) {
    return null;
  }
  const description = match[1];
  let newDescription;
  if (description.includes(START) && description.includes(END)) {
    const before = description.slice(0, description.indexOf(START));
    const after = description.slice(description.indexOf(END) + END.length);
    newDescription = before + body + after;
  } else {
    newDescription = description.replace(/\s*$/, "") + eol + eol + body + eol;
  }
  const updated = original.replace(match[0], match[0].slice(0, match[0].indexOf("`") + 1) + newDescription + "`;");
  if (updated === original) {
    return false;
  }
  if (!CHECK) {
    fs.writeFileSync(file, updated, "utf8");
  }
  return true;
}

const changed = [];
const missing = [];
const record = (file, result) => {
  if (result === null) {
    missing.push(path.relative(path.resolve(ROOT, ".."), file));
  } else if (result) {
    changed.push(path.relative(path.resolve(ROOT, ".."), file));
  }
};

// 1. Command descriptions
for (const [command, ids] of Object.entries(manifest.reverseIndex.commands)) {
  const file = path.join(CLI, "src", "commands", ...command.split(":")) + ".ts";
  const lead =
    ids.length === 1
      ? `The free [Salesforce DevOps with sfdx-hardis](${site}) course runs this command, click by click, on an org of your own:`
      : `The free [Salesforce DevOps with sfdx-hardis](${site}) course runs this command, click by click, on an org of your own, in these labs:`;
  record(file, writeInDescription(file, block(ids, lead)));
}

// 2. Hand written guides
for (const [page, ids] of Object.entries(manifest.reverseIndex.docs)) {
  const file = path.join(CLI, "docs", page + ".md");
  const lead =
    ids.length === 1
      ? `The free [Salesforce DevOps with sfdx-hardis](${site}) course does this, click by click, on an org of your own:`
      : `The free [Salesforce DevOps with sfdx-hardis](${site}) course does this, click by click, on an org of your own, in these labs:`;
  record(file, write(file, block(ids, lead)));
}

// 3. The two READMEs: the course itself, not a lab list
const levels = manifest.labs.reduce((acc, lab) => {
  acc[lab.level] = (acc[lab.level] || 0) + 1;
  return acc;
}, {});
const readmeBlock = [
  START,
  "",
  "## Learn by doing",
  "",
  `[Salesforce DevOps with sfdx-hardis](${site}) is a free hands-on course that builds a complete CI/CD pipeline on free orgs, one click at a time.`,
  "",
  `- [Level 1 - Contributor basics](${site}/en/level-1-contributor-basics/): ${levels[1]} labs, from your first User Story to a merged Pull Request`,
  `- [Level 2 - Contributor advanced](${site}/en/level-2-contributor-advanced/): ${levels[2]} labs, deployment errors, deployment actions, code quality, conflicts`,
  `- [Level 3 - Release Manager](${site}/en/level-3-release-manager/): ${levels[3]} labs, the pipeline up to production, releases, hotfixes, monitoring`,
  "",
  END,
].join("\n");
record(path.join(CLI, "README.md"), write(path.join(CLI, "README.md"), readmeBlock));
record(path.join(EXTENSION, "README.md"), write(path.join(EXTENSION, "README.md"), readmeBlock));

// 4. The course, showcased on the documentation site: a page of its own, a
// teaser near the top of the home page, a callout at the top of each guide
const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
const docSite = universe.course.docSite.replace(/\/$/, "");
const COURSE_PAGE = "salesforce-devops-training";
const coursePageUrl = `${docSite}/${COURSE_PAGE}/`;
const levelUrl = (level) => `${site}/en/${level.slug}/`;
const labsOf = (level) =>
  manifest.labs.filter((lab) => lab.level === level.level).sort((a, b) => a.lab - b.lab);
/** What each level is about, in one line: the same words as the README block. */
const LEVEL_PITCH = {
  1: "From your first User Story to a merged Pull Request.",
  2: "Deployment errors, deployment actions, code quality and merge conflicts.",
  3: "The pipeline up to production: releases, hotfixes, monitoring."
};

const coursePage = [
  "---",
  'title: "Free training: Salesforce DevOps with sfdx-hardis"',
  'description: "A free hands-on course that builds a complete Salesforce CI/CD pipeline on free orgs, one click at a time in VS Code, with a badge per level."',
  "---",
  "<!-- markdownlint-disable MD013 MD033 -->",
  `<!-- This page is generated by scripts/build/doc-links.mjs in the sfdx-hardis-training repository, from the course itself. Do not edit it here: the next run overwrites it. -->`,
  "",
  "## Salesforce DevOps with sfdx-hardis: the free course",
  "",
  `[${universe.course.name}](${site}) builds a complete Salesforce CI/CD pipeline on free orgs, click by click in VS Code, with the same sfdx-hardis tools this documentation describes.`,
  "Every lab has screenshots of the real screens, and every level ends with a badge you can share.",
  "It is free and open source, like sfdx-hardis.",
  "",
  `[![${universe.course.name}](${site}/_assets/social/course.png)](${site})`,
  "",
  "### What you need",
  "",
  "- A computer you are allowed to install software on. Not allowed to? The course also runs in [Agentforce Vibes](https://www.salesforce.com/agentforce/developers/vibe-coding/ide/), which is VS Code in a browser tab, and in [Cursor](https://cursor.com/).",
  "- A free [GitHub](https://github.com/) account.",
  "- One free [Salesforce Developer Edition org](https://developer.salesforce.com/signup) to start with, and one more at Level 3.",
  "- Nothing else: no paid service, no license, no credit card.",
  "",
  "### The three levels",
  "",
  ...universe.levels.flatMap((level) => {
    const labs = labsOf(level);
    const after = level.prerequisite ? `, after Level ${level.prerequisite}` : "";
    return [
      `#### [Level ${level.level} - ${level.name}](${levelUrl(level)})`,
      "",
      `${LEVEL_PITCH[level.level] || ""} ${labs.length} labs, ${level.duration}${after}.`.trim(),
      "",
      ...labs.map((lab) => `- [Lab ${lab.level}.${lab.lab} - ${lab.title}](${lab.url})`),
      ""
    ];
  }),
  "### Badges",
  "",
  universe.levels
    .map((level) => `![${level.badge}](${site}/_assets/badges/example-level-${level.level}.svg){ width="160" }`)
    .join(" "),
  "",
  "Each level ends with a Cloudity badge, on a page you can share on LinkedIn. To award it, a job clones your public repository and runs every check of the level against it again: the work is checked, not the answers to a quiz.",
  "It is a badge, not a certification.",
  "",
  `See [who earned one](${site}/badges/).`,
  "",
  ...(universe.levels.some((level) => level.trailmix)
    ? [
        "### On Trailhead",
        "",
        "Follow the course from Trailhead, one Trailmix per level:",
        "",
        ...universe.levels
          .filter((level) => level.trailmix)
          .map((level) => `- [Level ${level.level} - ${level.name}](${level.trailmix})`),
        ""
      ]
    : []),
  "### Languages",
  "",
  `The course is available in [English](${site}/en/) and [French](${site}/fr/).`,
  "",
  `[Start Level 1](${levelUrl(universe.levels[0])}){ .md-button .md-button--primary }`,
  ""
].join("\n");
record(path.join(CLI, "docs", `${COURSE_PAGE}.md`), writeWhole(path.join(CLI, "docs", `${COURSE_PAGE}.md`), coursePage));

const TEASER = ["<!-- training-teaser:start -->", "<!-- training-teaser:end -->"];
const teaser = [
  TEASER[0],
  "",
  `- [**Learn Salesforce DevOps hands-on** with a free course and shareable badges](${coursePageUrl})`,
  "",
  `![${universe.course.name}, the free course](${site}/_assets/social/course.png)`,
  "",
  TEASER[1]
].join("\n");
record(path.join(CLI, "README.md"), writeBetween(path.join(CLI, "README.md"), TEASER, teaser));

// Which level walks through which guide
const CALLOUTS = {
  "salesforce-devops-use-home": 1,
  "salesforce-devops-release-home": 3,
  "salesforce-devops-setup-home": 3
};
const CALLOUT = ["<!-- training-callout:start -->", "<!-- training-callout:end -->"];
for (const [page, number] of Object.entries(CALLOUTS)) {
  const level = universe.levels.find((one) => one.level === number);
  const callout = [
    CALLOUT[0],
    "",
    '!!! tip "Learn by doing"',
    `    Level ${level.level} - ${level.name} of the free [${universe.course.name}](${COURSE_PAGE}.md) course walks through this guide on a free org of your own: ${labsOf(level).length} labs, ${level.duration}. [Start Level ${level.level}](${levelUrl(level)})`,
    "",
    CALLOUT[1]
  ].join("\n");
  const file = path.join(CLI, "docs", `${page}.md`);
  record(file, writeBetween(file, CALLOUT, callout));
}

if (missing.length > 0) {
  console.log(`${missing.length} file(s) named by the manifest do not exist:`);
  missing.forEach((file) => console.log(`  ${file}`));
}
if (CHECK) {
  if (changed.length > 0) {
    console.error(`${changed.length} file(s) are out of date. Run: node scripts/build/doc-links.mjs`);
    changed.forEach((file) => console.error(`  ${file}`));
    process.exit(1);
  }
  console.log("Every documentation page links the labs the manifest names.");
} else {
  console.log(`${changed.length} file(s) updated.`);
  changed.forEach((file) => console.log(`  ${file}`));
}

// No export, and no guard pretending there is one. What used to sit here was
// an empty if, below code that had already written into three repositories:
// importing this file rewrote the product documentation as a side effect.
// It is a script, it is run as one, and nothing imports it.
