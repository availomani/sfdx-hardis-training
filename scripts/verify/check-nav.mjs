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
 *   2. the language picker lands on the same page in the other language, and
 *      that page points back at this one,
 *   3. the previous and next arrows stay inside one language,
 *   4. no page carries a <link rel="alternate">, which would hand the click
 *      back to the theme and undo (2). See the languages key in course-site.yml.
 *
 * It reads what the pages themselves declare rather than working the layout out
 * again: every page carries its language and its counterparts on the menu
 * element, from its front matter, so a page published in the wrong place is
 * caught here instead of agreeing with a checker that made the same mistake.
 * That the links resolve at all is check-site.mjs's job.
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

const BASE_PATH = (() => {
  const match = fs.readFileSync(path.join(ROOT, "course-site.yml"), "utf8").match(/^site_url:\s*(\S+)/m);
  const pathname = match ? new URL(match[1]).pathname : "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
})();

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

const hrefs = (html) =>
  [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !/^(https?:|mailto:|#)/.test(h));

/** What a page says about itself, on the menu element the theme swaps. */
function pageFacts(html) {
  const menu = html.match(/<nav class="md-nav md-nav--primary"[^>]*>/);
  if (!menu) {
    return null;
  }
  const tag = menu[0];
  const lang = (tag.match(/data-course-lang="([^"]*)"/) || [])[1] || "";
  const alternates = {};
  for (const match of tag.matchAll(/data-course-alt-([a-z]{2}(?:-[A-Z]{2})?)="([^"]*)"/g)) {
    alternates[match[1]] = match[2];
  }
  return { lang, alternates };
}

/** The page a declared counterpart points at, as a path inside the site. */
const pageOf = (declared) => (declared === "" ? "index.html" : `${declared}index.html`);

const pages = walk(SITE);
const facts = new Map();
for (const file of pages) {
  const relative = path.relative(SITE, file).replace(/\\/g, "/");
  facts.set(relative, pageFacts(fs.readFileSync(file, "utf8")));
}
const langOf = (relative) => (facts.get(relative) && facts.get(relative).lang) || "";

const problems = [];
let menus = 0;
let pickers = 0;
const unreadable = [];

for (const file of pages) {
  const relative = path.relative(SITE, file).replace(/\\/g, "/");
  const pageDir = path.dirname(file);
  const html = fs.readFileSync(file, "utf8");
  const self = facts.get(relative);
  if (!self) {
    // Every page of this site carries the menu, so a page without it means the
    // element changed shape and this script is reading nothing. Silence here
    // would be a green check over an unchecked site.
    unreadable.push(relative);
    continue;
  }

  // 1. The header and the left menu, which runs from the primary sidebar to the
  // content. The logo lives in the header, and it is the link that used to drop
  // a French reader on the English home page. The picker is in the header too
  // and points at another language on purpose: it is checked below, and its
  // links are the ones carrying hreflang.
  const menu = section(html, "md-header", "md-content").replace(/<a href="[^"]+"[^>]*hreflang="[^"]+"[^>]*>/g, "");
  if (menu) {
    menus++;
    for (const href of hrefs(menu)) {
      const target = langOf(resolveHref(href, pageDir));
      if (target && self.lang && target !== self.lang) {
        problems.push(`${relative} (${self.lang}): its menu holds a ${target} page, ${href}`);
      }
    }
  }

  // 2. The picker lands on what the page declares, and the page it lands on
  // points back here. A pair that disagrees is a page translated on one side
  // and forgotten on the other.
  const picker = [...html.matchAll(/<a href="([^"]+)"[^>]*hreflang="([^"]+)"[^>]*class="md-select__link"/g)];
  if (picker.length > 0) {
    pickers++;
    for (const [, href, other] of picker) {
      if (other === self.lang) {
        continue;
      }
      const landing = resolveHref(href, pageDir);
      const declared = self.alternates[other];
      if (!declared) {
        // Nothing to jump to: the home page of that language, which must be one
        if (langOf(landing) && langOf(landing) !== other) {
          problems.push(
            `${relative} (${self.lang}): with no ${other} counterpart it falls back to ${landing}, which is not ${other}`
          );
        }
        continue;
      }
      if (landing !== pageOf(declared)) {
        problems.push(`${relative} (${self.lang}): its ${other} link goes to ${landing}, not to ${pageOf(declared)}`);
        continue;
      }
      const back = facts.get(landing);
      if (!back) {
        continue;
      }
      if (back.lang !== other) {
        problems.push(
          `${relative} (${self.lang}): its ${other} link lands on ${landing}, which is ${back.lang || "in no language"}`
        );
      }
      const returned = back.alternates[self.lang];
      // The home page of the site language is published twice, at the root and
      // under its own folder, and the counterpart of any page is the root one.
      // A page that comes back to its own twin has come back here.
      const twin = facts.get(pageOf(returned));
      const samePage =
        twin &&
        twin.lang === self.lang &&
        JSON.stringify(twin.alternates) === JSON.stringify(self.alternates);
      if (returned !== undefined && pageOf(returned) !== relative && !samePage) {
        problems.push(
          `${relative} (${self.lang}): ${landing} points its ${self.lang} link at ${pageOf(returned)}, not back here`
        );
      }
    }
  }

  // 3. No <link rel="alternate"> in the head. The theme reads those as the roots
  // of other sites, asks each one for its sitemap.xml, and takes over every click
  // into them. Here the languages are folders of one site, so the lookup finds
  // nothing and the reader lands on the home page of the other language whatever
  // the picker says. Naming the config key "alternate" again is all it takes.
  if (/<link[^>]+rel="alternate"/.test(html)) {
    problems.push(`${relative}: carries a <link rel="alternate">, which gives the theme the language switch back`);
  }

  // 4. The previous and next arrows
  for (const match of html.matchAll(/<a href="([^"]+)" class="md-footer__link md-footer__link--(prev|next)"/g)) {
    const target = langOf(resolveHref(match[1], pageDir));
    if (target && self.lang && target !== self.lang) {
      problems.push(`${relative} (${self.lang}): its ${match[2]} arrow goes to a ${target} page, ${match[1]}`);
    }
  }
}

console.log(`${menus} menu(s) and ${pickers} language picker(s) checked over ${pages.length} page(s).`);

if (unreadable.length > 0) {
  console.error(
    `\n${unreadable.length} page(s) whose menu this script could not read, so nothing was checked on them:`
  );
  unreadable.slice(0, 5).forEach((one) => console.error(`  ${one}`));
  console.error("  The nav element or its class changed. Read pageFacts() against partials/nav.html.");
  process.exit(1);
}
if (menus === 0 || pickers === 0) {
  console.error("\nNo menu and no picker was read at all: this script checked nothing.");
  process.exit(1);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} page(s) that leak another language:`);
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

console.log("Every menu holds one language, every picker lands on the same page and comes back, every arrow stays put.");
