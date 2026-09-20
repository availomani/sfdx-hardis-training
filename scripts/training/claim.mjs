/**
 * Training > Claim my badge.
 *
 * Checks the level here first, then opens the claim form of the training
 * repository with every field already filled in. Two things it will not do:
 * claim a level that does not verify, and tick the consent boxes for you. The
 * audit would refuse the first anyway, and a rejected claim teaches nothing;
 * the second is a decision about publishing your name, so it stays a click you
 * make yourself, on GitHub.
 */
import {
  ROOT, c, title, info, ok, warn, fail, abort, universe, readProgress, writeProgress,
  gitOut, repoSlug, githubHandle, run, select, input, confirm, ensureGh, openUrl
} from "../lib/util.mjs";
import { makeContext, rulesForLevel } from "../verify/rules.mjs";
import { runRules } from "../verify/check.mjs";

/** The repository a level asks you to star, and what it is. */
function starOf(levelDef) {
  return levelDef.star || null;
}

/** true when the signed-in account stars owner/repo. 204 means yes, 404 means no. */
function isStarred(slug) {
  return run("gh", ["api", `user/starred/${slug}`, "--silent"], { capture: true, quiet: true }).code === 0;
}

/** Every branch that carries commits the remote does not have yet. */
function unpushedBranches() {
  const out = gitOut(["for-each-ref", "--format=%(refname:short)|%(upstream:short)|%(upstream:track)", "refs/heads"]);
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [branch, upstream, track] = line.split("|");
      return { branch, upstream, track: track || "" };
    })
    // A backpromote branch is the tool's own workspace, rebuilt on every run and
    // never pushed by anybody. It is not work waiting to be published.
    .filter((b) => !b.branch.startsWith("backpromote/"))
    .filter((b) => !b.upstream || b.track.includes("ahead"));
}

export default async function claim(args) {
  const u = universe();
  title("Claim my badge");

  const level = Number(
    await select(
      "Which level are you claiming?",
      u.levels.map((l) => ({ value: String(l.level), label: `Level ${l.level} - ${l.name}` })),
      args.level === undefined ? undefined : String(args.level)
    )
  );
  const levels = u.levels.filter((l) => l.level <= level);

  // ---------------------------------------------------------------- the work
  // A level 2 claim re-runs the level 1 audit, and a level 3 claim re-runs both,
  // so the same ground is covered here rather than on a rejected issue.
  // Read the fork as it is now: a Pull Request merged on GitHub is not in the
  // local branches until a fetch, and the badge audit reads the fork
  run("git", ["fetch", "origin", "--prune"], { quiet: true, capture: true });
  const ctx = makeContext(ROOT);
  const missing = [];
  for (const levelDef of levels) {
    const results = runRules(ctx, rulesForLevel(levelDef.level));
    const passed = results.filter((r) => r.ok).length;
    const line = `  Level ${levelDef.level}  ${passed}/${results.length} checks  ${levelDef.name}`;
    if (passed === results.length) {
      ok(line.trim());
    } else {
      info(c.yellow(line));
      missing.push(...results.filter((r) => !r.ok));
    }
  }

  if (missing.length > 0) {
    info("");
    fail(`${missing.length} check(s) do not pass yet, so there is nothing to claim.`);
    for (const r of missing) {
      info(c.yellow(`    Lab ${r.rule.id}  ${r.rule.title}`));
      info(c.dim(`      What is missing: ${r.detail}`));
    }
    info("");
    info("  Finish those labs, click Check my work to confirm, then claim again.");
    process.exitCode = 1;
    return;
  }

  // The audit reads your repository on GitHub, not this folder. A commit that
  // never left the machine verifies here and fails there, which is the most
  // confusing rejection there is.
  const unpushed = unpushedBranches();
  if (unpushed.length > 0) {
    info("");
    fail("Some of your work is only on this computer.");
    for (const b of unpushed) {
      info(c.yellow(`    ${b.branch}  ${b.upstream ? b.track : "has never been pushed"}`));
    }
    info("");
    info("  The audit reads your repository on GitHub, so push first:");
    info("  Source Control panel, the ... menu, Push. Then claim again.");
    process.exitCode = 1;
    return;
  }

  // ------------------------------------------------------------- the account
  ensureGh();

  const slug = repoSlug();
  if (!slug) {
    abort("This folder has no GitHub remote, so there is no repository to claim.");
  }
  if (slug.toLowerCase() === u.course.upstreamRepo.toLowerCase()) {
    abort(
      "You are working in the training repository itself, not in your own fork.",
      "Everything in this course happens in your fork. See Lab 1.2."
    );
  }

  const visibility = run("gh", ["api", `repos/${slug}`, "--jq", ".visibility"], { capture: true, quiet: true });
  if (visibility.code === 0 && visibility.stdout.trim() === "private") {
    info("");
    warn(`${slug} is private, and the audit clones it without signing in.`);
    const makePublic = await confirm("  Make it public now?", true);
    if (!makePublic) {
      abort(
        "A private repository cannot be audited.",
        "Make it public in its GitHub settings, then claim again."
      );
    }
    const edited = run("gh", ["repo", "edit", slug, "--visibility", "public", "--accept-visibility-change-consequences"]);
    if (edited.code !== 0) {
      abort("The repository could not be made public.", `Do it in https://github.com/${slug}/settings and claim again.`);
    }
    ok(`${slug} is public.`);
  }

  // ---------------------------------------------------------------- the star
  // A thank-you the learner may give, never a condition of the badge, and never
  // given for them: GitHub forbids automated or incentivized starring
  const toStar = levels.map(starOf).filter((star) => star && !isStarred(star));
  if (toStar.length > 0) {
    info("");
    info("  If this course helped you, a star on the project it teaches keeps it visible:");
    toStar.forEach((star) => info(`    https://github.com/${star}`));
    info(c.dim("  It is up to you, and the badge does not depend on it."));
  }

  // -------------------------------------------------------------- the fields
  const progress = readProgress();
  const trailblazer = await input(
    "\n  Your Trailblazer username, shown on your badge page:",
    progress.trailblazer || githubHandle() || ""
  );
  progress.trailblazer = trailblazer;
  writeProgress(progress);

  const labsOfLevels = new Set(levels.flatMap((l) => rulesForLevel(l.level).map((r) => r.id)));
  const receipts = (progress.receipts || [])
    .filter((r) => labsOfLevels.has(r.id))
    .map((r) => r.line)
    .join("\n");

  // ----------------------------------------------------------- the claim form
  // The form rather than an issue created from here, for two reasons: it is
  // what applies the badge-claim label the audit runs on, and the three boxes
  // it asks you to tick are consent, which nothing should tick on your behalf.
  const levelDef = u.levels.find((l) => l.level === level);
  const params = new URLSearchParams({
    template: "claim-level.yml",
    title: `[Badge claim] Level ${level}`,
    level: `${level} - ${levelDef.name}`,
    trailblazer,
    repository: `https://github.com/${slug}`,
    receipts
  });
  const url = `https://github.com/${u.course.upstreamRepo}/issues/new?${params.toString()}`;

  info("");
  ok(`Level ${level} verifies here, and your claim is ready:`);
  info("");
  info(`    Level        ${level} - ${levelDef.name}`);
  info(`    Trailblazer  ${trailblazer}`);
  info(`    Repository   https://github.com/${slug}`);
  info(`    Receipts     ${receipts ? `${receipts.split("\n").length} line(s)` : "none recorded"}`);
  info("");
  info("  A browser opens on the claim form, filled in. Tick the three boxes and");
  info("  click Submit: they say your repository is public and your handle becomes");
  info("  public too, which is your decision and nobody else's.");

  if (!openUrl(url)) {
    warn("The browser did not open. Copy this address into it:");
  }
  info("");
  info(`  ${c.cyan(url)}`);
  info("");
  info(c.dim("  A job then clones your repository, re-runs every check above against it,"));
  info(c.dim("  and answers on the issue. It usually takes a couple of minutes."));
}
