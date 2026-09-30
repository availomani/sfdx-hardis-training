#!/usr/bin/env node
/**
 * Builds redirect-site/, the site that keeps the old URL answering.
 *
 *   node scripts/build/redirect-site.mjs          # build it from site/
 *   node scripts/build/redirect-site.mjs --check  # prove it covers site/
 *
 * The course moved from a project site of this repository, under
 * /sfdx-hardis-training/, to its own host. The old URL is in the badge records
 * people already hold, in the Trailhead trailmixes, in the sfdx-hardis command
 * descriptions and in the VS Code extension fixtures, and none of those can be
 * recalled. So the old address keeps its Pages site, and that site is this: one
 * page per page of the course, each one sending the reader to the same page on
 * the new host.
 *
 * Two things follow from GitHub Pages being unable to answer with a redirect
 * status.
 *
 * The first is that a page here is a meta refresh and a canonical link, which is
 * all a static host can offer. Search engines read the canonical, browsers obey
 * the refresh, and the sentence in the body is there for whoever gets neither.
 *
 * The second is that the badge records cannot be redirected at all. A meta
 * refresh is HTML, and nothing fetching /badges/<name>.json or embedding
 * /badges/img/<name>-level-1.svg parses HTML. Those files are copied here as
 * they are, so an assertion handed out on the old host keeps resolving to the
 * badge it describes. Everything under badges/ that is not a page is copied for
 * the same reason.
 *
 * It is rebuilt on every push, from the site that was just built, so the set of
 * pages it covers is the set of pages that exists. A page added to the course
 * gets its redirect in the same run, which is why there is no catch-all here.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CLOUDITY_SITE_URL } from "../lib/urls.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SITE = path.join(ROOT, "site");
const OUT = path.join(ROOT, "redirect-site");
const CHECK = process.argv.includes("--check");

// The one sentence a reader sees, in the language of the page they asked for,
// and only if their browser ignored the refresh. It is here rather than in
// i18n/<locale>.json because that file is the words of the pages this site
// generates, read by scripts/lib/strings.mjs, and a redirect page is not one of
// them: it belongs to the site being left behind.
const MOVED = {
  en: (url) => `This course has moved to <a href="${url}">${url}</a>.`,
  fr: (url) => `Ce cours a déménagé vers <a href="${url}">${url}</a>.`,
};

if (!fs.existsSync(SITE)) {
  console.error("No site/ directory. Build it first:");
  console.error("  node scripts/build/site.mjs && python -m zensical build -f course-site.yml");
  process.exit(2);
}

/** Every file under dir, as paths relative to SITE, in posix form. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(path.relative(SITE, full).split(path.sep).join("/"));
    }
  }
  return out;
}

const files = walk(SITE);

/**
 * The pages of the course. Zensical writes one index.html per page and the URL
 * is its folder, so 404.html, which is not a page anybody asks for by name, is
 * not one of these: an unknown path on the old host stays a 404, as it was.
 */
const pages = files.filter((rel) => rel === "index.html" || rel.endsWith("/index.html"));

/**
 * The files served as they are: the badge records and their images. Anything
 * under badges/ that is not a page, so a new kind of badge asset is carried
 * without this list having to learn about it.
 */
const copied = files.filter((rel) => rel.startsWith("badges/") && !rel.endsWith(".html"));

/** The URL path of a page, from the file that holds it: "" for the home page, "en/" for en/index.html. */
function urlPath(rel) {
  return rel === "index.html" ? "" : rel.slice(0, -"index.html".length);
}

function attribute(html, name) {
  const match = html.match(new RegExp(`<html[^>]*\\s${name}="([^"]*)"`, "i"));
  return match ? match[1] : null;
}

function title(html) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

function escape(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The redirect page for one page of the course. */
function redirectPage(source, target) {
  const html = fs.readFileSync(source, "utf8");
  const lang = (attribute(html, "lang") || "en").slice(0, 2);
  const sentence = (MOVED[lang] || MOVED.en)(target);
  const heading = title(html);
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${heading ? escape(heading) : "Moved"}</title>
    <link rel="canonical" href="${target}">
    <meta http-equiv="refresh" content="0; url=${target}">
  </head>
  <body>
    <p>${sentence}</p>
  </body>
</html>
`;
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const rel of pages) {
    const target = `${CLOUDITY_SITE_URL}/${urlPath(rel)}`;
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, redirectPage(path.join(SITE, rel), target), "utf8");
  }
  for (const rel of copied) {
    const file = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.join(SITE, rel), file);
  }
  console.log(
    `redirect-site assembled: ${pages.length} redirect page(s) to ${CLOUDITY_SITE_URL}, ${copied.length} badge file(s) served as they are.`
  );
}

function check() {
  if (!fs.existsSync(OUT)) {
    console.error("No redirect-site/ directory. Build it first: node scripts/build/redirect-site.mjs");
    process.exit(2);
  }
  const problems = [];
  for (const rel of pages) {
    const file = path.join(OUT, rel);
    if (!fs.existsSync(file)) {
      problems.push(`${rel} has no redirect`);
      continue;
    }
    const target = `${CLOUDITY_SITE_URL}/${urlPath(rel)}`;
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes(`<link rel="canonical" href="${target}">`)) {
      problems.push(`${rel} does not declare ${target} as its canonical`);
    }
    if (!html.includes(`content="0; url=${target}"`)) {
      problems.push(`${rel} does not refresh to ${target}`);
    }
    // A redirect page that still names the old host sends the reader back where
    // they came from, and a loop is worse than a dead link.
    if (html.includes("hardisgroupcom.github.io")) {
      problems.push(`${rel} still points at the old host`);
    }
  }
  for (const rel of copied) {
    const file = path.join(OUT, rel);
    if (!fs.existsSync(file)) {
      problems.push(`${rel} was not copied, and nothing that fetches it parses HTML`);
      continue;
    }
    if (!fs.readFileSync(file).equals(fs.readFileSync(path.join(SITE, rel)))) {
      problems.push(`${rel} differs from the one the site publishes`);
    }
  }

  console.log(`${pages.length} redirect page(s), ${copied.length} badge file(s) served as they are.`);
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s) with the redirect site:`);
    problems.forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }
  console.log(`Every page of the course has a redirect to ${CLOUDITY_SITE_URL}, and every badge file is served as it is.`);
}

if (CHECK) {
  check();
} else {
  build();
}
