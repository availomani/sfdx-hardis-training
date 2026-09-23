#!/usr/bin/env node
/**
 * Assembles the site sources under site-src/, which is what Zensical builds.
 *
 * The source of truth stays plain markdown in labs/<locale>/. This only copies
 * it into the layout the site wants, so a locale is a folder and adding one is
 * additive:
 *
 *   labs/en/index.md               -> site-src/index.md
 *   labs/en/level-1-contributor-basics/1-1-*.md  -> site-src/en/level-1-contributor-basics/1-1-*.md
 *   labs/_assets/**                -> site-src/_assets/**
 *   site-theme/**                  -> site-src/theme/**
 *   BACKLOG.md, one per locale     -> site-src/BACKLOG.md and site-src/<locale>/BACKLOG.md
 *   training-universe.json stories -> site-src/[<locale>/]BACKLOG/US-nnn.md, and US-nnn.json once
 *   badges/<trailblazer>.json      -> site-src/[<locale>/]badges/<trailblazer>.md, built from the record
 *   badges/<trailblazer>.json      -> site-src/badges/<trailblazer>.json (read by other sites)
 *
 *   node scripts/build/site.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PILL_PALETTE } from "./annotate.mjs";
import { strings, universeText, fill } from "../lib/strings.mjs";
import { backlogPage, storyPage, badgesPage, badgePage } from "../lib/pages.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "site-src");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));

// The language the site leads with: its home page is the home page of the site,
// and its backlog, stories and badges keep the URLs the outside world holds.
const SITE_LANG = "en";

/**
 * The URL of a page inside the site, from the file that builds it.
 *
 *   en/level-1-contributor-basics/1-1-install.md -> en/level-1-contributor-basics/1-1-install/
 *   fr/index.md                                  -> fr/
 *   index.md                                     -> (the home page, "")
 */
function docUrl(relPath) {
  const clean = relPath.split(path.sep).join("/").replace(/\.md$/, "");
  return clean === "index" ? "" : `${clean.replace(/\/index$/, "")}/`;
}

/**
 * Where the same page lives in every other language, written into the front
 * matter of each page that has counterparts.
 *
 * The translate widget reads it, and so does the script that keeps that widget
 * right after an instant navigation. It is written here rather than worked out
 * in the template because the languages are not laid out alike: the English
 * labs sit under /en/, while the backlog and the badges, which are also the
 * ticket and badge URLs the outside world already holds, stay where they are.
 */
function alternatesFrontMatter(byLocale) {
  const lines = ["alternates:"];
  for (const [lang, url] of Object.entries(byLocale)) {
    lines.push(`  ${lang}: ${JSON.stringify(url)}`);
  }
  return lines.join("\n");
}

/**
 * The same page, with its alternates, and its language when it does not say it.
 *
 * The labs declare "lang" themselves, and it is the front matter a translator
 * writes. The generated pages do not, so it is added here: the menu of a page,
 * its banner and its place in the picker all read it.
 */
function withAlternates(content, byLocale, lang) {
  // Only the front matter counts. An unbounded match reaches into the body, and
  // a page whose text happens to hold a line starting with "lang:", a YAML
  // sample or a translated criterion, would be taken as declaring its language:
  // no lang is injected, the theme falls back to the site language, and a French
  // page lands in the English menu.
  const declares = /^---\r?\n(?:(?!---)[\s\S])*?^lang:/m.test(content);
  const block = [!declares && lang ? `lang: ${lang}` : null, alternatesFrontMatter(byLocale)]
    .filter(Boolean)
    .join("\n");
  if (/^---\r?\n/.test(content)) {
    return content.replace(/^---\r?\n/, `---\n${block}\n`);
  }
  return `---\n${block}\n---\n\n${content}`;
}

function copyTree(from, to, filter, transform) {
  if (!fs.existsSync(from)) {
    return 0;
  }
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      count += copyTree(source, target, filter, transform);
    } else if (!filter || filter(entry.name)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (transform && entry.name.endsWith(".md")) {
        fs.writeFileSync(target, transform(fs.readFileSync(source, "utf8"), source, target), "utf8");
      } else {
        fs.copyFileSync(source, target);
      }
      count++;
    }
  }
  return count;
}

/**
 * Rewrites the links that reach out of labs/.
 *
 * A lab linking to a file at the root of the repository needs one more "../"
 * there than it does here: labs/en/level-1-contributor-basics/1-3-*.md has labs/ above it and the
 * site page does not. The link resolves on GitHub and 404s on the site, and
 * check-links.mjs cannot see it because it resolves against the repository.
 * Links that stay inside labs/ keep their depth and are left alone.
 */
function rewriteEscapingLinks(content, source, target) {
  return content.replace(/\]\((\.\.\/[^)\s]+)\)/g, (whole, link) => {
    const [rel, fragment] = link.split("#");
    const resolved = path.resolve(path.dirname(source), rel);
    if (resolved.startsWith(path.join(ROOT, "labs") + path.sep)) {
      return whole;
    }
    const fromRoot = path.relative(ROOT, resolved);
    if (fromRoot.startsWith("..")) {
      return whole;
    }
    const fixed = path
      .relative(path.dirname(target), path.join(OUT, fromRoot))
      .split(path.sep)
      .join("/");
    return `](${fixed}${fragment ? "#" + fragment : ""})`;
  });
}

/**
 * Folds the "If it goes wrong" section of a lab into a collapsed block.
 *
 * It is the one section of a lab that is not meant to be read in order. It
 * lists the two or three ways the step before it fails, and a reader whose
 * step worked has to scroll past all of it to reach the next thing to do.
 * Collapsed, it stays one click away for the reader who needs it, and out of
 * the way of the one who does not.
 *
 * The markdown keeps an ordinary heading, so the labs stay readable on GitHub
 * and an author has nothing to indent by hand. The section runs from its
 * heading to the next heading of the same level, or to the end of the page.
 */
/**
 * Paints every **(2)** of a lab in the colour of the pill numbered 2 in the
 * screenshot it points at, so the eye jumps from the sentence to the right spot
 * of the picture instead of counting pills.
 *
 * Two shapes are painted: the reference standing on its own, `**(2)**`, and the
 * one sitting inside the name of a button, `**Save (3)**`. A number in ordinary
 * prose is left alone, because only a bold one is ever a pill reference.
 */
function colorPillReferences(content) {
  const paint = (n) =>
    `<span class="pill-ref pill-ref-${Number(n)}">(${Number(n)})</span>`;
  return content
    .replace(/\*\*\((\d{1,2})\)\*\*/g, (whole, n) => paint(n))
    // No `<` in the two groups, so this pass cannot reach across a pill the
    // pass above already painted and wrap its span a second time: the source
    // `**Add Org** **(1)**, then pick **...**` did exactly that.
    .replace(/\*\*([^*<\n]*?)\((\d{1,2})\)([^*<\n]*?)\*\*/g, (whole, before, n, after) => {
      // A bold run holding a number: keep the bold on the words, paint the number
      const left = before ? `**${before.replace(/\s+$/, "")}** ` : "";
      const right = after.trim() ? ` **${after.trim()}**` : "";
      return `${left}${paint(n)}${right}`;
    });
}

/**
 * The "If it goes wrong" heading, per locale.
 *
 * foldTroubleshooting() finds that section by its heading and nothing else, so a
 * locale that translates the heading declares the translation here. English is
 * the reference: a locale missing from this map fails the build rather than
 * quietly shipping its troubleshooting section unfolded.
 */
const TROUBLESHOOTING = {
  en: "If it goes wrong",
  fr: "En cas de problème"
};

function foldTroubleshooting(content, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = new RegExp(`^## ${escaped}\\r?\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m");
  return content.replace(section, (whole, body) => {
    const indented = body
      .replace(/\s+$/, "")
      .split(/\r?\n/)
      .map((line) => (line.trim() === "" ? "" : "    " + line))
      .join("\n");
    return `??? troubleshoot "${heading}"\n\n` + indented + "\n\n";
  });
}

function prepareLab(locale) {
  const heading = TROUBLESHOOTING[locale];
  if (!heading) {
    throw new Error(
      `labs/${locale}/ has no entry in TROUBLESHOOTING (scripts/build/site.mjs), so its ` +
      '"If it goes wrong" sections cannot be folded. Add the translated heading there.'
    );
  }
  return (content, source, target) =>
    colorPillReferences(foldTroubleshooting(rewriteEscapingLinks(content, source, target), heading));
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// The locale trees. index.md of a locale becomes the home page for "en", and
// stays at /<locale>/ for the others.
const localesDir = path.join(ROOT, "labs");
const locales = fs
  .readdirSync(localesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
  .map((entry) => entry.name);

let pages = 0;
for (const locale of locales) {
  pages += copyTree(
    path.join(localesDir, locale),
    path.join(OUT, locale),
    (name) => name.endsWith(".md"),
    prepareLab(locale)
  );
}

/** Every markdown file under a folder, as paths relative to it. */
function markdownUnder(dir, prefix = "") {
  const out = [];
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...markdownUnder(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

// Each lab knows where it is read in the other languages. The folders mirror
// each other, so the counterpart of a page is its own path under another
// locale; the home page of the site language is the exception, because it is
// published at the root and that is the one the menu points at.
for (const locale of locales) {
  for (const rel of markdownUnder(path.join(OUT, locale))) {
    const byLocale = {};
    for (const other of locales) {
      byLocale[other] = other === SITE_LANG && rel === "index.md" ? "" : docUrl(`${other}/${rel}`);
    }
    const file = path.join(OUT, locale, rel);
    fs.writeFileSync(file, withAlternates(fs.readFileSync(file, "utf8"), byLocale, locale), "utf8");
  }
}

// The English home page is also the site home page. It moves up one level, so
// its relative links move with it: "level-1-contributor-basics/index.md" becomes "en/level-1-contributor-basics/...".
const enHome = path.join(OUT, "en", "index.md");
if (fs.existsSync(enHome)) {
  const home = fs
    .readFileSync(enHome, "utf8")
    .replace(/\]\((?!https?:|#|\/)/g, "](en/");
  fs.writeFileSync(path.join(OUT, "index.md"), home, "utf8");
}

const assets = copyTree(path.join(localesDir, "_assets"), path.join(OUT, "_assets"));

// The theme's own files: the stylesheet and its self-hosted fonts, the logo and
// the favicon, the table sorting script. course-site.yml points at them under theme/,
// which is where they land in the built site.
const themeFiles = copyTree(path.join(ROOT, "site-theme"), path.join(OUT, "theme"));

// The colours of the pill references, generated from the palette annotate.mjs
// draws the pills with, so the two can never drift apart. Dark scheme included:
// the palette is chosen against a white page.
const pillCss = [
  "",
  "/* Generated by scripts/build/site.mjs from the annotate.mjs palette. */",
  ".pill-ref { font-weight: 700; white-space: nowrap; }",
  ...PILL_PALETTE.map((color, index) => `.pill-ref-${index + 1} { color: ${color}; }`),
  '[data-md-color-scheme="slate"] .pill-ref {',
  "  filter: brightness(1.7) saturate(0.85);",
  "}",
  ""
].join("\n");
const themeCss = path.join(OUT, "theme", "stylesheets", "extra.css");
fs.appendFileSync(themeCss, pillCss, "utf8");

// TRANSLATION.md is read on GitHub too, where front matter renders as a table,
// so its search title and description are added here, on the way into the site,
// rather than in the file itself. It is written for translators, in English,
// and is not in the menu of any language.
const PAGE_META = {
  "TRANSLATION.md": {
    title: "Translating the Salesforce DevOps training",
    description: "How to translate the labs of the free Salesforce DevOps training with sfdx-hardis, and how translations are kept in step with the English source."
  }
};
const frontMatter = (meta) => {
  if (!meta) {
    return "";
  }
  const lines = ["---", `title: ${JSON.stringify(meta.title)}`];
  if (meta.description) {
    lines.push(`description: ${JSON.stringify(meta.description)}`);
  }
  // The picture a share of this page shows. Only a badge page sets one; every
  // other page falls back to the card of the course, in main.html.
  if (meta.social) {
    lines.push(`social: ${JSON.stringify(meta.social)}`);
  }
  return `${lines.join("\n")}\n---\n\n`;
};
for (const file of ["TRANSLATION.md"]) {
  const source = path.join(ROOT, file);
  if (fs.existsSync(source)) {
    fs.writeFileSync(path.join(OUT, file), frontMatter(PAGE_META[file]) + fs.readFileSync(source, "utf8"), "utf8");
  }
}

/**
 * Where a page of the backlog or the badges is published, per locale.
 *
 * The site language keeps the paths it has always had: /BACKLOG/US-024/ is the
 * ticket URL the course configuration builds from a story id, and /badges/ is
 * the page learners share. Every other language hangs under its own folder.
 */
const localePrefix = (locale) => (locale === SITE_LANG ? "" : `${locale}/`);

/** The backlog, one page per language, and one page per story under it. */
function backlogPages() {
  let written = 0;
  for (const locale of locales) {
    const s = strings(locale);
    const text = universeText(locale, universe);
    const dir = path.join(OUT, localePrefix(locale).replace(/\/$/, ""));
    fs.mkdirSync(dir, { recursive: true });
    const alternates = {};
    for (const other of locales) {
      alternates[other] = `${localePrefix(other)}BACKLOG/`;
    }
    const page = backlogPage({
      universe,
      s,
      text,
      // On the site, a story id points at its page next door
      storyLink: (story) => `BACKLOG/${story.id}.md`,
      generatedBy: "scripts/build/site.mjs"
    });
    fs.writeFileSync(
      path.join(dir, "BACKLOG.md"),
      withAlternates(frontMatter({ title: s.backlog.title, description: s.backlog.description }) + page, alternates, locale),
      "utf8"
    );
    written++;
  }
  return written;
}
const backlogs = backlogPages();

/** The title a lab of this locale gives itself, which is what a link to it should read. */
function labLinkText(locale, level, lab) {
  if (locale !== SITE_LANG) {
    const file = path.join(ROOT, "labs", locale, level.slug, `${lab.slug}.md`);
    if (fs.existsSync(file)) {
      const match = fs.readFileSync(file, "utf8").match(/^title:\s*"?(.+?)"?\s*$/m);
      if (match) {
        return match[1];
      }
    }
  }
  return fill(strings(locale).story.labLink, { level: level.level, lab: lab.lab, title: lab.title });
}

/**
 * One page per User Story, per language, and one JSON twin per story.
 *
 * The page is where a ticket link lands: config/.sfdx-hardis.yml builds it from the id alone
 * (genericTicketingProviderUrlBuilder), which is why the site language keeps /BACKLOG/<id>/.
 * The JSON is what sfdx-hardis reads to write the story title next to that link in Pull Request
 * comments and release notes (genericTicketingProviderDetailsUrlBuilder): the course has no
 * ticketing tool, and a static file per story is all the generic provider needs. It is written
 * once, for the site language, because that is the URL the configuration holds.
 */
function storyPages() {
  let count = 0;
  for (const locale of locales) {
    const s = strings(locale);
    const text = universeText(locale, universe);
    const dir = path.join(OUT, localePrefix(locale), "BACKLOG");
    fs.mkdirSync(dir, { recursive: true });
    for (const story of universe.userStories) {
      const owner = universe.cast.find((person) => person.handle === story.author);
      const level = universe.levels.find((one) => one.level === story.level);
      const lab = level?.labs.find((one) => one.lab === story.lab);
      // The labs of the site language sit under en/, the others under their own folder
      const labPath = locale === SITE_LANG ? `../${locale}/${level?.slug}/` : `../${level?.slug}/`;
      const labLink = lab
        ? `[${labLinkText(locale, level, lab)}](${labPath}${lab.slug}.md)`
        : `${s.backlog.lab} ${story.level}.${story.lab}`;
      const one = text.story(story);
      const alternates = {};
      for (const other of locales) {
        alternates[other] = `${localePrefix(other)}BACKLOG/${story.id}/`;
      }
      const page = storyPage({ universe, s, text, story, owner, labLink, backlogLink: "../BACKLOG.md" });
      fs.writeFileSync(
        path.join(dir, `${story.id}.md`),
        withAlternates(frontMatter({ title: `${story.id} - ${one.title}`, description: one.story }) + page, alternates, locale),
        "utf8"
      );
      count++;
      if (locale !== SITE_LANG) {
        continue;
      }
      const details = {
        id: story.id,
        subject: story.title,
        url: `${universe.course.site}/BACKLOG/${story.id}/`,
        owner: owner ? owner.name : story.author,
        branch: story.branch,
        lab: `${story.level}.${story.lab}`
      };
      fs.writeFileSync(path.join(dir, `${story.id}.json`), JSON.stringify(details, null, 2) + "\n", "utf8");
    }
  }
  return count;
}
const stories = storyPages();

// The link maps, labs/link-map.<locale>.md, are not published. They are a
// maintainer artifact: the Trailmix steps are built from them rather than from
// URLs retyped by hand, and check-links.mjs fetches every URL they hold, so a
// renamed documentation page fails CI here. Both read the file in the
// repository, where it renders as a table on GitHub. On the site it was a
// second copy of the menu, followed by a paragraph about CI.

// The badge images. The pages are built from the records below, in every
// language, so a badge claimed a year ago gains a new language on the next site
// build and a claim never has to write a page per locale.
const badgesDir = path.join(ROOT, "badges");
copyTree(path.join(badgesDir, "img"), path.join(OUT, "badges", "img"), (name) => name.endsWith(".svg"));
// The card a share shows, one per holder, written by scripts/badges/social.mjs.
// LinkedIn does not render SVG, so this one is a PNG and it is committed like
// the badge image itself.
copyTree(path.join(badgesDir, "social"), path.join(OUT, "badges", "social"), (name) => name.endsWith(".png"));
// The records are published as they are, at /badges/<trailblazer>.json, so that
// anything holding a Trailblazer username can ask what that person earned with
// one GET. The Trailhead Banner project is the reason this exists. GitHub Pages
// serves them with Access-Control-Allow-Origin: *, so a browser can read them.
const badgeRecords = copyTree(badgesDir, path.join(OUT, "badges"), (name) => name.endsWith(".json") && !name.startsWith("_"));

// One row per badge holder, read from the records the claim wrote. The name and
// the Trailblazer username are stored there on purpose: the site build never
// calls the Trailblazer API, so a build is not at the mercy of it being up, and
// a badge keeps reading right if a profile later goes private.
const holders = (fs.existsSync(badgesDir)
  ? fs.readdirSync(badgesDir).filter((name) => name.endsWith(".json"))
  : []
)
  .map((file) => {
    // The file name is the Trailblazer username: it keys the page, the record
    // and the images. The GitHub handle is inside, as the recipient.
    const key = file.replace(/\.json$/, "");
    let record = {};
    try {
      record = JSON.parse(fs.readFileSync(path.join(badgesDir, file), "utf8"));
    } catch (error) {
      console.warn(`badges/${file} could not be read, listing it by its key: ${error.message}`);
    }
    const badges = Array.isArray(record.badges) ? record.badges : [];
    const highest = badges.reduce((best, badge) => (best === null || badge.level > best.level ? badge : best), null);
    const trimmed = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);
    return {
      key,
      // A record written before names were stored has only its key
      name: trimmed(record.name) || key,
      recipient: trimmed(record.recipient),
      trailblazer: trimmed(record.trailblazer) || key,
      highest,
      record
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.key.localeCompare(b.key));

/**
 * The badges index and one page per holder, in every language.
 *
 * The images and the machine readable records stay where they have always been,
 * under /badges/: a learner shares the page, but the Trailhead Banner project
 * reads /badges/<trailblazer>.json, and those URLs do not move for a language.
 */
function badgePages() {
  let written = 0;
  const claimUrl = `https://github.com/${universe.course.upstreamRepo}/issues/new/choose`;
  for (const locale of locales) {
    const s = strings(locale);
    const dir = path.join(OUT, localePrefix(locale), "badges");
    fs.mkdirSync(dir, { recursive: true });
    // One copy of each image, under the site language, reached from anywhere
    const images = locale === SITE_LANG ? "img" : "../../badges/img";
    // The example Trailhead banner lives with the lab assets, one tree up from
    // the badges folder of the site language and two up from any other.
    const exampleBanner = `${locale === SITE_LANG ? ".." : "../.."}/_assets/badges/trailhead-banner.png`;

    const indexAlternates = {};
    for (const other of locales) {
      indexAlternates[other] = `${localePrefix(other)}badges/`;
    }
    const index = badgesPage({
      s,
      holders,
      badgeHref: (key) => `${key}.md`,
      badgeImage: (key, level) => `${images}/${key}-level-${level}.svg`,
      claimUrl,
      recordUrlPattern: `${universe.course.site}/badges/<trailblazer-username>.json`,
      bannerExample: exampleBanner
    });
    fs.writeFileSync(
      path.join(dir, "index.md"),
      withAlternates(frontMatter({ title: s.badges.title, description: s.badges.description }) + index, indexAlternates, locale),
      "utf8"
    );
    written++;

    for (const holder of holders) {
      const alternates = {};
      for (const other of locales) {
        alternates[other] = `${localePrefix(other)}badges/${holder.key}/`;
      }
      const pageUrl = `${universe.course.site}/${localePrefix(locale)}badges/${holder.key}/`;
      const page = badgePage({
        s,
        holder,
        badgeImage: (level) => `${images}/${holder.key}-level-${level}.svg`,
        // The banner version: one file per level, next to the badge images
        bannerImage: (level) => `${images}/banner-level-${level}.svg`,
        courseUrl: `${universe.course.site}/`,
        pageUrl,
        recordUrl: `${universe.course.site}/badges/${holder.key}.json`
      });
      // The card of this holder when there is one, the course card otherwise:
      // a badge awarded before social.mjs existed has none until it is re-run
      const card = path.join(badgesDir, "social", `${holder.key}.png`);
      const social = fs.existsSync(card) ? `badges/social/${holder.key}.png` : null;
      const highest = holder.highest ? holder.highest.name : s.badges.heading;
      fs.writeFileSync(
        path.join(dir, `${holder.key}.md`),
        withAlternates(
          frontMatter({
            title: holder.name,
            description: fill(s.badge.description, { name: holder.name, badge: highest }),
            social
          }) + page,
          alternates,
          locale
        ),
        "utf8"
      );
      written++;
    }
  }
  return written;
}
const badgePageCount = badgePages();

console.log(`site-src assembled: ${pages} lab page(s), ${backlogs} backlog page(s), ${stories} story page(s), ${assets} asset(s), ${themeFiles} theme file(s), ${badgePageCount} badge page(s), ${badgeRecords} badge record(s), ${locales.length} locale(s)`);
