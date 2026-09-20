#!/usr/bin/env node
/**
 * Re-verifies a learner's public repository, from this repository's own rules.
 *
 *   node scripts/verify/audit.mjs --level 2 --dir /tmp/clone --handle jdupont
 *
 * Run by .github/workflows/claim.yml. Five rules govern it, and they are
 * repeated at the top of that workflow because they are what keeps it safe:
 *
 *  1. Never execute anything from the clone. No install, no build, no script of
 *     theirs. This only reads files and git history, with code from here.
 *  2. Never expose a Salesforce secret to it. It has no business touching an org.
 *  3. Treat every input as hostile: validate, never interpolate into a shell.
 *  4. Bound the clone: depth, blob filter, size, timeout.
 *  5. A level claim re-runs the audits of the levels it requires.
 *
 * Output: a markdown report on stdout, and a JSON summary when --json is passed.
 * Exit code 0 when the claim passes, 1 when it does not.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { makeContext, rulesForLevel } from "./rules.mjs";
import { parseArgs } from "../lib/util.mjs";

const LEVEL_NAMES = {
  1: "sfdx-hardis Contributor Basics",
  2: "sfdx-hardis Contributor Advanced",
  3: "sfdx-hardis Release Manager"
};

/** A level claim also proves the levels it requires. */
export function levelsToAudit(level) {
  return Array.from({ length: level }, (_, i) => i + 1);
}

/**
 * Whether every auditable rule of a level already passes, which is how the
 * audit knows a learner has gone past the level they are claiming.
 */
function levelIsComplete(ctx, level) {
  const rules = rulesForLevel(level).filter((rule) => rule.auditable !== false);
  if (rules.length === 0) {
    return false;
  }
  return rules.every((rule) => {
    try {
      return rule.check(ctx).ok === true;
    } catch {
      return false;
    }
  });
}

/**
 * Whether the learner's integration branch descends from a published start
 * state, which is what "Reset this level" leaves behind.
 *
 * The start state of a level carries everything the levels below it produced,
 * so resetting to the Level 3 one hands a learner the finished work of Levels 1
 * and 2 without their having opened a lab. A learner who did the work has their
 * own history instead, and that branch is not in it.
 */
function satOnStartState(ctx, level) {
  const start = `training/start-level-${level}`;
  if (!ctx.hasBranch(start)) {
    return false;
  }
  const tip = ctx.git(["rev-parse", `origin/${start}`]) || ctx.git(["rev-parse", start]);
  const base = ctx.git(["merge-base", tip, "origin/integration"]);
  return tip !== "" && base === tip;
}

/**
 * The reasons a claim is refused before its rules are even read.
 *
 * Both are about the same thing: a badge says the learner did that level, and
 * the rules alone cannot tell work from a reset, because a reset produces the
 * same files. Neither is a dead end. A learner who has gone further claims the
 * level they reached, and that claim re-runs this one's audit anyway.
 */
export function claimObjections(ctx, level) {
  const objections = [];
  const above = level + 1;
  if (above <= 3) {
    if (levelIsComplete(ctx, above)) {
      objections.push(
        `Level ${above} is already finished in this repository, so this claim cannot tell whether Level ${level} was worked through or arrived with it. Claim Level ${above} instead: that claim re-runs the Level ${level} audit and awards both.`
      );
    }
    if (satOnStartState(ctx, above)) {
      objections.push(
        `The integration branch descends from ${"`"}training/start-level-${above}${"`"}, the state "Reset this level" writes for Level ${above}. That branch already carries the finished work of every level below it, so it cannot stand as evidence of Level ${level}.`
      );
    }
  }
  return objections;
}

export function auditRepository(dir, level) {
  const ctx = makeContext(dir);
  const objections = claimObjections(ctx, level);
  if (objections.length > 0) {
    return { results: [], passed: 0, total: 0, ok: false, objections };
  }
  const results = [];
  for (const each of levelsToAudit(level)) {
    for (const rule of rulesForLevel(each)) {
      if (rule.auditable === false) {
        continue;
      }
      let outcome;
      try {
        outcome = rule.check(ctx);
      } catch (error) {
        outcome = {
          ok: false,
          detail: `the check could not run: ${error.message}`,
          where: "scripts/verify/rules.mjs in the training repository"
        };
      }
      results.push({ level: each, rule, ...outcome });
    }
  }
  const passed = results.filter((r) => r.ok).length;
  return { results, passed, total: results.length, ok: passed === results.length, objections: [] };
}

export function renderReport(audit, { level, handle, repoUrl }) {
  const lines = [];
  // A run by hand on a local clone has no address to link to
  const against = repoUrl ? ` against [${repoUrl}](${repoUrl})` : "";
  if (audit.ok) {
    lines.push(`## Level ${level} verified`);
    lines.push("");
    lines.push(`All ${audit.total} checks passed${against}.`);
    lines.push("");
    lines.push(`**${LEVEL_NAMES[level]}** is awarded to \`${handle}\`.`);
    lines.push("");
    if (level > 1) {
      lines.push(
        `This claim also re-ran the level ${levelsToAudit(level - 1).join(" and ")} audits, which is how the prerequisite is enforced.`
      );
      lines.push("");
    }
  } else if ((audit.objections || []).length > 0) {
    lines.push(`## Level ${level} cannot be claimed from this repository`);
    lines.push("");
    lines.push(
      "The checks were not run. A badge says you worked a level through, and what is in this repository cannot be told apart from a reset:"
    );
    lines.push("");
    for (const objection of audit.objections) {
      lines.push(`- ${objection}`);
    }
    lines.push("");
    lines.push(
      "If you believe this is wrong, open an issue saying what you did and it will be looked at."
    );
    lines.push("");
  } else {
    const failed = audit.results.filter((r) => !r.ok);
    lines.push(`## Level ${level} did not verify yet`);
    lines.push("");
    lines.push(`${audit.passed} of ${audit.total} checks passed${against}.`);
    lines.push("");
    lines.push(`### What is missing (${failed.length})`);
    lines.push("");
    for (const item of failed) {
      lines.push(`**Lab ${item.rule.id}** - ${item.rule.title}`);
      lines.push("");
      lines.push(`- What was looked for: ${item.detail}`);
      if (item.where) {
        lines.push(`- Where: ${item.where}`);
      }
      lines.push("");
    }
    lines.push("Fix what is listed above, push it to your fork, then **edit this issue** (any change");
    lines.push("to the body re-runs the audit). You do not need to open a new one.");
    lines.push("");
  }

  lines.push("<details><summary>Every check, in order</summary>");
  lines.push("");
  lines.push("| Level | Lab | Check | Result |");
  lines.push("|---|---|---|---|");
  for (const item of audit.results) {
    lines.push(`| ${item.level} | ${item.rule.id} | ${item.rule.title} | ${item.ok ? "pass" : "**fail**"} |`);
  }
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push("_This audit ran automatically. Nobody reviews claims by hand: if you think a check is");
  lines.push("wrong, open an issue saying which one and why, and it will be fixed for everybody._");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const level = Number.parseInt(args.level, 10);
  const dir = args.dir;
  if (!Number.isInteger(level) || level < 1 || level > 3 || !dir) {
    console.error("Usage: node scripts/verify/audit.mjs --level <1|2|3> --dir <clone> [--handle h] [--json out.json]");
    process.exit(2);
  }
  if (!fs.existsSync(path.join(dir, ".git"))) {
    console.error(`${dir} is not a git clone.`);
    process.exit(2);
  }

  const audit = auditRepository(dir, level);
  const report = renderReport(audit, {
    level,
    handle: args.handle || "unknown",
    repoUrl: args.repo || ""
  });
  console.log(report);

  if (args.json) {
    fs.writeFileSync(
      args.json,
      JSON.stringify(
        {
          level,
          handle: args.handle || null,
          repo: args.repo || null,
          ok: audit.ok,
          passed: audit.passed,
          total: audit.total,
          badge: audit.ok ? LEVEL_NAMES[level] : null,
          checks: audit.results.map((r) => ({
            level: r.level,
            id: r.rule.id,
            title: r.rule.title,
            ok: r.ok,
            detail: r.detail || null,
            where: r.where || null
          }))
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  }

  process.exit(audit.ok ? 0 : 1);
}

// A Windows file URL carries three slashes and a drive letter, so comparing the
// strings by hand never matches and the script silently does nothing at all.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
