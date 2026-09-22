#!/usr/bin/env node
/**
 * Clicks the translate widget the way a reader reaches it, and checks where it lands.
 *
 *   node scripts/build/site.mjs && python -m zensical build -f course-site.yml
 *   node scripts/verify/check-language-switch.mjs
 *
 * check-nav.mjs reads the built HTML, which is the state of a page opened
 * directly, and there the widget is always right. A reader does not open a lab
 * directly: they land on the home page and walk through the menu. The theme
 * navigates without reloading and swaps the container, the logo and the header
 * title, never the rest of the header, so the widget kept the links of the page
 * they landed on and sent them to the home page of the other language.
 * site-theme/javascripts/language-switch.js rebuilds them, and only a browser
 * can say that it does.
 *
 * It serves the built site on a port of its own, so run the site build first.
 */
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SITE = path.join(ROOT, "site");

// The site is published under a path of its own, and the fallback links of the
// widget are written with it. Serving at the root would make those links look
// broken here and right in production, so this serves the site where it lives.
const BASE = (() => {
  const match = fs.readFileSync(path.join(ROOT, "course-site.yml"), "utf8").match(/^site_url:\s*(\S+)/m);
  const pathname = match ? new URL(match[1]).pathname : "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
})();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

/**
 * One walk per direction: land on a home page, open a level, open a lab, then
 * ask for the other language. The lab has to be reached through the menu, which
 * is what leaves the header behind.
 */
const WALKS = [
  {
    land: "/",
    level: "Level 2 - Contributor advanced",
    lab: "Lab 2.2",
    to: "fr",
    expect: "/fr/level-2-contributor-advanced/2-2-fix-a-missing-dependency-deployment-error/",
  },
  {
    land: "/fr/",
    level: "Niveau 3 - Release manager Salesforce DevOps",
    lab: "Lab 3.7",
    to: "en",
    expect: "/en/level-3-release-manager/3-7-hotfix-and-retrofit/",
  },
];

/** And a page in no language: there is nothing to land on but the home page of the language. */
const SHARED = { land: "/BACKLOG/", to: "fr", expect: "/fr/" };

if (!fs.existsSync(SITE)) {
  console.error("No built site. Run: node scripts/build/site.mjs && python -m zensical build -f course-site.yml");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (!url.startsWith(BASE)) {
    res.writeHead(302, { location: BASE });
    res.end();
    return;
  }
  let file = path.join(SITE, url.slice(BASE.length));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const port = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
const base = `http://127.0.0.1:${port}`;

// The repository carries no dependency of its own on purpose, so this one is
// asked for by name and explained when it is missing: it is an authoring and CI
// tool, never something a learner runs.
let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error(
    [
      "playwright-core is needed to open the pages. Install it first:",
      "  npm install --no-save playwright-core",
      "  npx playwright-core install chrome",
    ].join("\n"),
  );
  server.close();
  process.exit(1);
}
// A browser of this script's own, never the user's: see the training-update
// skill, connectOverCDP attaches to a real session and closing it closes theirs.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const problems = [];

/** The link of the widget for a language, as the browser would follow it. */
const widgetLink = (page, lang) =>
  page.evaluate((code) => {
    const link = document.querySelector(`a.md-select__link[hreflang="${code}"]`);
    return link ? new URL(link.href).pathname : null;
  }, lang);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  for (const walk of WALKS) {
    await page.goto(base + BASE + walk.land.slice(1), { waitUntil: "networkidle" });
    // The levels start closed, so the lab is behind its level
    await page.click(`label.md-nav__link:has-text("${walk.level}")`);
    await page.click(`a.md-nav__link:has-text("${walk.lab}")`);
    await page.waitForTimeout(800);
    const from = new URL(page.url()).pathname;
    const href = await widgetLink(page, walk.to);
    const expect = BASE.slice(0, -1) + walk.expect;
    if (href !== expect) {
      problems.push(`${from}: the ${walk.to} link says ${href}, expected ${expect}`);
      continue;
    }
    // And following it really lands there
    await page.evaluate((code) => document.querySelector(`a.md-select__link[hreflang="${code}"]`).click(), walk.to);
    await page.waitForTimeout(800);
    const landed = new URL(page.url()).pathname;
    if (landed !== expect) {
      problems.push(`${from}: clicking ${walk.to} landed on ${landed}, expected ${expect}`);
    } else {
      console.log(`  ${from} -> ${walk.to}: ${landed}`);
    }
  }

  await page.goto(base + BASE + SHARED.land.slice(1), { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const shared = await widgetLink(page, SHARED.to);
  const sharedExpect = BASE.slice(0, -1) + SHARED.expect;
  if (shared !== sharedExpect) {
    problems.push(`${SHARED.land}: the ${SHARED.to} link says ${shared}, expected ${sharedExpect} (no counterpart to jump to)`);
  } else {
    console.log(`  ${SHARED.land} -> ${SHARED.to}: ${shared} (home page, as it has no counterpart)`);
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length > 0) {
  console.error(`\n${problems.length} walk(s) that lost the page:`);
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exit(1);
}

console.log("The translate widget keeps the page, menu click or not.");
