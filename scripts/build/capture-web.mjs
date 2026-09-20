#!/usr/bin/env node
/**
 * Takes the screenshots of the web pages a learner has to visit: the installers,
 * the fork button, the signup form, the Pull Request.
 *
 *   node scripts/build/capture-web.mjs               # all of them
 *   node scripts/build/capture-web.mjs github-fork   # only these
 *
 * It drives an already-running Chrome over CDP (start Chrome with
 * --remote-debugging-port=9222), because several of these pages only look right
 * when you are signed in. Output goes to labs/_assets/web/, and the pills are
 * added afterwards by scripts/build/annotate.mjs.
 *
 * These are captured by hand and committed: nothing in CI can reach a signed-in
 * GitHub page, and a learner's first screen must not depend on a live fetch.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(ROOT, "labs", "_assets", "web");

const TARGETS = JSON.parse(
  fs.readFileSync(path.join(ROOT, "labs", "_assets", "web-captures.json"), "utf8")
).captures;

const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function main() {
  const { chromium } = await import("playwright-core");
  // The signed-in browser is only reached when a capture needs it: a batch of
  // "fresh" captures runs without one
  let page = null;
  const signedInPage = async () => {
    if (!page) {
      const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://127.0.0.1:9222");
      page = await browser.contexts()[0].newPage();
    }
    return page;
  };
  fs.mkdirSync(OUT, { recursive: true });

  // A capture marked "fresh" needs a signed-out visitor, which the signed-in
  // browser cannot provide. It gets its own Chrome profile in a temp folder, in
  // English, and never touches the user's session. Headless is not an option:
  // salesforce.com answers Access Denied to it.
  let freshContext = null;
  const freshPage = async () => {
    if (!freshContext) {
      freshContext = await chromium.launchPersistentContext(
        path.join(os.tmpdir(), "sfdx-hardis-training-captures"),
        { channel: "chrome", headless: false, locale: "en-US", viewport: { width: 1440, height: 900 } }
      );
    }
    return freshContext.newPage();
  };

  for (const target of TARGETS) {
    if (wanted.length > 0 && !wanted.includes(target.name)) {
      continue;
    }
    const width = target.width || 1440;
    const height = target.height || 900;
    const view = target.fresh ? await freshPage() : await signedInPage();
    await view.setViewportSize({ width, height });
    await view.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await view.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

    for (const selector of target.hide || []) {
      await view
        .evaluate((sel) => {
          document.querySelectorAll(sel).forEach((el) => {
            el.style.display = "none";
          });
        }, selector)
        .catch(() => {});
    }
    // Blocks keyed on their wording, because the class names on these sites are
    // build hashes that change under us. Of the elements carrying the text, the
    // biggest one still under the cap is the block itself rather than a leaf
    // inside it.
    for (const entry of target.hideText || []) {
      const needle = typeof entry === "string" ? { text: entry } : entry;
      await view
        .evaluate(({ text, max }) => {
          const cap = max || 700;
          let best = null;
          for (const el of document.querySelectorAll("div,section,aside,header,figure,p,pre")) {
            const content = el.innerText || "";
            if (!content.includes(text) || content.length > cap) {
              continue;
            }
            if (!best || content.length > (best.innerText || "").length) {
              best = el;
            }
          }
          if (best) {
            best.style.display = "none";
          }
        }, needle)
        .catch(() => {});
    }
    // Clicks that open what the fill then types into, such as a dialog
    for (const selector of target.clickFirst || []) {
      await view.locator(selector).first().click({ timeout: 5000 }).catch(() => {});
      await view.waitForTimeout(800);
    }
    // For controls no selector names reliably: a function body run in the page
    for (const script of target.evaluate || []) {
      await view.evaluate(script).catch(() => {});
      await view.waitForTimeout(1000);
    }
    for (const [selector, value] of target.fill || []) {
      await view.locator(selector).first().fill(value, { timeout: 5000 }).catch(() => {});
    }
    for (const selector of target.click || []) {
      await view.locator(selector).first().click({ timeout: 5000 }).catch(() => {});
    }
    if (target.scrollTo) {
      await view.locator(target.scrollTo).first().scrollIntoViewIfNeeded().catch(() => {});
    }
    await view.waitForTimeout(target.settle || 1200);

    const file = path.join(OUT, `${target.name}.png`);
    const options = { path: file };
    if (target.clipAround) {
      // A crop around an element that lives outside the layout, such as a menu:
      // its box, widened by the padding so its context shows
      const box = await view.locator(target.clipAround.selector).first().boundingBox();
      const pad = target.clipAround.padding || {};
      if (box) {
        const x = Math.max(0, box.x - (pad.left || 0));
        const y = Math.max(0, box.y - (pad.top || 0));
        options.clip = { x, y, width: box.width + (pad.left || 0) + (pad.right || 0), height: box.height + (pad.top || 0) + (pad.bottom || 0) };
      }
      await view.screenshot(options);
    } else if (target.selector && target.maxHeight) {
      // The top of a tall element only: scrolled to the top of the window, then clipped
      const element = view.locator(target.selector).first();
      await element.evaluate((node) => node.scrollIntoView({ block: "start" }));
      await view.waitForTimeout(800);
      const box = await element.boundingBox();
      if (!box) {
        // A selector that matches something not rendered: say which capture,
        // and keep the rest of the batch
        throw new Error(`${target.name}: "${target.selector}" matches nothing visible on the page`);
      }
      options.clip = { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, target.maxHeight) };
      await view.screenshot(options);
    } else if (target.selector) {
      await view.locator(target.selector).first().screenshot(options);
    } else {
      if (target.clip) {
        options.clip = target.clip;
      }
      await view.screenshot(options);
    }
    console.log(`${target.name}.png  ${target.url}`);
  }

  // Only the tab this script opened. Never browser.close() on a CDP connection:
  // it closes the whole browser it is attached to, which is the user's own.
  if (page) {
    await page.close();
  }
  if (freshContext) {
    await freshContext.close();
  }
}

main()
  .then(() => {
    // The CDP connection keeps the event loop alive, and closing it would close
    // the user's browser. Nothing is left to wait for, so say so and leave.
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
