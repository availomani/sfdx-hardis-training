#!/usr/bin/env node
/**
 * Generates everything that can be derived, so it cannot drift:
 *
 *   BACKLOG.md                the Helios backlog, from training-universe.json
 *   course-site.yml nav            from the lab files actually present
 *   labs/link-map.en.md       every URL the three Trailmixes point at
 *   training-manifest.json    what each lab depends on, read by the sfdx-hardis skills
 *
 * It also fails when a lab mentions a User Story, branch or character the
 * universe does not define, which is what stops the labs and the screenshots
 * from telling two different stories.
 *
 *   node scripts/build/universe.mjs
 *   node scripts/build/universe.mjs --check      (CI mode: writes nothing, fails on drift)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const CHECK = process.argv.includes("--check");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
const DOC = universe.course.docSite;
const SITE = universe.course.site;

const problems = [];
const written = [];

function emit(relPath, content) {
  const target = path.join(ROOT, relPath);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (existing === content) {
    return;
  }
  if (CHECK) {
    problems.push(`${relPath} is out of date. Run: node scripts/build/universe.mjs`);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  written.push(relPath);
}

// ------------------------------------------------------------- read the labs
function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    return null;
  }
  const data = {};
  let currentKey = null;
  let currentSub = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) {
      continue;
    }
    const top = rawLine.match(/^([a-z_]+):\s*(.*)$/);
    if (top) {
      currentKey = top[1];
      currentSub = null;
      const value = top[2].trim();
      data[currentKey] = value === "" ? [] : stripQuotes(value);
      continue;
    }
    const sub = rawLine.match(/^ {2}([a-z_]+):\s*(.*)$/);
    if (sub && Array.isArray(data[currentKey])) {
      data[currentKey] = {};
    }
    if (sub) {
      currentSub = sub[1];
      const value = sub[2].trim();
      if (typeof data[currentKey] !== "object" || Array.isArray(data[currentKey])) {
        data[currentKey] = {};
      }
      data[currentKey][currentSub] = value ? parseInline(value) : [];
      continue;
    }
    const item = rawLine.match(/^ {2}- (.*)$/);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) {
        data[currentKey] = [];
      }
      data[currentKey].push(stripQuotes(item[1].trim()));
    }
  }
  return data;
}
function stripQuotes(v) {
  return v.replace(/^["'](.*)["']$/, "$1");
}
function parseInline(v) {
  if (v.startsWith("[")) {
    return v.slice(1, -1).split(",").map((s) => stripQuotes(s.trim())).filter(Boolean);
  }
  return stripQuotes(v);
}

const labs = [];
for (const level of universe.levels) {
  for (const lab of level.labs) {
    const rel = `labs/en/${level.slug}/${lab.slug}.md`;
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      problems.push(`Lab file missing: ${rel}`);
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const front = parseFrontMatter(text);
    if (!front) {
      problems.push(`${rel} has no front matter`);
      continue;
    }
    labs.push({ level: level.level, levelSlug: level.slug, ...lab, rel, front, body: text });
  }
}

// ------------------------------------------------- the fiction cannot drift
const knownStoryIds = new Set(universe.userStories.map((s) => s.id));
const knownBranches = new Set([
  ...universe.branches.majors,
  ...universe.branches.training.map((b) => b.name),
  ...universe.userStories.map((s) => s.branch)
]);
const knownOrgs = new Set(universe.orgs.map((o) => o.alias));
const knownNames = new Set(universe.cast.map((p) => p.name.split(" ")[0]));

for (const lab of labs) {
  for (const match of lab.body.matchAll(/\bUS-\d{3}\b/g)) {
    if (!knownStoryIds.has(match[0])) {
      problems.push(`${lab.rel} mentions ${match[0]}, which training-universe.json does not define`);
    }
  }
  for (const match of lab.body.matchAll(/\bhelios-[a-z]+\b/g)) {
    if (!knownOrgs.has(match[0])) {
      problems.push(`${lab.rel} mentions the org ${match[0]}, which training-universe.json does not define`);
    }
  }
  // Not preceded by a word character, a slash or a hyphen, so that a repository
  // URL such as ".../sfdx-hardis-training/issues/new" is not read as a branch.
  for (const match of lab.body.matchAll(/(?<![\w/-])training\/[a-z0-9-]+/g)) {
    if (!knownBranches.has(match[0])) {
      problems.push(`${lab.rel} mentions the branch ${match[0]}, which training-universe.json does not define`);
    }
  }
  const screenshots = Array.isArray(lab.front.screenshots) ? lab.front.screenshots : [];
  for (const shot of screenshots) {
    const png = path.join(ROOT, "labs", "_assets", `${shot}.png`);
    if (!fs.existsSync(png)) {
      problems.push(`${lab.rel} declares the screenshot "${shot}" but labs/_assets/${shot}.png does not exist`);
    }
  }
}

const castFirstNames = [...knownNames];
for (const lab of labs) {
  const capitalised = lab.body.match(/\b(Victor|Mariia|Romain|Olga|Florian|Julie|Marco|Amina|Sofia|Elena|Diego|Nina)\b/g) || [];
  for (const name of capitalised) {
    if (!castFirstNames.includes(name)) {
      problems.push(`${lab.rel} uses the character "${name}", who is not in the cast`);
    }
  }
}

// -------------------------------------------------------------- BACKLOG.md
function backlog() {
  const lines = [
    "<!-- Generated by scripts/build/universe.mjs. Do not edit by hand. -->",
    "",
    "# Helios Energy backlog",
    "",
    universe.company.pitch,
    "",
    "The delivery team works in three-week iterations. Every story below is real work",
    "for the `Helios Delivery` app, and every one of them is a lab in this course.",
    "",
    "| Story | Level | Title | Owner | Branch |",
    "|---|---|---|---|---|"
  ];
  for (const story of universe.userStories) {
    const owner = universe.cast.find((p) => p.handle === story.author);
    // Each story has its own page on the site, BACKLOG/<id>/, which is where the
    // Pull Request comments link: see storyPages() in scripts/build/site.mjs
    const link = `[${story.id}](${universe.course.site}/BACKLOG/${story.id}/)`;
    lines.push(`| ${link} | ${story.level} | ${story.title} | ${owner ? owner.name : story.author} | \`${story.branch}\` |`);
  }
  lines.push("", "## The stories in full", "");
  for (const story of universe.userStories) {
    const owner = universe.cast.find((p) => p.handle === story.author);
    // Kept for the links written before each story had its own page
    lines.push(`<a id="${story.id}"></a>`, "", `### ${story.id} - ${story.title}`, "");
    lines.push(`**Owner**: ${owner ? owner.name : story.author}  `);
    lines.push(`**Branch**: \`${story.branch}\`  `);
    lines.push(`**Lab**: ${story.level}.${story.lab}`, "");
    lines.push(`> ${story.story}`, "");
    lines.push("Acceptance criteria:", "");
    for (const criterion of story.acceptance) {
      lines.push(`- ${criterion}`);
    }
    lines.push("");
  }
  lines.push("## The team", "");
  lines.push("| Who | Role |", "|---|---|");
  for (const person of universe.cast) {
    lines.push(`| ${person.name} | ${person.role} |`);
  }
  lines.push("");
  return lines.join("\n");
}
emit("BACKLOG.md", backlog());

// ------------------------------------------------------------- link-map.en
function linkMap() {
  const lines = [
    "<!-- Generated by scripts/build/universe.mjs. Do not edit by hand. -->",
    "",
    "# Link map (English)",
    "",
    "Every URL the three Trailmixes and the labs point at. `link-check.yml` reads this file,",
    "so a renamed documentation page fails CI here rather than surprising a learner.",
    ""
  ];
  for (const level of universe.levels) {
    lines.push(`## Level ${level.level} - ${level.name}`, "");
    lines.push("| Lab | URL |", "|---|---|");
    lines.push(`| Level home | ${SITE}/en/${level.slug}/ |`);
    for (const lab of level.labs) {
      lines.push(`| Lab ${level.level}.${lab.lab} - ${lab.title} | ${SITE}/en/${level.slug}/${lab.slug}/ |`);
    }
    lines.push("");
  }
  const docLinks = new Set();
  for (const lab of labs) {
    const docs = lab.front.depends_on && lab.front.depends_on.docs ? lab.front.depends_on.docs : [];
    for (const page of Array.isArray(docs) ? docs : [docs]) {
      if (page) {
        docLinks.add(page);
      }
    }
  }
  lines.push("## sfdx-hardis documentation pages used by the labs", "");
  lines.push("| Page | URL |", "|---|---|");
  for (const page of [...docLinks].sort()) {
    lines.push(`| ${page} | ${DOC}/${page}/ |`);
  }
  lines.push("");
  return lines.join("\n");
}
emit("labs/link-map.en.md", linkMap());

// ------------------------------------------------------ training-manifest
function manifest() {
  const entries = labs.map((lab) => {
    const dep = lab.front.depends_on || {};
    const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    return {
      id: lab.front.id || `l${lab.level}-${lab.slug}`,
      level: lab.level,
      lab: lab.lab,
      title: lab.title,
      file: lab.rel,
      url: `${SITE}/en/${lab.levelSlug}/${lab.slug}/`,
      commands: arr(dep.commands),
      flags: arr(dep.flags),
      config: arr(dep.config),
      docs: arr(dep.docs),
      panels: arr(dep.panels),
      screenshots: arr(lab.front.screenshots)
    };
  });
  const index = {};
  for (const entry of entries) {
    for (const key of ["commands", "config", "docs", "panels"]) {
      for (const value of entry[key]) {
        const bucket = (index[key] = index[key] || {});
        (bucket[value] = bucket[value] || []).push(entry.id);
      }
    }
  }
  return JSON.stringify(
    {
      $comment: "Generated by scripts/build/universe.mjs. Read by the training-impact skill in sfdx-hardis.",
      generatedFrom: "labs/en/**/*.md front matter",
      site: SITE,
      labs: entries,
      reverseIndex: index
    },
    null,
    2
  ) + "\n";
}
emit("training-manifest.json", manifest());

// ------------------------------------------------------------ mkdocs nav
function nav() {
  const lines = ["nav:", "  - Home: index.md"];
  for (const level of universe.levels) {
    lines.push(`  - Level ${level.level} - ${level.name}:`);
    lines.push(`      - Start here: en/${level.slug}/index.md`);
    for (const lab of level.labs) {
      lines.push(`      - "Lab ${level.level}.${lab.lab} - ${lab.title}": en/${level.slug}/${lab.slug}.md`);
    }
  }
  lines.push("  - Backlog: BACKLOG.md");
  lines.push("  - Badges: badges/index.md");
  lines.push("  - Link map: labs/link-map.en.md");
  return lines.join("\n") + "\n";
}
emit("mkdocs-nav.yml", nav());

// --------------------------------------------------------------- report
if (written.length > 0) {
  console.log("Written:");
  written.forEach((f) => console.log(`  ${f}`));
}
if (problems.length > 0) {
  console.error("");
  console.error(`${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log(`${labs.length} lab file(s) checked, everything consistent.`);
