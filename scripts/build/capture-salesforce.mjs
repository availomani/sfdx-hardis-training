#!/usr/bin/env node
/**
 * Takes the screenshots of the Salesforce screens a learner has to click through:
 * the Object Manager, the new field wizard, a permission set, a record page.
 *
 *   node scripts/build/capture-salesforce.mjs                    # all of them
 *   node scripts/build/capture-salesforce.mjs new-field-type     # only these
 *   node scripts/build/capture-salesforce.mjs --org helios-dev   # another org
 *   node scripts/build/capture-salesforce.mjs --full             # ignore the clips
 *
 * It opens one session with `sf org open --url-only`, whose URL is single use, so
 * it is fetched once per run and not once per shot. From there it drives an
 * already-running Chrome over CDP (start Chrome with --remote-debugging-port=9222
 * and its own --user-data-dir), the same way scripts/build/capture-web.mjs does.
 * Output goes to labs/_assets/salesforce/, and the pills are added afterwards by
 * scripts/build/annotate.mjs.
 *
 * NOTHING IS EVER SAVED. The wizard captures walk forward through the steps and
 * then leave by navigating away: no Save, no Next past the last screen wanted, no
 * record, field, permission set or rule created, edited or deleted. A capture
 * that cannot be reached without saving is not taken.
 *
 * The org must show Setup in English, because the labs are in English. That is a
 * property of the user, not of the URL: Salesforce ignores ?language= for a
 * logged-in user. `sf data query -q "SELECT Username, LanguageLocaleKey FROM User"`
 * says which org qualifies.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "labs", "_assets", "salesforce");

const SPEC = JSON.parse(
  fs.readFileSync(path.join(ROOT, "labs", "_assets", "salesforce-captures.json"), "utf8")
);

const args = process.argv.slice(2);
const FULL = args.includes("--full");
const orgFlag = args.indexOf("--org");
const ORG = orgFlag === -1 ? SPEC.org : args[orgFlag + 1];
const wanted = args.filter((a, i) => !a.startsWith("--") && !(orgFlag !== -1 && i === orgFlag + 1));

// sf is a shell wrapper on Windows, so it is called through a shell. SOQL quotes
// its own literals with ' and the arguments are wrapped in ", so they never meet.
function sf(sfArgs) {
  const line = ["sf", ...sfArgs.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" ");
  const out = execSync(line, { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(out);
}

// Record and permission set ids differ from one org to the next, so the paths
// carry {{name}} placeholders and the queries that fill them live in the spec.
function resolveLookups() {
  const values = {};
  for (const [key, soql] of Object.entries(SPEC.lookups || {})) {
    const result = sf(["data", "query", "--target-org", ORG, "--query", soql, "--json"]);
    const record = (result.result.records || [])[0];
    if (!record) {
      throw new Error(`Lookup ${key} returned nothing: ${soql}`);
    }
    // The Id, or the first field the query selects when it selects no Id, such as
    // the ActiveVersionId of a FlowDefinitionView
    values[key] = record.Id || record[Object.keys(record).find((field) => field !== "attributes")];
  }
  return values;
}

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (values[key] === undefined) {
      throw new Error(`No value for {{${key}}}`);
    }
    return values[key];
  });
}

// Setup embeds its older pages in an iframe, and the newer ones are drawn in the
// page itself. A capture says which one it wants; everything else is the same.
function scope(page, target) {
  if (!target.frame) {
    return { locator: (sel) => page.locator(sel), root: page };
  }
  const frame = page.frameLocator(target.frame);
  return { locator: (sel) => frame.locator(sel), root: frame };
}

// Salesforce docks promotion panels ("Get Mobile") over the bottom right of
// Setup, on top of whatever the capture is about.
const NOISE = [".forceDockingPanel", "div.desktopPromoPanel", "one-appnav-overflow-menu"];

// Admin nags that open over Setup on their own. They are taken off the page, not
// clicked: "Remind me in 1 week" and "Save" both write something in the org.
const NAGS = [
  "Assign Org Responsibilities",
  "Get the most out of Salesforce",
  "Take Salesforce with you",
];

async function dismissNags(page) {
  await page
    .evaluate((phrases) => {
      let removed = 0;
      for (const dialog of document.querySelectorAll("[role='dialog'], .slds-modal")) {
        const text = dialog.innerText || "";
        if (phrases.some((phrase) => text.includes(phrase))) {
          dialog.remove();
          removed += 1;
        }
      }
      if (removed > 0) {
        document
          .querySelectorAll(".slds-backdrop, .modal-glass, .forceModalBackdrop")
          .forEach((el) => el.remove());
      }
    }, NAGS)
    .catch(() => {});
}

async function main() {
  const values = resolveLookups();
  const login = sf(["org", "open", "--target-org", ORG, "--url-only", "--json"]).result;
  const origin = new URL(login.url).origin;

  const { chromium } = await import("playwright-core");
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://127.0.0.1:9222");
  const page = await browser.contexts()[0].newPage();
  fs.mkdirSync(OUT, { recursive: true });

  // One navigation to the single use URL opens the session; every capture below
  // then walks to its own path inside it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(login.url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(6000);

  for (const target of SPEC.captures) {
    const named = wanted.includes(target.name);
    if (wanted.length > 0 && !named) {
      continue;
    }
    // A capture the org will not serve stays in the spec with its reason, so the
    // next person knows what is missing and what it would take. Naming it on the
    // command line tries it anyway.
    if (target.skip && !named) {
      console.log(`${target.name}.png  SKIPPED: ${target.skip}`);
      continue;
    }
    await page.setViewportSize({ width: target.width || 1440, height: target.height || 900 });

    // A capture with no path continues from the page the previous one left,
    // which is how the steps of a wizard are reached without walking it again.
    if (target.path) {
      await page.goto(`${origin}${fill(target.path, values)}`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForTimeout(target.load || 7000);
    }
    await dismissNags(page);

    const view = scope(page, target);
    if (target.waitFor) {
      await view.locator(target.waitFor).first().waitFor({ state: "visible", timeout: 60000 });
    }
    for (const [selector, value] of target.fill || []) {
      await view.locator(selector).first().fill(value, { timeout: 15000 });
    }
    for (const selector of target.click || []) {
      await view.locator(selector).first().click({ timeout: 20000 });
      await page.waitForTimeout(target.between || 2500);
    }
    // Canvas elements with no stable selector, such as the + of a Flow Builder
    // connector: window pixels, for the viewport the capture declares
    for (const [x, y] of target.mouse || []) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(target.between || 2500);
    }
    if (target.after) {
      await view.locator(target.after).first().waitFor({ state: "visible", timeout: 60000 });
    }
    if (target.scrollTo) {
      await view.locator(target.scrollTo).first().scrollIntoViewIfNeeded().catch(() => {});
    }

    for (const selector of [...NOISE, ...(target.hide || [])]) {
      await page
        .evaluate((sel) => {
          document.querySelectorAll(sel).forEach((el) => {
            el.style.display = "none";
          });
          document.querySelectorAll("iframe").forEach((frame) => {
            try {
              frame.contentDocument.querySelectorAll(sel).forEach((el) => {
                el.style.display = "none";
              });
            } catch {
              /* a cross origin frame is not ours to clean */
            }
          });
        }, selector)
        .catch(() => {});
    }
    await page.waitForTimeout(target.settle || 1500);

    const file = path.join(OUT, `${target.name}.png`);
    if (target.selector) {
      await view.locator(target.selector).first().screenshot({ path: file });
    } else {
      const options = { path: file };
      if (target.clip && !FULL) {
        options.clip = target.clip;
      }
      await page.screenshot(options);
    }
    console.log(`${target.name}.png  ${target.path || "(same page)"}`);
  }

  // Only the tab this script opened. Never browser.close(): over CDP that closes
  // the Chrome the user is working in. The CDP socket keeps node alive, so the
  // process says so itself once the tab is gone.
  await page.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // A navigation failure carries the url it was opening, and the frontdoor
    // url this script uses has the org's access token in its sid parameter.
    // That message would otherwise land in a terminal, a log, or an issue.
    const reason = String(error.message || error).replace(/sid=[^&\s'"]+/g, "sid=[redacted]");
    console.error(reason);
    process.exit(1);
  });
