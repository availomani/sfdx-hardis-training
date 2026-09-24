/**
 * Training > Where am I?
 *
 * The single cheapest way to stop people abandoning a multi-session course:
 * one click that says which lab you reached and what to open next.
 */
import {
  ROOT, c, title, info, ok, warn, universe, readProgress,
  gitOut, githubHandle, repoSlug, connectedOrgs, run } from "../lib/util.mjs";
import { makeContext, rulesForLevel } from "../verify/rules.mjs";
import { runRules } from "../verify/check.mjs";
import { adviseCourseUpdate } from "../lib/course-updates.mjs";

export default async function status() {
  const u = universe();
  title("Where am I?");

  // ------------------------------------------------------------ the repo
  const slug = repoSlug();
  const branch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  info(`  Repository : ${c.bold(slug || "unknown")}`);
  info(`  Branch     : ${c.bold(branch || "unknown")}`);
  if (slug && slug.toLowerCase() === u.course.upstreamRepo.toLowerCase()) {
    warn("You are working in the training repository itself, not in your own fork.");
    info(c.dim("    Everything in this course happens in your fork. See Lab 1.2."));
  }
  adviseCourseUpdate({ quietWhenCurrent: false });

  // ------------------------------------------------------------ the orgs
  const orgs = connectedOrgs().filter((o) => o.connected);
  // An org answers to several names: match any of its aliases, or an org the CI
  // aliased in Level 1 is reported as not connected
  const known = u.orgs.filter((o) =>
    orgs.some((c2) => c2.alias === o.alias || (c2.aliases || []).includes(o.alias))
  );
  info(`  Orgs       : ${known.length === 0 ? c.yellow("none connected yet") : known.map((o) => o.alias).join(", ")}`);

  const progress = readProgress();
  const seeded = Object.keys(progress.orgs || {});
  if (seeded.length > 0) {
    info(`  Seeded     : ${seeded.join(", ")}`);
  }

  // ------------------------------------------------------------ the labs
  // Read the fork as it is now: a Pull Request merged on GitHub is not in the
  // local branches until a fetch, and the badge audit reads the fork
  run("git", ["fetch", "origin", "--prune"], { quiet: true, capture: true });
  const ctx = makeContext(ROOT);
  let nextLevel = null;
  let nextLab = null;

  for (const levelDef of u.levels) {
    const results = runRules(ctx, rulesForLevel(levelDef.level));
    const passed = results.filter((r) => r.ok).length;
    const total = results.length;
    const bar = `${"#".repeat(passed)}${".".repeat(total - passed)}`;
    const line = `  Level ${levelDef.level}    : ${bar}  ${passed}/${total}  ${levelDef.name}`;
    if (passed === total) {
      ok(line.trim());
    } else {
      info(line);
      if (nextLevel === null) {
        const firstMissing = results.find((r) => !r.ok);
        nextLevel = levelDef.level;
        nextLab = firstMissing ? firstMissing.rule.lab : 1;
      }
    }
  }

  // ------------------------------------------------------------ next step
  console.log("");
  if (nextLevel === null) {
    ok("Every lab of all three levels verifies. Claim your badges if you have not already.");
    info(`  Welcome page > ${c.bold("Training: Level 3")} > ${c.bold("Claim my badge")}.`);
    return;
  }

  const levelDef = u.levels.find((l) => l.level === nextLevel);
  const labDef = levelDef.labs.find((l) => l.lab === nextLab) || levelDef.labs[0];
  title("What to do next");
  info(`  Level ${nextLevel} - ${levelDef.name}`);
  info(`  ${c.bold(`Lab ${levelDef.level}.${labDef.lab} - ${labDef.title}`)}  ${c.dim(`(~${labDef.time})`)}`);
  info("");
  info(`  ${c.cyan(`${u.course.site}/en/${levelDef.slug}/${labDef.slug}/`)}`);

  const handle = githubHandle();
  if (handle) {
    info("");
    info(c.dim(`  Your receipts so far: ${(progress.receipts || []).length}`));
  }
}
