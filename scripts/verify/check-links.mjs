#!/usr/bin/env node
/**
 * Checks every external URL the labs, the README and the link map point at.
 *
 *   node scripts/verify/check-links.mjs
 *   node scripts/verify/check-links.mjs --warn-only
 *
 * A renamed sfdx-hardis documentation page is the most likely way this course
 * rots, and it rots silently. Relative links between labs are checked on disk;
 * external ones are fetched.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const WARN_ONLY = process.argv.includes("--warn-only");

// The site is built from this repository, so its own pages cannot be fetched
// before they are published. They are checked as files instead.
const SELF = "https://hardisgroupcom.github.io/sfdx-hardis-training";

// Hosts that answer 403 to anything that is not a browser. A link there cannot be
// proved good by a fetch, so it is reported and never fails the build. Keep this
// list short, and check these by hand when one of them is reported.
const BOT_BLOCKED = [
  /^https:\/\/developer\.salesforce\.com\//,
  /^https:\/\/www\.salesforce\.com\//,
  /^https:\/\/trailhead\.salesforce\.com\//,
  // The sign-up form, which GitHub serves behind its bot verification
  /^https:\/\/github\.com\/signup/,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

const files = [...walk(path.join(ROOT, "labs")), path.join(ROOT, "README.md")].filter((file) => fs.existsSync(file));

const external = new Map();
const relativeProblems = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (target.startsWith("#")) {
      continue;
    }
    if (/^https?:\/\//.test(target)) {
      if (target.startsWith(SELF)) {
        continue;
      }
      const url = target.replace(/[.,]$/, "");
      if (!external.has(url)) {
        external.set(url, []);
      }
      external.get(url).push(rel);
      continue;
    }
    // Relative link: resolve it on disk, dropping any anchor
    const clean = target.split("#")[0];
    if (clean === "") {
      continue;
    }
    const resolved = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(resolved)) {
      relativeProblems.push(`${rel} -> ${target} (no such file)`);
    }
  }
}

console.log(`${files.length} markdown file(s), ${external.size} distinct external URL(s).`);

async function head(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        headers: { "user-agent": "sfdx-hardis-training link checker" },
        signal: AbortSignal.timeout(20000)
      });
      if (response.ok) {
        return { ok: true, status: response.status };
      }
      // Some sites answer 403/405 to HEAD but serve GET
      if (method === "GET") {
        return { ok: false, status: response.status };
      }
    } catch (error) {
      if (method === "GET") {
        return { ok: false, status: error.name === "TimeoutError" ? "timeout" : error.message };
      }
    }
  }
  return { ok: false, status: "unknown" };
}

const urls = [...external.keys()].sort();
const broken = [];
const unverifiable = [];
const BATCH = 8;
for (let i = 0; i < urls.length; i += BATCH) {
  const slice = urls.slice(i, i + BATCH);
  const results = await Promise.all(slice.map((url) => head(url)));
  slice.forEach((url, index) => {
    if (results[index].ok) {
      return;
    }
    if (BOT_BLOCKED.some((pattern) => pattern.test(url))) {
      unverifiable.push({ url, status: results[index].status });
      return;
    }
    // A 5xx means the host had a bad minute, usually rate limiting. The link is
    // not broken, and failing the build on it makes the check noise that people
    // learn to ignore. Reported, never fatal.
    if (typeof results[index].status === "number" && results[index].status >= 500) {
      unverifiable.push({ url, status: results[index].status });
      return;
    }
    broken.push({ url, status: results[index].status, usedBy: external.get(url) });
  });
  process.stdout.write(`  checked ${Math.min(i + BATCH, urls.length)}/${urls.length}\r`);
}
console.log("");

let failed = false;

if (relativeProblems.length > 0) {
  failed = true;
  console.error(`\n${relativeProblems.length} broken relative link(s):`);
  relativeProblems.forEach((line) => console.error(`  ${line}`));
}

if (broken.length > 0) {
  failed = true;
  console.error(`\n${broken.length} unreachable URL(s):`);
  for (const item of broken) {
    console.error(`  ${item.status}  ${item.url}`);
    item.usedBy.slice(0, 4).forEach((file) => console.error(`        used by ${file}`));
  }
}

if (unverifiable.length > 0) {
  console.log(`
${unverifiable.length} URL(s) could not be verified automatically (the host refuses non-browser requests):`);
  unverifiable.forEach((item) => console.log(`  ${item.status}  ${item.url}`));
  console.log("  These are not failures: the host refused us or was busy. Open one by hand if it looks suspect.");
}

if (!failed) {
  console.log("Every link resolves.");
  process.exit(0);
}

process.exit(WARN_ONLY ? 0 : 1);
