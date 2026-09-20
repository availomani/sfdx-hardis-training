#!/usr/bin/env node
/**
 * Draws numbered pills on screenshots, so a lab can say "click (2)" instead of
 * describing where a button is.
 *
 *   node scripts/build/annotate.mjs             # everything that changed
 *   node scripts/build/annotate.mjs --force     # everything
 *   node scripts/build/annotate.mjs --check     # nothing is missing or stale
 *
 * Sources stay untouched: the screenshot harness owns labs/_assets/vscode and
 * the web captures own labs/_assets/web, and both are overwritten whenever they
 * are taken again. The annotated copies are written next to them under
 * labs/_assets/annotated/, which is what the labs reference.
 *
 * The pill positions live in labs/_assets/annotations.json, in percentages of
 * the image, so re-taking a screenshot at another resolution does not move them.
 *
 * Rendering needs a browser, which CI does not have, so the annotated images are
 * committed and --check proves they match the spec. Set CDP_URL to use an
 * already-running Chrome instead of a downloaded one.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const ASSETS = path.join(ROOT, "labs", "_assets");
const SPEC = path.join(ASSETS, "annotations.json");
const OUT_ROOT = path.join(ASSETS, "annotated");
const STAMPS = path.join(OUT_ROOT, ".stamps.json");

const FORCE = process.argv.includes("--force");
const CHECK = process.argv.includes("--check");

// One colour per number, so "the 3" is findable in a busy screenshot even before
// you read the digit. Deliberately high contrast against both VS Code themes.
export const PILL_PALETTE = [
  "#e5322d", // 1 red
  "#0b72d9", // 2 blue
  "#e08800", // 3 amber
  "#128a4a", // 4 green
  "#8a37c9", // 5 purple
  "#c2185b", // 6 pink
  "#00838f", // 7 teal
  "#5d4037", // 8 brown
  "#3949ab", // 9 indigo
  "#455a64", // 10 slate
];

export function pillColor(n) {
  return PILL_PALETTE[(Number(n) - 1) % PILL_PALETTE.length];
}

// Width and height straight out of the PNG IHDR chunk, so this needs no image library
function pngSize(file) {
  const fd = fs.openSync(file, "r");
  const head = Buffer.alloc(24);
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  if (head.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`Not a PNG: ${file}`);
  }
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

// A key may carry a variant after a "#", so one screenshot can be marked up
// several times for several labs:
//   "vscode/devops-pipeline.png#new-user-story"
//     source labs/_assets/vscode/devops-pipeline.png
//     output labs/_assets/annotated/vscode/devops-pipeline--new-user-story.png
function resolveKey(key) {
  const [rel, variant] = key.split("#");
  if (!variant) {
    return { source: rel, out: rel };
  }
  const ext = path.extname(rel);
  return { source: rel, out: `${rel.slice(0, -ext.length)}--${variant}${ext}` };
}

function loadSpec() {
  const raw = JSON.parse(fs.readFileSync(SPEC, "utf8"));
  return Object.entries(raw.images || {});
}

function specHash(source, entry) {
  return crypto
    .createHash("sha1")
    .update(fs.readFileSync(source))
    .update(JSON.stringify(entry))
    .digest("hex")
    .slice(0, 16);
}

function buildHtml(dataUri, size, marks, scale) {
  const shapes = marks
    .map((mark) => {
      const color = mark.color || pillColor(mark.n);
      const pieces = [];
      if (mark.w && mark.h) {
        pieces.push(
          `<div class="box" style="left:${mark.x}%;top:${mark.y}%;width:${mark.w}%;height:${mark.h}%;border-color:${color}"></div>`
        );
      }
      // The pill sits on the corner of the box, or on the point when there is no
      // box. px/py override it, for a target too close to an edge to carry it.
      const px = mark.px === undefined ? mark.x : mark.px;
      const py = mark.py === undefined ? mark.y : mark.py;
      pieces.push(
        `<div class="pill" style="left:${px}%;top:${py}%;background:${color}">${mark.n}</div>`
      );
      return pieces.join("");
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#00000000}
    #wrap{position:relative;width:${size.width}px;height:${size.height}px;transform-origin:0 0;transform:scale(${scale})}
    #wrap img{display:block;width:${size.width}px;height:${size.height}px}
    .box{position:absolute;border:3px solid;border-radius:6px;box-sizing:border-box;
         box-shadow:0 0 0 2px rgba(255,255,255,.75),0 2px 10px rgba(0,0,0,.35)}
    .pill{position:absolute;transform:translate(-72%,-72%);
          min-width:30px;height:30px;padding:0 7px;border-radius:15px;
          display:flex;align-items:center;justify-content:center;
          font:700 18px/1 "Segoe UI",system-ui,sans-serif;color:#fff;
          border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)}
  </style></head><body><div id="wrap"><img src="${dataUri}">${shapes}</div></body></html>`;
}

async function main() {
  const entries = loadSpec();
  const stamps = fs.existsSync(STAMPS) ? JSON.parse(fs.readFileSync(STAMPS, "utf8")) : {};
  const todo = [];
  const problems = [];

  for (const [key, entry] of entries) {
    const { source: srcRel, out: outRel } = resolveKey(key);
    const source = path.join(ASSETS, srcRel);
    if (!fs.existsSync(source)) {
      problems.push(`${key}: no such screenshot`);
      continue;
    }
    const out = path.join(OUT_ROOT, outRel);
    const hash = specHash(source, entry);
    const fresh = fs.existsSync(out) && stamps[key] === hash;
    if (!fresh) {
      todo.push({ rel: key, source, out, entry, hash });
    }
  }

  if (problems.length > 0) {
    problems.forEach((p) => console.error(p));
    process.exit(1);
  }

  if (CHECK) {
    if (todo.length === 0) {
      console.log(`${entries.length} annotated screenshot(s), all current.`);
      return;
    }
    console.error(`${todo.length} annotated screenshot(s) missing or stale:`);
    todo.forEach((t) => console.error(`  ${t.rel}`));
    console.error("\nRun: node scripts/build/annotate.mjs");
    process.exit(1);
  }

  const work = FORCE
    ? entries.map(([key, entry]) => {
        const { source: srcRel, out: outRel } = resolveKey(key);
        return {
          rel: key,
          entry,
          source: path.join(ASSETS, srcRel),
          out: path.join(OUT_ROOT, outRel),
          hash: specHash(path.join(ASSETS, srcRel), entry),
        };
      })
    : todo;

  if (work.length === 0) {
    console.log(`${entries.length} annotated screenshot(s), all current.`);
    return;
  }

  // Its own headless Chrome, never the user's browser: this only renders local
  // files, so it needs no session, and an isolated instance cannot be blocked by
  // whatever the user is doing in theirs.
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const item of work) {
    const size = pngSize(item.source);
    const dataUri = `data:image/png;base64,${fs.readFileSync(item.source).toString("base64")}`;
    // A viewport taller than the screen still renders, but a very large one is
    // slow, so wide screenshots are drawn at a scale that keeps them workable
    const scale = Math.min(1, 1600 / size.width);
    const vw = Math.ceil(size.width * scale);
    const vh = Math.ceil(size.height * scale);
    await page.setViewportSize({ width: vw, height: vh });
    await page.setContent(buildHtml(dataUri, size, item.entry.pills || [], scale), {
      waitUntil: "load",
    });
    fs.mkdirSync(path.dirname(item.out), { recursive: true });
    await page.screenshot({ path: item.out, clip: { x: 0, y: 0, width: vw, height: vh } });
    stamps[item.rel] = item.hash;
    console.log(`${item.rel} (${(item.entry.pills || []).length} pill(s))`);
  }

  await page.close();
  await browser.close();

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(STAMPS, `${JSON.stringify(stamps, null, 2)}\n`);
  console.log(`\n${work.length} screenshot(s) annotated into labs/_assets/annotated/.`);
}

// Only when this file is the command being run: site.mjs imports the palette
// from here, and importing a module must not draw every pill of the course.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
