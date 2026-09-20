#!/usr/bin/env node
/**
 * Checks the built site: every page exists, and every asset every page references
 * is really there.
 *
 *   node scripts/build/site.mjs && python -m zensical build -f course-site.yml
 *   node scripts/verify/check-site.mjs
 *
 * It reads the generated HTML and resolves each reference against the built
 * output on disk, rather than rendering pages in a browser. A browser lazy-loads
 * images below the fold, so a DOM check reports whatever happened not to have
 * loaded yet; resolving on disk answers the question that actually matters, which
 * is whether the file a learner's browser will ask for exists.
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

// The path the site is published under, from course-site.yml site_url
function sitePathPrefix() {
  try {
    const mkdocs = fs.readFileSync(path.join(ROOT, "course-site.yml"), "utf8");
    const match = mkdocs.match(/^site_url:\s*(\S+)/m);
    if (!match) {
      return "/";
    }
    const url = new URL(match[1]);
    return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  } catch {
    return "/";
  }
}
const BASE_PATH = sitePathPrefix();

const pages = walk(SITE);
const problems = [];
let references = 0;
let links_checked = 0;

for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  const pageUrl = "/" + path.relative(SITE, file).replace(/\\/g, "/");
  const pageDir = path.dirname(file);

  // Every local asset the page asks for: images, stylesheets, scripts
  const refs = [
    ...[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)].map((m) => m[1])
  ];

  // Every page this page links to. A link out of labs/ carries one "../" too
  // many for the site, resolves fine on GitHub, and 404s for the reader.
  const links = [...html.matchAll(/<a[^>]+href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((href) => !/^(https?:|mailto:|#)/.test(href));

  for (const ref of links) {
    const clean = ref.split("?")[0].split("#")[0];
    if (clean === "" || clean === ".") {
      continue;
    }
    links_checked++;
    const rooted = clean.startsWith("/") ? clean.replace(BASE_PATH, "/") : clean;
    const target = rooted.startsWith("/")
      ? path.join(SITE, rooted)
      : path.resolve(pageDir, rooted);
    // A directory link is the page inside it; anything else is the file itself
    const exists =
      fs.existsSync(target) &&
      (!fs.statSync(target).isDirectory() || fs.existsSync(path.join(target, "index.html")));
    if (!exists) {
      problems.push(`${pageUrl} -> ${ref} (link goes nowhere)`);
    }
  }

  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith("data:")) {
      continue;
    }
    references++;
    // An absolute reference carries the site_url path prefix, which is right on
    // the published site and meaningless against the built folder. 404.html is
    // the page that uses them, because it has to work from any depth.
    const clean = ref.split("?")[0].split("#")[0];
    const rooted = clean.startsWith("/") ? clean.replace(BASE_PATH, "/") : clean;
    const target = rooted.startsWith("/")
      ? path.join(SITE, rooted)
      : path.resolve(pageDir, rooted);
    if (!fs.existsSync(target)) {
      problems.push(`${pageUrl} -> ${ref} (no such file)`);
    }
  }
}

console.log(
  `${pages.length} page(s), ${references} local asset reference(s), ${links_checked} internal link(s).`
);

if (problems.length > 0) {
  console.error(`\n${problems.length} reference(s) that go nowhere:`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

console.log("Every page resolves every asset and every link it carries.");
