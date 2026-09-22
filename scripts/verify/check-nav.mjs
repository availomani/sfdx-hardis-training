#!/usr/bin/env node
/**
 * Checks that each language of the built site reads as a course of its own.
 *
 *   node scripts/build/site.mjs && python -m zensical build -f course-site.yml
 *   node scripts/verify/check-nav.mjs
 *
 * Four things, all of them invisible until a reader falls through them:
 *
 *   1. the left menu of a page holds that page's language and nothing else,
 *   2. the translate widget lands on the same page in the other language,
 *      rather than on the home page of that language,
 *   3. the previous and next arrows stay inside one language,
 *   4. no page carries a <link rel="alternate">, which would hand the click
 *      back to the theme and undo (2). See the languages key in course-site.yml.
 *
 * All three come from the "lang" front matter every page carries, read by the
 * three partials under site-overrides/. A Zensical upgrade that changes those
 * partials, or a page that forgets its front matter, shows up here. The link
 * targets themselves are check-site.mjs's job: this says the links point at the
 * right pages, not that the pages exist.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SITE = path.join(ROOT, "site");

if (!fs.existsSync(SITE)) {
  console.error("No site/ directory. Build it first:");
  console.error("  node scripts/build/site.mjs && python -m zensical build -f course-site.yml");
  process.exit(2);
}

// The languages the site is built in, from the folders of labs/
const LOCALES = fs
  .readdirSync(path.join(ROOT, "labs"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
  .map((entry) => entry.name);

/**
 * The language of a built page, from where it sits in the site.
 *
 * Everything written in a language lives under the folder of that language, the
 * labs and the link map alike. The home page of the site is the English home
 * page, published at the root as well as under en/. Everything else, the
 * backlog, the badges, the story pages and 404.html, is written once in English
 * and belongs to no language in particular: those pages keep the menu of the
 * site language and show in every menu.
 */
function localeOf(relative) {
  const first = relative.split("/")[0];
  if (LOCALES.includes(first)) {
    return first;
  }
  if (relative === "index.html") {
    return "en";
  }
  return null;
}

// The language the site leads with, whose home page is the home page of the site
const SITE_LANG = (fs.readFileSync(path.join(ROOT, "course-site.yml"), "utf8").match(/^ {2}language:\s*(\S+)/m) || [])[1] || "en";

/** The same page in another language, as a path inside the site, or null. */
function counterpart(relative, locale, other) {
  return relative.startsWith(`${locale}/`) ? `${other}/${relative.slice(locale.length + 1)}` : null;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

const BASE_PATH = (() => {
  const match = fs.readFileSync(path.join(ROOT, "course-site.yml"), "utf8").match(/^site_url:\s*(\S+)/m);
  const pathname = match ? new URL(match[1]).pathname : "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
})();

/** A link as a path inside the site, whether it was written relative or absolute. */
function resolveHref(href, pageDir) {
  const clean = href.split("?")[0].split("#")[0];
  const rooted = clean.startsWith("/")
    ? path.join(SITE, clean.replace(BASE_PATH, "/"))
    : path.resolve(pageDir, clean);
  const relative = path.relative(SITE, rooted).replace(/\\/g, "/");
  return relative.endsWith(".html") ? relative : `${relative}/index.html`.replace(/^\/+/, "");
}

function section(html, from, to) {
  const start = html.indexOf(from);
  if (start < 0) {
    return "";
  }
  const end = html.indexOf(to, start);
  return html.slice(start, end < 0 ? html.length : end);
}

const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^(https?:|mailto:|#)/.test(h));

const problems = [];
let menus = 0;
let widgets = 0;

for (const file of walk(SITE)) {
  const relative = path.relative(SITE, file).replace(/\\/g, "/");
  const pageDir = path.dirname(file);
  const locale = localeOf(relative);
  const html = fs.readFileSync(file, "utf8");

  // 1. The header and the left menu, which runs from the primary sidebar to the
  // content. The logo lives in the header, and it is the link that used to drop
  // a French reader on the English home page. The translate widget is in the
  // header too and points at another language on purpose: it is checked below,
  // and its links are the ones carrying hreflang.
  const menu = section(html, "md-header", "md-content").replace(/<a href="[^"]+"[^>]*hreflang="[^"]+"[^>]*>/g, "");
  if (menu) {
    menus++;
    for (const href of hrefs(menu)) {
      const target = localeOf(resolveHref(href, pageDir));
      if (target && locale && target !== locale) {
        problems.push(`${relative} (${locale}): its menu holds a ${target} page, ${href}`);
      }
    }
  }

  // 2. The translate widget, one link per language
  const widget = [...html.matchAll(/<a href="([^"]+)"[^>]*hreflang="([^"]+)"[^>]*class="md-select__link"/g)];
  if (widget.length > 0 && locale) {
    widgets++;
    for (const [, href, other] of widget) {
      if (other === locale) {
        continue;
      }
      const wanted = counterpart(relative, locale, other);
      if (!wanted || !fs.existsSync(path.join(SITE, wanted))) {
        continue;
      }
      const landing = resolveHref(href, pageDir);
      // The home page of the site language is published twice, under its own
      // folder and at the root, which is where the widget sends a reader
      const home = wanted === `${other}/index.html` && other === SITE_LANG && landing === "index.html";
      if (landing !== wanted && !home) {
        problems.push(`${relative} (${locale}): its ${other} link goes to ${landing}, not to ${wanted}`);
      }
    }
  }

  // 3. No <link rel="alternate"> in the head. The theme reads those as the roots
  // of other sites, asks each one for its sitemap.xml, and takes over every click
  // into them. Here the languages are folders of one site, so the lookup finds
  // nothing and the reader lands on the home page of the other language whatever
  // the widget says. Naming the config key "alternate" again is all it takes.
  if (/<link[^>]+rel="alternate"/.test(html)) {
    problems.push(`${relative}: carries a <link rel="alternate">, which gives the theme the language switch back`);
  }

  // 4. The previous and next arrows
  for (const match of html.matchAll(/<a href="([^"]+)" class="md-footer__link md-footer__link--(prev|next)"/g)) {
    const target = localeOf(resolveHref(match[1], pageDir));
    if (target && locale && target !== locale) {
      problems.push(`${relative} (${locale}): its ${match[2]} arrow goes to a ${target} page, ${match[1]}`);
    }
  }
}

console.log(`${menus} menu(s) and ${widgets} translate widget(s) checked, ${LOCALES.join(", ")}.`);

if (problems.length > 0) {
  console.error(`\n${problems.length} page(s) that leak another language:`);
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

console.log("Every menu holds one language, every translate widget lands on the same page, every arrow stays put.");
