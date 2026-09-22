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
 *   BACKLOG.md                     -> site-src/BACKLOG.md
 *   training-universe.json stories -> site-src/BACKLOG/US-nnn.md and US-nnn.json
 *   badges/<trailblazer>.md        -> site-src/badges/<trailblazer>.md
 *   badges/<trailblazer>.json      -> site-src/badges/<trailblazer>.json (read by other sites)
 *
 *   node scripts/build/site.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PILL_PALETTE } from "./annotate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "site-src");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));

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

// Everything else the site publishes. These files are read on GitHub too, where
// front matter renders as a table, so their search title and description are
// added here, on the way into the site, rather than in the files themselves.
const PAGE_META = {
  "BACKLOG.md": {
    title: "Helios Energy backlog: the User Stories of the course",
    description: "Every User Story of the Salesforce DevOps training with sfdx-hardis, with its acceptance criteria, its Git branch and the lab that delivers it."
  },
  "TRANSLATION.md": {
    title: "Translating the Salesforce DevOps training",
    description: "How to translate the labs of the free Salesforce DevOps training with sfdx-hardis, and how translations are kept in step with the English source."
  }
};
const frontMatter = (meta) =>
  meta ? `---\ntitle: ${JSON.stringify(meta.title)}\ndescription: ${JSON.stringify(meta.description)}\n---\n\n` : "";
for (const file of ["BACKLOG.md", "TRANSLATION.md"]) {
  const source = path.join(ROOT, file);
  if (fs.existsSync(source)) {
    fs.writeFileSync(path.join(OUT, file), frontMatter(PAGE_META[file]) + fs.readFileSync(source, "utf8"), "utf8");
  }
}
// On the site, the story links of the backlog stay on the site being built
const backlogOut = path.join(OUT, "BACKLOG.md");
if (fs.existsSync(backlogOut)) {
  const siteStoryLink = new RegExp(`\\]\\(${universe.course.site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/BACKLOG/(US-\\d+)/\\)`, "g");
  fs.writeFileSync(backlogOut, fs.readFileSync(backlogOut, "utf8").replace(siteStoryLink, "](BACKLOG/$1.md)"), "utf8");
}

/**
 * One page per User Story, BACKLOG/<id>/, and its JSON twin, BACKLOG/<id>.json.
 *
 * The page is where a ticket link lands: config/.sfdx-hardis.yml builds it from the id alone
 * (genericTicketingProviderUrlBuilder). The JSON is what sfdx-hardis reads to write the story
 * title next to that link in Pull Request comments and release notes
 * (genericTicketingProviderDetailsUrlBuilder): the course has no ticketing tool, and a static
 * file per story is all the generic provider needs.
 */
function storyPages() {
  const dir = path.join(OUT, "BACKLOG");
  fs.mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const story of universe.userStories) {
    const owner = universe.cast.find((person) => person.handle === story.author);
    const level = universe.levels.find((one) => one.level === story.level);
    const lab = level?.labs.find((one) => one.lab === story.lab);
    const labLink = lab ? `[Lab ${story.level}.${story.lab} - ${lab.title}](../en/${level.slug}/${lab.slug}.md)` : `Lab ${story.level}.${story.lab}`;
    const page = [
      frontMatter({ title: `${story.id} - ${story.title}`, description: story.story }) + `# ${story.id} - ${story.title}`,
      "",
      `> ${story.story}`,
      "",
      "Acceptance criteria:",
      "",
      ...story.acceptance.map((criterion) => `- ${criterion}`),
      "",
      "| | |",
      "|---|---|",
      `| Owner | ${owner ? owner.name : story.author} |`,
      `| Branch | \`${story.branch}\` |`,
      `| Delivered in | ${labLink} |`,
      "",
      "[All the stories of the backlog](../BACKLOG.md)",
      ""
    ].join("\n");
    fs.writeFileSync(path.join(dir, `${story.id}.md`), page, "utf8");
    const details = {
      id: story.id,
      subject: story.title,
      url: `${universe.course.site}/BACKLOG/${story.id}/`,
      owner: owner ? owner.name : story.author,
      branch: story.branch,
      lab: `${story.level}.${story.lab}`
    };
    fs.writeFileSync(path.join(dir, `${story.id}.json`), JSON.stringify(details, null, 2) + "\n", "utf8");
    count++;
  }
  return count;
}
const stories = storyPages();

// One link map per locale, labs/link-map.<locale>.md, all generated by universe.mjs
for (const name of fs.readdirSync(path.join(ROOT, "labs"))) {
  if (!/^link-map\.[a-z]{2}(-[A-Z]{2})?\.md$/.test(name)) {
    continue;
  }
  fs.mkdirSync(path.join(OUT, "labs"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "labs", name), path.join(OUT, "labs", name));
}

// Badge pages, plus an index of them
const badgesDir = path.join(ROOT, "badges");
const badgePages = copyTree(badgesDir, path.join(OUT, "badges"), (name) => name.endsWith(".md") && !name.startsWith("_"));
copyTree(path.join(badgesDir, "img"), path.join(OUT, "badges", "img"), (name) => name.endsWith(".svg"));
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
      highest
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.key.localeCompare(b.key));

const holderRows = [
  "| | Name | Highest badge | GitHub | Trailblazer |",
  "|---|---|---|---|---|",
  ...holders.map((holder) => {
    // An <img> and not markdown: the badge is drawn 320 square, and a table cell
    // wants a thumbnail. Plain HTML sizes it without depending on an extension.
    const image = holder.highest
      ? `<img src="img/${holder.key}-level-${holder.highest.level}.svg" alt="${holder.highest.name}" width="72"/>`
      : "";
    const trailblazer = holder.trailblazer
      ? `[${holder.trailblazer}](https://www.salesforce.com/trailblazer/${holder.trailblazer})`
      : "";
    const github = holder.recipient
      ? `[@${holder.recipient}](https://github.com/${holder.recipient})`
      : "";
    return (
      `| ${image} | [${holder.name}](${holder.key}.md) | ${holder.highest ? holder.highest.name : ""} ` +
      `| ${github} | ${trailblazer} |`
    );
  })
].join("\n");

const badgeIndex = [
  frontMatter({
    title: "Salesforce DevOps training badges",
    description: "The learners who finished a level of the free Salesforce DevOps training with sfdx-hardis, checked by a job that read their public repository."
  }) + "# Badges",
  "",
  "Everybody who finished a level of this course and claimed it.",
  "",
  "It is a badge, not a certification: there is no exam here. What it says is that a job read the",
  "person's public repository and found the work.",
  "",
  holders.length === 0 ? "Nobody has claimed a badge yet. Be the first." : holderRows,
  "",
  "## Claim yours",
  "",
  "In VS Code: Welcome page > **Training: Level N** > **Claim my badge**. It checks the whole level",
  "on your machine first, then opens the claim form with everything already filled in, and you tick",
  "the three boxes and submit.",
  "",
  "Each level also asks you to star the open source project it teaches, which the command offers to",
  "do and the audit checks.",
  "",
  `You can also [open a claim issue](https://github.com/${universe.course.upstreamRepo}/issues/new/choose) by hand,`,
  "with your level, your Trailblazer username, the URL of your public fork and the receipt lines",
  "printed by **Check my work**.",
  "",
  "## Reading a badge from another site",
  "",
  "Every badge is also published as JSON, keyed by Trailblazer username, so a tool that knows",
  "somebody's Trailblazer username can ask what they earned here without an index or an API key:",
  "",
  "```",
  `${universe.course.site}/badges/<trailblazer-username>.json`,
  "```",
  "",
  "It answers `404` when that person has no badge. The document holds the recipient's GitHub handle,",
  "their name, and one entry per badge with its level, its date, the number of checks that passed and",
  "the URL of its image. These files are served with `Access-Control-Allow-Origin: *`, so a page in a",
  "browser can read them directly.",
  ""
].join("\n");
fs.mkdirSync(path.join(OUT, "badges"), { recursive: true });
fs.writeFileSync(path.join(OUT, "badges", "index.md"), badgeIndex, "utf8");

console.log(`site-src assembled: ${pages} lab page(s), ${stories} story page(s), ${assets} asset(s), ${themeFiles} theme file(s), ${badgePages} badge page(s), ${badgeRecords} badge record(s), ${locales.length} locale(s)`);
