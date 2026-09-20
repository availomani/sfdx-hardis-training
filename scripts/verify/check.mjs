#!/usr/bin/env node
/**
 * Checks one lab, or a whole level, against your own clone, and prints the
 * receipt line to keep for your badge claim.
 *
 *   node scripts/verify/check.mjs --level 1 --lab 4      (Lab 1.4)
 *   node scripts/verify/check.mjs --level 1
 *
 * Usually you click Welcome page > Training: Level N > Check my work instead.
 */
import { pathToFileURL } from "url";
import { ROOT, c, title, info, ok, fail, warn, parseArgs, githubHandle, gitOut, recordReceipt, runJson } from "../lib/util.mjs";
import { makeContext, rulesForLevel, findRule } from "./rules.mjs";

export function receiptLine(rule, handle, commit) {
  const stamp = new Date().toISOString().slice(0, 16) + "Z";
  return `LAB ${rule.id} OK  handle=${handle || "unknown"}  commit=${commit}  ${stamp}`;
}

/**
 * Runs each rule. With { now: true }, a rule that has a now() check runs that one
 * instead: what is true right after the lab, rather than at the end of the level.
 */
export function runRules(ctx, rules, { now = false } = {}) {
  return rules.map((rule) => {
    let result;
    try {
      result = now && rule.now ? rule.now(ctx) : rule.check(ctx);
    } catch (error) {
      result = { ok: false, detail: `the check itself failed: ${error.message}`, where: "scripts/verify/rules.mjs" };
    }
    return { rule, ...result };
  });
}

export function printResults(results, handle, commit, { record = false } = {}) {
  let passed = 0;
  for (const r of results) {
    const label = `Lab ${r.rule.id}  ${r.rule.title}`;
    if (r.ok) {
      passed++;
      ok(label);
      if (r.detail) {
        info(c.dim(`      ${r.detail}`));
      }
      if (record) {
        const line = receiptLine(r.rule, handle, commit);
        console.log(c.green(`      ${line}`));
        recordReceipt({ id: r.rule.id, line, at: new Date().toISOString() });
      }
    } else {
      fail(label);
      info(c.yellow(`      What is missing: ${r.detail}`));
      if (r.where) {
        info(c.dim(`      Where it was looked for: ${r.where}`));
      }
    }
  }
  return passed;
}

/** Records returned by a SOQL query on an org, or null when the org could not be read. */
export function sfQuery(alias, soql, { tooling = false } = {}) {
  const res = runJson(
    "sf",
    ["data", "query", "--target-org", alias, "--query", soql, "--json", ...(tooling ? ["--use-tooling-api"] : [])],
    { quiet: true }
  );
  return Array.isArray(res?.result?.records) ? res.result.records : null;
}

export default async function main(args) {
  const level = Number.parseInt(args.level, 10);
  if (!Number.isInteger(level) || level < 1 || level > 3) {
    fail("Pass a level: --level 1, --level 2 or --level 3");
    process.exit(1);
  }
  // A lab is named N.M everywhere a learner sees it, and "--lab 1.4" works as well as "--lab 4"
  const lab = args.lab === undefined ? null : Number.parseInt(String(args.lab).split(".").pop(), 10);

  const ctx = makeContext(args.dir || ROOT, { local: true, sfQuery });
  // The clone being checked, which is not this script's own repository with --dir
  const origin = args.dir ? ctx.git(["remote", "get-url", "origin"]).match(/github\.com[/:]([^/]+)\//i) : null;
  const handle = args.dir ? origin?.[1] || null : githubHandle();
  const commit = (args.dir ? ctx.git(["rev-parse", "--short", "HEAD"]) : gitOut(["rev-parse", "--short", "HEAD"])) || "unknown";

  let rules;
  if (lab === null) {
    rules = rulesForLevel(level);
    title(`Checking the whole of level ${level}`);
  } else {
    const rule = findRule(level, lab);
    if (!rule) {
      fail(`There is no Lab ${level}.${lab}.`);
      process.exit(1);
    }
    rules = [rule];
    title(`Checking Lab ${level}.${lab}`);
  }

  // One lab: what that lab leaves behind right after it. The whole level: what
  // the badge claim checks, the same rules the audit runs on your fork.
  const results = runRules(ctx, rules, { now: lab !== null });
  const passed = printResults(results, handle, commit, { record: true });

  console.log("");
  if (passed === results.length) {
    ok(`${passed} of ${results.length} checks passed.`);
    if (lab === null) {
      info("");
      info(`  You can claim your level ${level} badge now:`);
      info(`  Welcome page > ${c.bold(`Training: Level ${level}`)} > ${c.bold("Claim my badge")}.`);
    }
  } else {
    warn(`${passed} of ${results.length} checks passed. Read what is missing above, fix it, and run this again.`);
    process.exitCode = 1;
  }
}

// Allow both "node scripts/verify/check.mjs --level 1" and an import from training.mjs.
// A Windows file URL carries three slashes and a drive letter, so comparing the strings
// by hand never matches and the script silently does nothing at all.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(parseArgs(process.argv.slice(2)));
}
