#!/usr/bin/env node
/**
 * Answers one question: is Google Analytics still counting the people who read
 * these sites?
 *
 *   node scripts/verify/check-analytics.mjs               both live sites
 *   node scripts/verify/check-analytics.mjs <url>         one site
 *   node scripts/verify/check-analytics.mjs --local       the site/ build, served
 *
 * The GA4 property dashboard is not an answer. It shows a number, and a number
 * that halved because the tag broke looks exactly like a number that halved
 * because it was August. This opens the page in a real browser and watches for
 * the request GA4 sends when it records a page view: a call to
 * .../g/collect with the measurement id in tid=.
 *
 * Two page views are checked, because the theme counts them in two different
 * places and one of them used to be missing on the product site:
 *
 *   - the page the reader lands on, counted by the gtag("config") call the
 *     theme makes when the page loads;
 *   - the next page, reached without a reload because navigation.instant swaps
 *     the body in place, counted by the theme's location$ subscription.
 *
 * A hand written gtag.js in extra_javascript that only subscribes to location$
 * passes the second check and fails the first: location$ is a plain Subject and
 * never emits for the page that is already open, so every session's first page
 * view is lost, and a reader who lands and leaves is never counted at all.
 * That is what this script exists to catch. Both sites are configured through
 * extra.analytics instead, which the theme wires to both.
 *
 * Run it by hand, not in CI. A run is a real visit: it lands on a page and
 * follows one link, and GA4 records both. A few of those a month are noise, one
 * per Pull Request is a second set of numbers nobody asked for.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const SITES = [
  { name: "course", url: "https://hardisgroupcom.github.io/sfdx-hardis-training/" },
  { name: "product documentation", url: "https://sfdx-hardis.cloudity.com/" },
];

const GOOGLE = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com/;
const COLLECT = /\/g\/collect/;
const PLACEHOLDER = "G-XXXXXXXXXX";
// Long enough for the slowest page view seen so far, which took nine seconds
const PAGE_VIEW_TIMEOUT_MS = 30000;

const args = process.argv.slice(2).filter((a) => a !== "--local");
const local = process.argv.includes("--local");

/** Serves site/ on a free port, so a local build can be checked before it ships. */
async function serveLocalBuild() {
  const dir = path.join(ROOT, "site");
  if (!fs.existsSync(dir)) {
    console.error("No site/ directory. Build it first:");
    console.error("  node scripts/build/site.mjs && python -m zensical build -f course-site.yml");
    process.exit(2);
  }
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel.endsWith("/")) rel += "index.html";
    const file = path.join(dir, rel);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    const type =
      { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(file)] ||
      "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

/**
 * Loads the page, then follows one internal link without reloading.
 *
 * Each page view is waited for rather than slept over. GA4 does not send one the moment
 * it is asked to: the page view of a page reached by an instant navigation has been seen
 * arriving nine seconds after the click on the live course site, and a fixed delay short
 * enough to be pleasant was reporting that site as counting nothing.
 */
async function inspect(browser, url) {
  const page = await browser.newPage();
  const requests = [];
  let phase = "landing";
  page.on("request", (r) => {
    if (GOOGLE.test(r.url())) requests.push({ at: phase, url: r.url() });
  });

  /** Resolves as soon as this phase has sent a page view, or after PAGE_VIEW_TIMEOUT_MS. */
  const waitForPageView = async (of) => {
    const deadline = Date.now() + PAGE_VIEW_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (requests.some((r) => r.at === of && COLLECT.test(r.url))) return;
      await page.waitForTimeout(500);
    }
  };

  await page.goto(url, { waitUntil: "networkidle" });
  await waitForPageView("landing");
  const landing = requests.filter((r) => r.at === "landing");

  phase = "navigation";
  // The marker tells a body swap from a full reload afterwards. Instant loading
  // only engages when the link's origin matches the site_url the site was built
  // with, so a build served on localhost reloads instead, and that is not a
  // failure: a reload runs the whole tag again, page view included.
  await page.evaluate(() => {
    window.__instantMarker = true;
  });
  // Only the navigation and the body of the page: a theme puts links in its header and
  // its footer that go nowhere in particular, and one of them lands on a 404 page, which
  // counts nothing and is not the tag's fault.
  const href = await page.evaluate(() => {
    const link = [...document.querySelectorAll(".md-nav a[href], .md-content a[href]")].find((a) => {
      const target = new URL(a.href, location.href);
      return target.origin === location.origin && target.pathname !== location.pathname && !target.hash;
    });
    if (link) link.click();
    return link ? link.href : null;
  });
  if (href) await waitForPageView("navigation");
  const navigation = requests.filter((r) => r.at === "navigation");
  const instant = href ? await page.evaluate(() => window.__instantMarker === true) : false;
  // A page that carries no content block is the 404 page, so there was no second page to count
  const landedOnAPage = href ? await page.evaluate(() => document.querySelector(".md-content") !== null) : false;

  await page.close();

  const ids = new Set();
  for (const r of requests) {
    const m = r.url.match(/[?&](?:id|tid)=(G-[A-Z0-9]+)/);
    if (m) ids.add(m[1]);
  }

  return {
    ids: [...ids],
    tagLoaded: requests.some((r) => /googletagmanager\.com\/gtag\/js/.test(r.url)),
    landingPageView: landing.some((r) => COLLECT.test(r.url)),
    navigationPageView: navigation.some((r) => COLLECT.test(r.url)),
    followed: href && landedOnAPage ? href : null,
    instant,
  };
}

const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ channel: "chrome", headless: true });

let served = null;
let targets = SITES;
if (local) {
  served = await serveLocalBuild();
  targets = [{ name: "local build", url: served.url }];
} else if (args.length > 0) {
  targets = args.map((url) => ({ name: url, url }));
}

let failed = false;

for (const site of targets) {
  console.log(`\n${site.name}  ${site.url}`);
  let report;
  try {
    report = await inspect(browser, site.url);
  } catch (e) {
    console.log(`  FAIL  could not load the page: ${e.message}`);
    failed = true;
    continue;
  }

  const lines = [
    ["measurement id", report.ids.length > 0 ? report.ids.join(", ") : null, "no G- id seen"],
    ["gtag.js loaded", report.tagLoaded || null, "the tag never loaded"],
    ["page view on landing", report.landingPageView || null, "the first page view of every session is lost"],
    report.followed
      ? [
          report.instant ? "page view on instant navigation" : "page view on the next page",
          report.navigationPageView || null,
          "navigating to another page counted nothing",
        ]
      : ["page view on the next page", null, "no second page to follow on this site", true],
  ];

  for (const [label, ok, problem, skipped] of lines) {
    if (ok) console.log(`  OK    ${label}: ${ok === true ? "yes" : ok}`);
    else if (skipped) console.log(`  SKIP  ${label}: ${problem}`);
    else console.log(`  FAIL  ${label}: ${problem}`);
  }

  if (report.ids.includes(PLACEHOLDER)) {
    console.log(`  FAIL  measurement id is still the ${PLACEHOLDER} placeholder`);
  }

  const broken =
    !report.tagLoaded ||
    !report.landingPageView ||
    report.ids.length === 0 ||
    report.ids.includes(PLACEHOLDER) ||
    (report.followed && !report.navigationPageView);
  if (broken) failed = true;
}

await browser.close();
if (served) served.close();

if (failed) {
  console.log("\nAnalytics is not counting everything. See the comment at the top of this file.");
  process.exit(1);
}
console.log("\nAnalytics is counting both the landing page view and the ones after it.");
