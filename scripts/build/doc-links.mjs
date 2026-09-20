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
 *   ../sfdx-hardis/README.md                      the course, once
 *   ../vscode-sfdx-hardis/README.md               the course, once
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
