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
import { strings, universeText } from "../lib/strings.mjs";
import { backlogPage } from "../lib/pages.mjs";

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

// ------------------------------------------------------------- the locales
// English is the reference, and every other locale is a mirror of it: the same
// files under the same names, translated. Anything else is a translation that
// has drifted, and a drifted translation sends a learner to a page that is not
// the one the course teaches.
const LOCALES = fs
  .readdirSync(path.join(ROOT, "labs"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name) && entry.name !== "en")
  .map((entry) => entry.name)
  .sort();

const translations = new Map(LOCALES.map((locale) => [locale, []]));
const localeTitles = {};
for (const locale of LOCALES) {
  for (const lab of labs) {
    const rel = lab.rel.replace("labs/en/", `labs/${locale}/`);
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      problems.push(`Translation missing: ${rel} (labs/en/ is the reference, every locale mirrors it)`);
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const front = parseFrontMatter(text);
    if (!front) {
      problems.push(`${rel} has no front matter`);
      continue;
    }
    if (front.lang !== locale) {
      problems.push(`${rel} declares lang: ${front.lang || "(none)"}, expected ${locale}`);
    }
    if (front.id !== lab.front.id) {
      problems.push(`${rel} declares id: ${front.id || "(none)"}, expected ${lab.front.id} like its English source`);
    }
    if (!front.source_rev) {
      problems.push(`${rel} has no source_rev: set it to the SHA of the English file it was translated from`);
    }
    translations.get(locale).push({ ...lab, rel, front, body: text, locale });
  }
  // The level and locale index pages, which carry no level or lab number. Their
  // titles are what the navigation of that locale is labelled with.
  for (const rel of ["labs/en/index.md", ...universe.levels.map((level) => `labs/en/${level.slug}/index.md`)]) {
    const target = rel.replace("labs/en/", `labs/${locale}/`);
    const abs = path.join(ROOT, target);
    if (!fs.existsSync(abs)) {
      problems.push(`Translation missing: ${target} (labs/en/ is the reference, every locale mirrors it)`);
      continue;
    }
    const front = parseFrontMatter(fs.readFileSync(abs, "utf8")) || {};
    if (front.lang !== locale) {
      problems.push(`${target} declares lang: ${front.lang || "(none)"}, expected ${locale}`);
    }
    const key = rel === "labs/en/index.md" ? "home" : path.basename(path.dirname(rel));
    (localeTitles[locale] = localeTitles[locale] || {})[key] = front.title || "";
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

// Org aliases, branch names, User Story ids and character names are never
// translated, so the fiction is checked in every locale, not only in English.
const everyLabFile = [...labs, ...LOCALES.flatMap((locale) => translations.get(locale))];

for (const lab of everyLabFile) {
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
for (const lab of everyLabFile) {
  const capitalised = lab.body.match(/\b(Victor|Mariia|Romain|Olga|Florian|Julie|Marco|Amina|Sofia|Elena|Diego|Nina)\b/g) || [];
  for (const name of capitalised) {
    if (!castFirstNames.includes(name)) {
      problems.push(`${lab.rel} uses the character "${name}", who is not in the cast`);
    }
  }
}

// -------------------------------------------------------------- BACKLOG.md
function backlog() {
  return backlogPage({
    universe,
    s: strings("en"),
    text: universeText("en", universe),
    // Each story has its own page on the site, BACKLOG/<id>/, which is where the
    // Pull Request comments link: see storyPages() in scripts/build/site.mjs
    storyLink: (story) => `${SITE}/BACKLOG/${story.id}/`,
    generatedBy: "scripts/build/universe.mjs"
  });
}
emit("BACKLOG.md", backlog());

// --------------------------------------------------------- link-map.<locale>
// One per locale, because a Trailmix cannot be localised: each language is its
// own Trailmix, built from its own URLs. The lab titles come from the front
// matter of that locale's files, so a translated title lands here by itself.
const LOCALE_NAMES = { en: "English", fr: "French" };

function linkMap(locale) {
  const titles = new Map(
    (locale === "en" ? labs : translations.get(locale) || []).map((lab) => [
      `${lab.level}.${lab.lab}`,
      lab.front.title || lab.title
    ])
  );
  const lines = [
    "<!-- Generated by scripts/build/universe.mjs. Do not edit by hand. -->",
    "",
    `# Link map (${LOCALE_NAMES[locale] || locale})`,
    "",
    "Every URL the Trailmixes and the labs point at. `link-check.yml` reads this file,",
    "so a renamed documentation page fails CI here rather than surprising a learner.",
    ""
  ];
  for (const level of universe.levels) {
    lines.push(`## Level ${level.level} - ${level.name}`, "");
    lines.push("| Lab | URL |", "|---|---|");
    lines.push(`| Level home | ${SITE}/${locale}/${level.slug}/ |`);
    for (const lab of level.labs) {
      const title = titles.get(`${level.level}.${lab.lab}`) || `Lab ${level.level}.${lab.lab} - ${lab.title}`;
      lines.push(`| ${title} | ${SITE}/${locale}/${level.slug}/${lab.slug}/ |`);
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
for (const locale of ["en", ...LOCALES]) {
  emit(`labs/link-map.${locale}.md`, linkMap(locale));
}

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
      screenshots: arr(lab.front.screenshots),
      // The same lab in every other locale. A change that hits a lab hits its
      // translations too: they are the same page in another language, not
      // another page. The impact is computed from English, and named here.
      translations: Object.fromEntries(
        LOCALES.map((locale) => [
          locale,
          {
            file: lab.rel.replace("labs/en/", `labs/${locale}/`),
            url: `${SITE}/${locale}/${lab.levelSlug}/${lab.slug}/`
          }
        ])
      )
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
      locales: ["en", ...LOCALES],
      labs: entries,
      reverseIndex: index
    },
    null,
    2
  ) + "\n";
}
emit("training-manifest.json", manifest());

// ------------------------------------------------------------ mkdocs nav
// The labels of the navigation itself, per locale. Level and lab titles come
// from the pages, so there is one source of truth for them; these few words
// have no page to take them from.
const NAV_LABELS = {
  en: { home: "Home", start: "Start here", help: "Help", backlog: "Backlog", badges: "Badges" },
  fr: { home: "Accueil", start: "Commencer ici", help: "Aide", backlog: "Backlog", badges: "Badges" }
};

// The product documentation, which is not part of this site and is written once,
// in English. It sits with the backlog and the badges at the end of every menu.
const DOC_SITE_ENTRY = `  - sfdx-hardis documentation: ${DOC}/`;

/**
 * The navigation, one flat course per locale.
 *
 * Every language sits at the top level, next to the others, rather than the
 * other languages hiding one click deep under their name. The reader never sees
 * both: site-overrides/partials/nav.html keeps the entries of the language of
 * the page being read, which it takes from the "lang" front matter every page
 * carries. Changing language is the translate widget in the header, which lands
 * on the same page in the other language.
 *
 * English comes first because it is the reference, and its home page is the
 * home page of the site. The backlog and the badges are generated in every
 * language, so each menu holds its own. The product documentation is the one
 * entry in no language: it is another site, written once, in English.
 *
 * Lab entries carry no title in course-site.yml: an entry without one takes the
 * page's own heading, so there is one source of truth. They carry one here,
 * because this file is also read by a human adding a locale.
 */
function nav() {
  const lines = ["nav:"];
  for (const locale of ["en", ...LOCALES]) {
    const labels = NAV_LABELS[locale] || NAV_LABELS.en;
    const titles = locale === "en" ? {} : localeTitles[locale] || {};
    const translated = locale === "en" ? labs : translations.get(locale) || [];
    // The English home page is the home page of the site, at the root
    lines.push(`  - ${labels.home}: ${locale === "en" ? "index.md" : `${locale}/index.md`}`);
    for (const level of universe.levels) {
      lines.push(`  - "${titles[level.slug] || `Level ${level.level} - ${level.name}`}":`);
      lines.push(`      - ${labels.start}: ${locale}/${level.slug}/index.md`);
      for (const lab of level.labs) {
        const found = translated.find((one) => one.level === level.level && one.lab === lab.lab);
        const title = (found && found.front.title) || `Lab ${level.level}.${lab.lab} - ${lab.title}`;
        lines.push(`      - "${title}": ${locale}/${level.slug}/${lab.slug}.md`);
      }
    }
    lines.push(`  - ${labels.help}: ${locale}/help.md`);
    // The backlog and the badges are generated pages, one per language, and the
    // site language keeps the paths the outside world already holds
    const prefix = locale === "en" ? "" : `${locale}/`;
    lines.push(`  - ${labels.backlog}: ${prefix}BACKLOG.md`);
    lines.push(`  - ${labels.badges}: ${prefix}badges/index.md`);
  }
  lines.push(DOC_SITE_ENTRY);
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
