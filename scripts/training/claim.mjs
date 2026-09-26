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
import { fetchTrailblazerProfile } from "../badges/trailblazer.mjs";
import { makeContext, rulesForLevel } from "../verify/rules.mjs";
import { runRules } from "../verify/check.mjs";

/** The repository a level asks you to star, and what it is. */
function starOf(levelDef) {
  return levelDef.star || null;
}

/**
 * The Trailblazer username, checked against the real profile before the claim
 * is opened.
 *
 * The suggestion is the GitHub handle, which for most people is not their
 * Trailblazer username: accepting it unchecked is how a badge ends up linking to
 * a profile that does not exist. The audit refuses such a claim anyway, so
 * catching it here saves a round trip through an issue.
 *
 * Three tries, then it goes through: an API that answers "no" for a name that is
 * really there must not be able to stop somebody claiming what they earned, and
 * the audit says the same thing again with more room to explain it.
 */
async function askTrailblazer(suggestion) {
  let value = suggestion;
  // Said before the question, not only after a miss: most people have never
  // had to type this, and the suggestion below is their GitHub handle, which
  // looks plausible enough to accept without checking.
  info("");
  info("  Where to find your Trailblazer username:");
  info("    1. Sign in at https://trailhead.salesforce.com");
  info("    2. Click your picture, top right, then View Profile");
  info("    3. The address of that page ends with it:");
  info(c.dim("       https://www.salesforce.com/trailblazer/mytrailblazerusername"));
  info(c.dim("       the username there is: mytrailblazerusername"));
  info("  It is not your email and not your Salesforce username. If you have never");
  info("  set one, that profile page is also where you choose it.");
  for (let attempt = 1; attempt <= 3; attempt++) {
    const answer = (await input("\n  Your Trailblazer username, shown on your badge page:", value)).trim();
    const profile = await fetchTrailblazerProfile(answer);
    if (profile.state === "public") {
      info(c.dim(`    Trailhead profile: ${profile.name || answer}`));
      return answer;
    }
    if (profile.state !== "missing") {
      // private, or the API could not be reached: neither is the learner's problem
      return answer;
    }
    warn(`  No public Trailblazer profile answers to "${answer}".`);
    info("  It is the last part of your own profile URL, not your email and not your");
    info("  Salesforce username:");
    info(c.dim("    https://www.salesforce.com/trailblazer/mytrailblazerusername"));
    // The same answer coming back means nothing is typing: stop asking.
    if (answer === value || attempt === 3) {
      warn("  Carrying on with it. The audit checks this too, and will explain it there.");
      return answer;
    }
    value = answer;
  }
  return value;
}

/** true when the signed-in account stars owner/repo. 204 means yes, 404 means no. */
function isStarred(slug) {
  return run("gh", ["api", `user/starred/${slug}`, "--silent"], { capture: true, quiet: true }).code === 0;
}

/**
 * Every branch that carries commits your fork on GitHub does not have yet.
 *
 * Compared with the fork itself, not with the branch git says it follows: after
 * Reset this level, integration used to follow the course's start branch, and
 * showed "ahead" for commits that were on the fork all along. A branch that was
 * never pushed but holds no commit of its own is not work waiting either.
 */
function unpushedBranches(majors) {
  return gitOut(["for-each-ref", "--format=%(refname:short)", "refs/heads"])
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    // A backpromote branch is the tool's own workspace, rebuilt on every run and
    // never pushed by anybody. It is not work waiting to be published.
    .filter((branch) => !branch.startsWith("backpromote/"))
    // Major branches only change through Pull Requests, so they cannot be pushed
    // from here, and the checks above already read them on the fork
    .filter((branch) => !majors.includes(branch))
    .map((branch) => ({
      branch,
      commits: Number(gitOut(["rev-list", "--count", branch, "--not", "--remotes=origin"]) || 0)
    }))
    .filter((b) => b.commits > 0);
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
  const unpushed = unpushedBranches(u.branches?.majors || ["integration", "uat", "preprod", "main"]);
  if (unpushed.length > 0) {
    info("");
    fail("Some of your work is only on this computer.");
    for (const b of unpushed) {
      info(c.yellow(`    ${b.branch}  ${b.commits} commit(s) not on GitHub`));
    }
    info("");
    info("  The badge audit reads your repository on GitHub, not this computer, so these");
    info("  commits must be sent to GitHub first. Push sends only the branch you are on,");
    info("  so do this for each branch listed above:");
    info("");
    info(`    1. Click the branch name in the bottom left corner of VS Code (it shows the`);
    info(`       branch you are on), then pick ${unpushed.length === 1 ? c.bold(unpushed[0].branch) : "the branch"} in the list that opens at the top.`);
    info("       If VS Code says you have uncommitted changes, commit them first.");
    info("    2. Open the Source Control panel: the icon with three circles joined by lines,");
    info("       in the bar on the left side of VS Code (or Ctrl+Shift+G).");
    info("    3. At the top of that panel, click the ... menu, then Push.");
    info("       If VS Code asks whether to publish the branch, answer OK: it is not on");
    info("       GitHub yet, and publishing is how it gets there.");
    info("");
    info("  Then click Claim my badge again.");
    process.exitCode = 1;
    return;
  }

  // ------------------------------------------------------------- the account
  await ensureGh();

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
  const trailblazer = await askTrailblazer(progress.trailblazer || githubHandle() || "");
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
  info(`  A browser opens on the claim form, filled in except for one field. Pick`);
  info(`  ${c.bold(`Level ${level} - ${levelDef.name}`)} in the ${c.bold("Level")} dropdown: GitHub does not prefill a`);
  info("  dropdown from a link, so it arrives empty and the form refuses to submit.");
  info("  Then tick the three boxes and click Create: they say your repository is");
  info("  public and your handle becomes public too, which is your decision and");
  info("  nobody else's.");

  if (!openUrl(url)) {
    // A browser IDE has no browser of its own to open: the address is the whole
    // of the answer there, and it is clickable where this is printed.
    warn("No browser opened from here. Click the address below, or copy it into one:");
  }
  info("");
  info(`  ${c.cyan(url)}`);
  info("");
  info(c.dim("  A job then clones your repository, re-runs every check above against it,"));
  info(c.dim("  and answers on the issue. It usually takes a couple of minutes."));
}
