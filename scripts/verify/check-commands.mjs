#!/usr/bin/env node
/**
 * Checks that every sfdx-hardis command a lab relies on still exists.
 *
 *   node scripts/verify/check-commands.mjs
 *
 * The commands come from the depends_on front matter of the labs, collected into
 * training-manifest.json. A command renamed upstream breaks a lab silently: the
 * text still reads fine and the click does nothing useful. This is the backstop.
 *
 * Requires the Salesforce CLI with the sfdx-hardis plugin installed.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const manifestPath = path.join(ROOT, "training-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("training-manifest.json is missing. Run: node scripts/build/universe.mjs");
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const wanted = new Map();
for (const lab of manifest.labs) {
  for (const command of lab.commands || []) {
    if (!wanted.has(command)) {
      wanted.set(command, []);
    }
    wanted.get(command).push(lab.id);
  }
}

if (wanted.size === 0) {
  console.log("No lab declares a command. Nothing to check.");
  process.exit(0);
}

const listing = spawnSync("sf", ["commands", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 64 * 1024 * 1024
});

const listingOutput = `${listing.stdout || ""}${listing.stderr || ""}`;
if (listing.status !== 0 || /ReferenceError/.test(listingOutput)) {
  console.error("Could not list the Salesforce CLI commands.");
  console.error(listingOutput.slice(0, 1500));
  if (/is not defined/.test(listingOutput)) {
    console.error("");
    console.error("A command description containing a ${...} makes oclif evaluate it while reading");
    console.error("its own manifest, which breaks `sf commands` for everybody. sfdx-hardis 8.7.1");
    console.error("shipped one. Upgrade the plugin: sf plugins install sfdx-hardis@latest");
  }
  process.exit(2);
}

let available;
try {
  const parsed = JSON.parse(listing.stdout);
  const rows = Array.isArray(parsed) ? parsed : parsed.result || [];
  available = new Set(rows.map((row) => String(row.id || "").replace(/\s+/g, ":")));
} catch (error) {
  console.error(`Could not read the command list: ${error.message}`);
  process.exit(2);
}

const missing = [];
for (const [command, labs] of [...wanted].sort()) {
  // sf lists commands with spaces or colons depending on the version
  const normalized = command.replace(/\s+/g, ":");
  if (available.has(normalized) || available.has(normalized.replace(/:/g, " "))) {
    continue;
  }
  missing.push({ command, labs });
}

console.log(`${wanted.size} command(s) declared by the labs, ${available.size} available in the CLI.`);

if (missing.length === 0) {
  console.log("Every command a lab relies on still exists.");
  process.exit(0);
}

console.error(`\n${missing.length} command(s) no longer exist:`);
for (const item of missing) {
  console.error(`  ${item.command}`);
  console.error(`      used by ${item.labs.join(", ")}`);
}
console.error("\nEither the command was renamed upstream, or the lab front matter has a typo.");
process.exit(1);
