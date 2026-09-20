#!/usr/bin/env node
/**
 * Opens built lab pages in a browser of its own and checks where they land.
 *
 * A page opened with no hash must show its title, not its comments. The theme
 * swaps pages without reloading and the course adds scripts of its own, so this
 * is the kind of thing that breaks quietly and that nobody notices in a diff.
 *
 *   node scripts/verify/check-scroll.mjs
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

/** The pages worth checking: one lab per level, plus a level index. */
const PAGES = [
  "/en/level-1-contributor-basics/1-2-create-your-dev-hub-scratch-orgs-and-pipeline/",
  "/en/level-2-contributor-advanced/2-7-resolve-a-git-merge-conflict/",
  "/en/level-3-release-manager/3-7-hotfix-and-retrofit/",
  "/en/level-3-release-manager/",
];

/** And one with a hash, which must land on the heading rather than the top. */
const WITH_HASH = {
  url: "/en/level-1-contributor-basics/1-5-retrieve-commit-and-publish-your-changes/#6-read-the-package-before-you-push",
  anchor: "6-read-the-package-before-you-push",
};

if (!fs.existsSync(SITE)) {
  console.error("No built site. Run: python -m zensical build -f course-site.yml");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(SITE, url);
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
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});
const problems = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const target of PAGES) {
    await page.goto(base + target, { waitUntil: "networkidle" });
    // Give anything that scrolls late, a comment widget for one, time to do it
    await page.waitForTimeout(2500);
    const y = await page.evaluate(() => window.scrollY);
    const label = target.replace(/\/$/, "").split("/").pop();
    if (y > 8) {
      problems.push(`${label}: opened at ${Math.round(y)}px instead of the top`);
    } else {
      console.log(`  ${label}: top (${Math.round(y)}px)`);
    }
  }

  // The comments must not LOAD until the reader scrolls near them. giscus puts
  // the frame in the page either way, so what is checked is the attribute that
  // defers its content: a cross-origin frame at the bottom of a long page that
  // renders a comment box and takes focus takes the scroll position with it,
  // and the lab then opens at its comments instead of its title.
  await page.goto(base + PAGES[0], { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const frame = await page.evaluate(() => {
    const el = document.querySelector("iframe.giscus-frame");
    return el ? el.getAttribute("loading") : "no frame";
  });
  if (frame !== "lazy") {
    problems.push(
      `the comments frame is not deferred (loading=${frame}): remove data-loading="lazy" and a signed-in reader lands on the comments`,
    );
  } else {
    console.log("  comments: deferred until scrolled to");
  }

  await page.goto(base + WITH_HASH.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const onAnchor = await page.evaluate((id) => {
    const heading = document.getElementById(id);
    if (!heading) {
      return { found: false, delta: 0, y: window.scrollY };
    }
    return {
      found: true,
      delta: Math.abs(heading.getBoundingClientRect().top),
      y: window.scrollY,
    };
  }, WITH_HASH.anchor);
  if (!onAnchor.found) {
    problems.push(`the anchor #${WITH_HASH.anchor} is not on the page`);
  } else if (onAnchor.y < 100 || onAnchor.delta > 160) {
    problems.push(
      `a url with #${WITH_HASH.anchor} landed at ${Math.round(onAnchor.y)}px, ${Math.round(onAnchor.delta)}px off the heading`,
    );
  } else {
    console.log(`  with a hash: on the heading (${Math.round(onAnchor.y)}px)`);
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log("\nEvery page opens where it should.");
