/**
 * Training > Reset this level.
 *
 * Puts your fork back to the state a level starts from. Without this, one
 * botched lab ends the course, which is the most common way a free course
 * loses a learner halfway through.
 */
import fs from "fs";
import path from "path";
import {
  ROOT, c, title, info, ok, warn, abort, run, git, gitOut,
  select, confirm, universe, repoSlug
} from "../lib/util.mjs";
import { withProtectionLifted } from "../lib/protection.mjs";

export default async function reset(args) {
  const u = universe();
  title("Reset this level");

  const level = Number(
    await select(
      "Which level do you want to restart?",
      u.levels.map((l) => ({
        value: String(l.level),
        label: `Level ${l.level} - ${l.name}`,
        hint: `back to ${startBranch(l.level)}`
      })),
      args.level
    )
  );

  const start = startBranch(level);

  info("");
  warn(`This throws away the work on your ${c.bold("integration")} branch and replaces it with ${c.bold(start)}.`);
  info(c.dim("    Your feature branches are left alone, and nothing is deleted in your orgs."));
  const sure = args.yes === true || (await confirm(`Reset integration to ${start}?`, false));
  if (!sure) {
    info("Nothing was changed.");
    return;
  }

  ensureUpstream(u);

  title("1 of 3  Fetching the reference branches");
  if (run("git", ["fetch", "upstream", "--prune"]).code !== 0) {
    abort("Could not reach the training repository.", "Check your network connection and try again.");
  }
  const exists = gitOut(["rev-parse", "--verify", `upstream/${start}`]);
  if (!exists) {
    abort(
      `The branch ${start} does not exist upstream.`,
      "That level may not have shipped yet. Check the course site for the current levels."
    );
  }
  ok(`upstream/${start} found`);

  title("2 of 3  Moving your integration branch");
  const dirty = gitOut(["status", "--porcelain"]);
  if (dirty) {
    warn("You have uncommitted changes. They are being stashed, not deleted.");
    if (run("git", ["stash", "push", "-u", "-m", `before training reset to ${start}`]).code !== 0) {
      abort(
        "Your changes could not be put aside, so nothing was reset.",
        "Git refuses to stash during an unresolved merge. Finish or abandon it, then run Reset this level again."
      );
    }
  }
  // Read from GitHub, not from the local branch: the configuration of Lab 3.1
  // reaches integration through a Pull Request merged on github.com, and a
  // learner who never pulled would otherwise reset without their keys
  run("git", ["fetch", "--quiet", "origin", "integration"], { quiet: true, capture: true });
  const pipelineConfig = branchConfigOn(
    run("git", ["rev-parse", "--verify", "--quiet", "origin/integration"], { quiet: true, capture: true }).code === 0
      ? "origin/integration"
      : "integration"
  );
  // The one command a learner runs to get out of a broken state: if the
  // checkout is refused, say so instead of reporting a reset that never
  // happened and force-pushing a branch that never moved.
  if (run("git", ["checkout", "-B", "integration", `upstream/${start}`]).code !== 0) {
    abort(
      "Your integration branch could not be moved to the reset point.",
      "Close anything holding a file of this folder open, then run Reset this level again."
    );
  }
  ok(`integration now matches ${start}`);
  keepBranchConfig(pipelineConfig);

  title("3 of 3  Publishing it to your fork");
  // --force-with-lease compares the fork against what this clone last saw of
  // it, and a learner who merged a Pull Request on github.com has not seen it
  // since. Without this fetch the push is refused with "stale info", on the
  // one command meant to rescue them.
  run("git", ["fetch", "origin", "--prune"]);
  // integration is protected against force pushes, and a reset is one. The
  // protection is lifted for this push only, and put back right after.
  const push = withProtectionLifted(repoSlug(), ["integration"], () => run("git", ["push", "origin", "integration", "--force-with-lease"]));
  if (push.code !== 0) {
    warn("The push was refused. Your local branch is reset; push it yourself when you are ready.");
  } else {
    ok("Your fork is level with the reset point");
  }

  title("Done");
  const levelDef = u.levels.find((l) => l.level === level);
  info(`  Level ${level} - ${levelDef.name} starts again at:`);
  info(`  ${c.cyan(`${u.course.site}/en/${levelDef.slug}/`)}`);
  info("");
  info(c.dim("  Your training orgs still hold whatever you built. If a lab needs a clean org,"));
  info(c.dim("  run Set up one of my training orgs on it again, from the Training menu."));
}

/**
 * The branch configuration files as they are on a branch before the reset.
 *
 * They name your orgs, which the reference branches cannot know, and Set up my
 * training environment wrote them in Lab 1. A reset that dropped them would
 * leave a pipeline that deploys nowhere.
 *
 * The encrypted keys of Lab 3.1 go with them. The branch files it wrote are
 * kept, and Lab 3.1 deleted the auth URL secrets: a reset that dropped the keys
 * left a Level 3 pipeline whose every check failed on "You must be logged to an
 * org", until Lab 3.1 was done again. The keys are hex text, so they survive
 * the same round trip as the branch files.
 */
function branchConfigOn(branch) {
  const files = gitOut(["ls-tree", "-r", "--name-only", branch, "--", "config/branches/"])
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => /\.sfdx-hardis\.[^/]+\.yml$/.test(f) || /^config\/branches\/\.jwt\/[^/]+\.key$/.test(f));
  return files.map((file) => ({ file, content: run("git", ["show", `${branch}:${file}`], { capture: true, quiet: true }).stdout }));
}

function keepBranchConfig(files) {
  const changed = [];
  for (const { file, content } of files) {
    const absolute = path.join(ROOT, file);
    if (!content || (fs.existsSync(absolute) && fs.readFileSync(absolute, "utf8") === content)) {
      continue;
    }
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, "utf8");
    changed.push(file);
  }
  if (changed.length === 0) {
    return;
  }
  git(["add", "--", ...changed], { quiet: true });
  if (run("git", ["commit", "-m", "Keep my pipeline configuration", "--", ...changed], { capture: true, quiet: true }).code === 0) {
    ok("Your branch configuration, which names your orgs, is kept");
  } else {
    warn("Could not commit your branch configuration. Run Set up my training environment to write it again.");
  }
}

function startBranch(level) {
  return `training/start-level-${level}`;
}

function ensureUpstream(u) {
  const remotes = gitOut(["remote"]).split("\n").map((r) => r.trim());
  if (remotes.includes("upstream")) {
    return;
  }
  info(c.dim("    Adding the training repository as the upstream remote."));
  git(["remote", "add", "upstream", `https://github.com/${u.course.upstreamRepo}.git`]);
}
