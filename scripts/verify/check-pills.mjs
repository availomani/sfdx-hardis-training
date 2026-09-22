#!/usr/bin/env node
/**
 * Checks that the pills drawn on a screenshot and the pills a lab refers to are
 * the same pills.
 *
 *   node scripts/verify/check-pills.mjs
 *
 * The rule the course is written to: an image carries numbered pills, and the
 * step that shows it refers to those numbers in its text. The two drift apart
 * silently, because nothing fails when a lab says "(3)" over an image with two
 * pills, or when a pill nobody mentions is left on an image after a rewrite.
 *
 * For every image a lab references, this compares:
 *   - the pill numbers declared for it in labs/_assets/annotations.json
 *   - the **(n)** references in the block that leads up to the image, from the
 *     previous image or heading down to it
 *
 * It also fails on a lab that points at a raw screenshot rather than the
 * annotated copy, and on an annotated file nothing references.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");
const SPEC = path.join(LABS, "_assets", "annotations.json");

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

// "vscode/setup.png" or "vscode/welcome.png#first-open" -> the annotated file name
function annotatedName(key) {
  const [rel, variant] = key.split("#");
  if (!variant) {
    return rel;
  }
  const ext = path.extname(rel);
  return `${rel.slice(0, -ext.length)}--${variant}${ext}`;
}

const IMAGE_LINE = /!\[[^\]]*\]\([^)]+\.png\)/;

const spec = JSON.parse(fs.readFileSync(SPEC, "utf8")).images || {};
const pillsByFile = new Map();
for (const [key, entry] of Object.entries(spec)) {
  pillsByFile.set(
    annotatedName(key),
    (entry.pills || []).map((pill) => Number(pill.n)).sort((a, b) => a - b)
  );
}

const problems = [];
const referenced = new Set();
let checked = 0;

// Every locale, not only English: the pill numbers are the one part of a lab a
// translation must carry over untouched, and a translator dropping a **(3)** is
// exactly the kind of mistake nothing else catches.
const localeDirs = fs
  .readdirSync(LABS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
  .map((entry) => path.join(LABS, entry.name));

for (const file of localeDirs.flatMap((dir) => walk(dir))) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const lines = fs.readFileSync(file, "utf8").split("\n");

  // Cut the file into steps: a heading and everything under it, up to the next
  // heading. A step is what a reader has in front of them at one moment, and it
  // is the unit the pills and the text have to agree on. Some steps introduce a
  // screenshot then show it, others show it then walk through it; both read
  // well, so the check does not care which way round they are written.
  const bounds = [];
  lines.forEach((line, index) => {
    if (/^#{2,4} /.test(line)) {
      bounds.push(index);
    }
  });
  bounds.push(lines.length);

  for (let b = 0; b < bounds.length - 1; b++) {
    const from = bounds[b];
    const to = bounds[b + 1];
    const block = lines.slice(from, to);
    const heading = lines[from].replace(/^#+ /, "");

    const images = [];
    block.forEach((line, offset) => {
      const match = line.match(/!\[[^\]]*\]\(([^)]+\.png)\)/);
      if (match) {
        images.push({ target: match[1], line: from + offset + 1 });
      }
    });
    if (images.length === 0) {
      continue;
    }

    const before = problems.length;
    const declared = new Set();
    for (const image of images) {
      if (!/_assets\/annotated\//.test(image.target)) {
        problems.push(`${rel}:${image.line} points at a raw screenshot, not the annotated copy: ${image.target}`);
        continue;
      }
      const name = image.target.split("_assets/annotated/")[1];
      referenced.add(name);
      checked++;
      const pills = pillsByFile.get(name);
      if (!pills) {
        problems.push(`${rel}:${image.line} uses ${name}, which has no entry in annotations.json`);
        continue;
      }
      pills.forEach((n) => declared.add(n));
    }
    const cited = new Set(
      [...block.join("\n").matchAll(/\*\*\((\d+)\)\*\*/g)].map((m) => Number(m[1]))
    );
    // A step whose images carry no pills at all is fine, and several do: the
    // level menus are shown plain. What is not fine is such a step still
    // pointing at a number, which sends a reader hunting for a marker that was
    // never drawn. Skipping the step outright used to hide exactly that.
    if (declared.size === 0) {
      // Only when every image of the step was found and annotated. Otherwise the
      // real cause was already reported just above, and adding "no image carries
      // a pill" on top of it reads as a second, contradictory diagnosis.
      if (cited.size > 0 && problems.length === before) {
        problems.push(
          `${rel}:${images[0].line} "${heading}" cites (${[...cited].sort((a, b) => a - b).join("), (")}) but no image of this step carries a pill`
        );
      }
      continue;
    }
    const invented = [...cited].filter((n) => !declared.has(n)).sort((a, b) => a - b);
    const uncited = [...declared].filter((n) => !cited.has(n)).sort((a, b) => a - b);
    const shown = images.map((i) => i.target.split("/").pop()).join(", ");

    if (invented.length > 0) {
      problems.push(
        `${rel}:${images[0].line} "${heading}" cites (${invented.join("), (")}) which no pill in ${shown} carries`
      );
    }
    if (uncited.length > 0) {
      problems.push(
        `${rel}:${images[0].line} "${heading}" shows pill(s) ${uncited.join(", ")} in ${shown} that the step never mentions`
      );
    }
  }
}

const orphans = [...pillsByFile.keys()].filter((name) => !referenced.has(name));

console.log(`${checked} image reference(s) checked against ${pillsByFile.size} annotated image(s).`);

if (orphans.length > 0) {
  console.log(`\n${orphans.length} annotated image(s) no lab references:`);
  orphans.forEach((name) => console.log(`  ${name}`));
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  problems.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}

console.log("Every lab cites exactly the pills its screenshots carry.");
