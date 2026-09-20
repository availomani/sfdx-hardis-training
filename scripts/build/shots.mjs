#!/usr/bin/env node
/**
 * Retakes only the screenshots a change needs, redraws their pills, and builds
 * one contact sheet to look at.
 *
 *   node scripts/build/shots.mjs vscode/work-new-org web/github-pr-comment
 *   node scripts/build/shots.mjs --lab 2.7            # every image Lab 2.7 shows
 *   node scripts/build/shots.mjs --lab 2.7 --dry-run  # say what would be taken
 *   node scripts/build/shots.mjs --lab 2.7 --pills    # no capture: pills and sheet only
 *   node scripts/build/shots.mjs --all --kind vscode   # every VS Code image a lab shows
 *
 * The full VS Code batch takes about twenty-five minutes. This one resolves each
 * image to the capture that produces it and runs only those:
 *
 * - VS Code panels: the extension harness, gated on the test names read from
 *   labs/_assets/vscode/.shot-gates.json (the harness writes that map at every
 *   capture). An image taken under another pipeline state, or copied under
 *   another name, is declared in labs/_assets/vscode-captures.json. The harness
 *   runs once per state, into a temp folder, and only the wanted files are
 *   copied in, so a group gate never overwrites images nobody asked for.
 * - Web pages: scripts/build/capture-web.mjs with the capture names.
 * - Salesforce screens: scripts/build/capture-salesforce.mjs with the names.
 *
 * Then scripts/build/annotate.mjs, which only redraws what changed, and a sheet
 * of the annotated results, two across, whose path is printed at the end.
 * Every image on it has to be looked at: see the training-update skill.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const ASSETS = path.join(ROOT, "labs", "_assets");
const EXTENSION = path.resolve(ROOT, "..", "vscode-sfdx-hardis");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const PILLS_ONLY = argv.includes("--pills");
const ALL = argv.includes("--all");
const kindIndex = argv.indexOf("--kind");
const KIND = kindIndex >= 0 ? argv[kindIndex + 1] : "";
const labs = [];
const wanted = new Set();
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--lab") {
    labs.push(argv[++i]);
  } else if (argv[i] === "--kind") {
    i++;
  } else if (!argv[i].startsWith("--")) {
    wanted.add(argv[i].replace(/\.png$/, ""));
  }
}
if (ALL) {
  for (const dir of fs.readdirSync(path.join(ROOT, "labs", "en"))) {
    const full = path.join(ROOT, "labs", "en", dir);
    if (!fs.statSync(full).isDirectory()) {
      continue;
    }
    for (const file of fs.readdirSync(full).filter((f) => /^\d+-\d+-.*\.md$/.test(f))) {
      labs.push(file.split("-").slice(0, 2).join("."));
    }
  }
}
if (labs.length === 0 && wanted.size === 0) {
  console.error("Usage: node scripts/build/shots.mjs [--lab N.M]... [kind/name]... [--dry-run] [--pills]");
  process.exit(2);
}

const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
const annotations = readJson(path.join(ASSETS, "annotations.json"), { images: {} }).images;
const gates = readJson(path.join(ASSETS, "vscode", ".shot-gates.json"), {});
const vscodeSpec = readJson(path.join(ASSETS, "vscode-captures.json"), { manual: [], variants: {} });
const webNames = new Set(readJson(path.join(ASSETS, "web-captures.json"), { captures: [] }).captures.map((c) => c.name));
const sfNames = new Set(readJson(path.join(ASSETS, "salesforce-captures.json"), { captures: [] }).captures.map((c) => c.name));

// ------------------------------------------------------------ what to take
function labFile(id) {
  const [level, lab] = id.split(".");
  const dir = fs.readdirSync(path.join(ROOT, "labs", "en")).find((d) => d.startsWith(`level-${level}-`));
  if (!dir) {
    throw new Error(`No level ${level} folder for lab ${id}`);
  }
  const file = fs.readdirSync(path.join(ROOT, "labs", "en", dir)).find((f) => f.startsWith(`${level}-${lab}-`));
  if (!file) {
    throw new Error(`No lab ${id} in labs/en/${dir}`);
  }
  return path.join(ROOT, "labs", "en", dir, file);
}

for (const id of labs) {
  const text = fs.readFileSync(labFile(id), "utf8");
  for (const match of text.matchAll(/_assets\/(?:annotated\/)?([a-z]+)\/([A-Za-z0-9_.-]+)\.png/g)) {
    // An annotated variant "x--variant.png" comes from the source "x.png"
    wanted.add(`${match[1]}/${match[2].replace(/--[A-Za-z0-9_-]+$/, "")}`);
  }
}

const plan = { vscode: new Map(), web: [], salesforce: [], manual: [], unknown: [] };
for (const key of [...wanted].sort()) {
  const [kind, name] = key.split("/");
  if (KIND && kind !== KIND) {
    continue;
  }
  if (kind === "vscode") {
    if ((vscodeSpec.manual || []).includes(name)) {
      plan.manual.push(key);
      continue;
    }
    const variant = (vscodeSpec.variants || {})[name];
    const recipe = variant
      ? { gate: variant.gate, file: variant.file || name, state: variant.state || "", env: variant.env || {} }
      : gates[name]
        ? { gate: gates[name].gate, file: name, state: gates[name].state || "", env: {} }
        : null;
    if (!recipe) {
      plan.unknown.push(`${key}: not in vscode/.shot-gates.json nor vscode-captures.json`);
      continue;
    }
    const runKey = JSON.stringify({ state: recipe.state, env: recipe.env });
    if (!plan.vscode.has(runKey)) {
      plan.vscode.set(runKey, { state: recipe.state, env: recipe.env, gates: new Set(), copies: [] });
    }
    const run = plan.vscode.get(runKey);
    run.gates.add(recipe.gate);
    run.copies.push({ from: recipe.file, to: name });
  } else if (kind === "web") {
    (webNames.has(name) ? plan.web : plan.unknown).push(webNames.has(name) ? name : `${key}: not in web-captures.json`);
  } else if (kind === "salesforce") {
    (sfNames.has(name) ? plan.salesforce : plan.unknown).push(sfNames.has(name) ? name : `${key}: not in salesforce-captures.json`);
  } else {
    plan.manual.push(key);
  }
}

console.log("Plan:");
for (const run of plan.vscode.values()) {
  console.log(`  vscode [${run.state || "default"}] gates: ${[...run.gates].join(",")}  files: ${run.copies.map((c) => c.to).join(",")}`);
}
if (plan.web.length) console.log(`  web: ${plan.web.join(",")}`);
if (plan.salesforce.length) console.log(`  salesforce: ${plan.salesforce.join(",")}`);
if (plan.manual.length) console.log(`  kept as is (taken by hand): ${plan.manual.join(",")}`);
plan.unknown.forEach((u) => console.log(`  UNKNOWN ${u}`));
if (DRY) {
  process.exit(plan.unknown.length ? 1 : 0);
}

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
  }
};

// ------------------------------------------------------------------ capture
if (!PILLS_ONLY) {
  if (plan.vscode.size > 0) {
    run("node", [path.join(HERE, "mocks.mjs")], { cwd: ROOT });
  }
  for (const vs of plan.vscode.values()) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "helios-shots-"));
    const env = {
      ...process.env,
      ...vs.env,
      SF_MOCK_UNIVERSE: "helios",
      SFDX_HARDIS_DOC_SCREENSHOTS_DIR: out,
    };
    if (vs.state) {
      env.SF_MOCK_PIPELINE_STATE = vs.state;
    } else {
      delete env.SF_MOCK_PIPELINE_STATE;
    }
    run("yarn", ["screenshots", [...vs.gates].join(",")], { cwd: EXTENSION, env });
    const taken = readJson(path.join(out, ".shot-gates.json"), {});
    for (const copy of vs.copies) {
      const from = path.join(out, `${copy.from}.png`);
      if (!fs.existsSync(from)) {
        throw new Error(`The harness did not write ${copy.from}.png (gates ${[...vs.gates].join(",")})`);
      }
      fs.copyFileSync(from, path.join(ASSETS, "vscode", `${copy.to}.png`));
      console.log(`vscode/${copy.to}.png`);
    }
    // Keep the map current for the default state, the one it describes
    if (!vs.state) {
      const merged = { ...gates };
      for (const [file, entry] of Object.entries(taken)) {
        // A forced capture (a panel reopened as the backdrop of a menu) reports the
        // gate that forced it: the first gate recorded for a file stays its own
        if (!merged[file]) {
          merged[file] = entry;
        }
      }
      const sorted = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
      fs.writeFileSync(path.join(ASSETS, "vscode", ".shot-gates.json"), `${JSON.stringify(sorted, null, 2)}\n`);
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  if (plan.web.length) {
    run("node", [path.join(HERE, "capture-web.mjs"), ...plan.web], { cwd: ROOT });
  }
  if (plan.salesforce.length) {
    run("node", [path.join(HERE, "capture-salesforce.mjs"), ...plan.salesforce], { cwd: ROOT });
  }
}

// ------------------------------------------------------------ pills + sheet
run("node", [path.join(HERE, "annotate.mjs")], { cwd: ROOT });

const sources = new Set([...wanted].map((k) => `${k}.png`));
const shown = [];
for (const key of Object.keys(annotations)) {
  const [rel, variant] = key.split("#");
  if (!sources.has(rel)) {
    continue;
  }
  const ext = path.extname(rel);
  shown.push({ label: key, file: path.join(ASSETS, "annotated", variant ? `${rel.slice(0, -ext.length)}--${variant}${ext}` : rel) });
}
for (const rel of sources) {
  if (!shown.some((s) => s.label.split("#")[0] === rel) && fs.existsSync(path.join(ASSETS, rel))) {
    shown.push({ label: `${rel} (no pills)`, file: path.join(ASSETS, rel) });
  }
}
if (shown.length === 0) {
  process.exit(0);
}

const { chromium } = await import("playwright-core");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
const cells = shown
  .map(
    (s) =>
      `<figure><img src="data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}"><figcaption>${s.label}</figcaption></figure>`
  )
  .join("");
await page.setContent(
  `<!doctype html><style>body{margin:8px;font:14px system-ui;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
  figure{margin:0;border:1px solid #bbb}img{width:100%;display:block}figcaption{padding:4px;background:#eee}</style>${cells}`,
  { waitUntil: "load" }
);
const sheet = path.join(os.tmpdir(), `helios-shots-${Date.now()}.png`);
await page.screenshot({ path: sheet, fullPage: true });
await browser.close();
console.log(`\n${shown.length} image(s) on the sheet: ${sheet}\nLook at every one of them before committing.`);
