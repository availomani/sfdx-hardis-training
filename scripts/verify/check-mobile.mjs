#!/usr/bin/env node
/**
 * Renders the built site at phone width and reports pages whose content is
 * wider than the screen.
 *
 *   node scripts/build/site.mjs && python -m zensical build -f course-site.yml
 *   node scripts/verify/check-mobile.mjs
 *   node scripts/verify/check-mobile.mjs --shots        also saves the PNGs
 *
 * Most of this course is read on a laptop, but the home page and the level
 * indexes get shared, and they are the ones carrying five column tables. A
 * table that squeezes to one word per column is unreadable and nothing else
 * catches it: the markdown is valid, the links resolve, the assets are there.
 *
 * A table is allowed to be wider than the screen as long as it lives in a
 * scroller. What is not allowed is the page itself scrolling sideways.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SITE = path.join(ROOT, "site");
const SHOTS = process.argv.includes("--shots");
const OUT = path.join(ROOT, "site", "_mobile-check");

// The pages most likely to be opened on a phone, and the widest tables
const PAGES = [
  "index.html",
  "en/level-1-contributor-basics/index.html",
  "en/level-2-contributor-advanced/index.html",
  "en/level-3-release-manager/index.html",
  "BACKLOG/index.html",
];

const PHONE = { width: 412, height: 915 };

if (!fs.existsSync(SITE)) {
  console.error("No site/ directory. Build it first:");
  console.error("  node scripts/build/site.mjs && python -m zensical build -f course-site.yml");
  process.exit(2);
}

const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: PHONE, deviceScaleFactor: 2 });

if (SHOTS) {
  fs.mkdirSync(OUT, { recursive: true });
}

const problems = [];

for (const rel of PAGES) {
  const file = path.join(SITE, rel);
  if (!fs.existsSync(file)) {
    problems.push(`${rel} was not built`);
    continue;
  }
  await page.goto(`file://${file.replace(/\\/g, "/")}`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  const report = await page.evaluate((viewportWidth) => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - viewportWidth;

    // The narrowest column of any table, as actually laid out. A column under
    // about 40px is the one-word-per-line failure.
    let narrowest = Infinity;
    let worstTable = null;
    for (const table of document.querySelectorAll(".md-typeset table")) {
      const cells = table.querySelectorAll("tr:first-child th, tr:first-child td");
      for (const cell of cells) {
        const width = cell.getBoundingClientRect().width;
        if (width > 0 && width < narrowest) {
          narrowest = width;
          worstTable = (table.querySelector("th") || {}).innerText || "(unnamed)";
        }
      }
    }
    return {
      overflow,
      narrowest: narrowest === Infinity ? null : Math.round(narrowest),
      worstTable,
    };
  }, PHONE.width);

  const notes = [];
  if (report.overflow > 1) {
    notes.push(`page scrolls sideways by ${report.overflow}px`);
  }
  if (report.narrowest !== null && report.narrowest < 56) {
    notes.push(`narrowest table column is ${report.narrowest}px (table "${report.worstTable}")`);
  }

  if (notes.length > 0) {
    problems.push(`${rel}: ${notes.join("; ")}`);
    console.log(`FAIL ${rel}  ${notes.join("; ")}`);
  } else {
    console.log(`OK   ${rel}  narrowest column ${report.narrowest ?? "n/a"}px`);
  }

  if (SHOTS) {
    const name = rel.replace(/[\\/]/g, "_").replace(/\.html$/, ".png");
    await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  }
}

await page.close();
await browser.close();

if (SHOTS) {
  console.log(`\nScreenshots in ${path.relative(ROOT, OUT)}`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} page(s) that do not read on a phone:`);
  problems.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}

console.log(`\n${PAGES.length} page(s) read at ${PHONE.width}px.`);
