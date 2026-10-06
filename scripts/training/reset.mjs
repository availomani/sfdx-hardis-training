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
  ROOT, c, title, info, ok, warn, abort, run, runStreamed, git, gitOut,
  select, confirm, universe, repoSlug, ensureGh, connectedOrgs
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
  info(c.dim("    Then it offers to delete the branches of this level, here and in your fork,"));
  info(c.dim("    and to set up helios-dev and helios-integration again. Each is asked first."));
  const sure = args.yes === true || (await confirm(`Reset integration to ${start}?`, false));
  if (!sure) {
    info("Nothing was changed.");
    return;
  }

  ensureUpstream(u);
  // The start branch can carry other workflow files than integration has, and
  // GitHub refuses that push to a token without the workflow permission
  await ensureGh();

  title("1 of 5  Fetching the reference branches");
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

  title("2 of 5  Moving your integration branch");
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
  // --no-track: started from upstream/<start>, git would make integration follow
  // that start branch, and every later "ahead" would compare with the course
  // instead of the fork. Claim my badge then reported integration as not pushed.
  if (run("git", ["checkout", "--no-track", "-B", "integration", `upstream/${start}`]).code !== 0) {
    abort(
      "Your integration branch could not be moved to the reset point.",
      "Close anything holding a file of this folder open, then run Reset this level again."
    );
  }
  ok(`integration now matches ${start}`);
  keepBranchConfig(pipelineConfig);

  title("3 of 5  Publishing it to your fork");
  // --force-with-lease compares the fork against what this clone last saw of
  // it, and a learner who merged a Pull Request on github.com has not seen it
  // since. Without this fetch the push is refused with "stale info", on the
  // one command meant to rescue them.
  run("git", ["fetch", "origin", "--prune"]);
  // integration is protected against force pushes, and a reset is one. The
  // protection is lifted for this push only, and put back right after.
  const push = withProtectionLifted(repoSlug(), ["integration"], () => run("git", ["push", "origin", "integration", "--force-with-lease"]));
  // integration follows the fork's integration, pushed or not: that is what
  // Source Control and Claim my badge compare it with
  run("git", ["fetch", "--quiet", "origin", "integration"], { quiet: true, capture: true });
  run("git", ["branch", "--set-upstream-to=origin/integration", "integration"], { quiet: true, capture: true });
  if (push.code !== 0) {
    // integration only takes Pull Requests: the learner cannot push it by hand.
    // Steps 4 and 5 stop here too: deleting the fork's branches closes their Pull
    // Requests, and setting up the orgs again, for a fork still holding the old
    // work, would leave the orgs and the repository disagreeing.
    warn("The push was refused, so your fork was not reset. Run Reset this level again.");
    info(c.dim("    Nothing else was changed: your branches and your orgs are as they were."));
    return;
  }
  ok("Your fork is level with the reset point");

  title("4 of 5  Clearing the branches of this level");
  const branchesCleared = await clearLevelBranches(u, level, args);

  title("5 of 5  Putting your orgs back");
  const orgsLeft = await reseedOrgs(args);

  title("Done");
  const levelDef = u.levels.find((l) => l.level === level);
  info(`  Level ${level} - ${levelDef.name} starts again at:`);
  info(`  ${c.cyan(`${u.course.site}/en/${levelDef.slug}/`)}`);
  if (!branchesCleared) {
    info("");
    info(c.dim("  The branches of this level are still there. New User Story never reuses a branch,"));
    info(c.dim("  so it will ask you for another name at each story of this level that has one."));
  }
  if (orgsLeft.length > 0) {
    info("");
    info(c.dim(`  ${orgsLeft.join(" and ")} still hold${orgsLeft.length === 1 ? "s" : ""} whatever you built. If a lab needs a clean org,`));
    info(c.dim("  run Set up one of my training orgs on it again, from the Training menu."));
  }
}

/**
 * The branch configuration files as they are on a branch before the reset.
 *
 * They name your orgs, which the reference branches cannot know, and Set up my
 * training environment wrote them in Lab 1. A reset that dropped them would
 * leave a pipeline that deploys nowhere.
 *
 * The encrypted keys of Lab 3.1 go with them. Lab 3.1 configures JWT for
 * preprod and main only, and their branch files are kept: a reset that dropped
 * the keys left a pipeline whose checks into those two failed on "You must be
 * logged to an org", until Lab 3.1 was done again. integration and uat keep the
 * SFDX_AUTH_URL_* secrets of Level 1 and have no key. A fork that walked the
 * earlier Lab 3.1, which moved all four branches to JWT and deleted those
 * secrets, has four keys, and all four are kept the same way. The keys are hex
 * text, so they survive the same round trip as the branch files.
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

/**
 * Step 4: the branches the labs of this level and the next ones create, here
 * and in the fork.
 *
 * A reset that leaves them is a trap. New User Story asked for the same name,
 * features/US-021-crew-size-warning, and was given the old branch with its
 * eleven old commits, so the lab went wrong from its first step.
 * A branch is the course's when its name holds the id of a story of this level
 * or a later one, when it is the branch of a teammate scenario of those levels,
 * or when it is a backpromote branch (Level 2 makes the first ones) or a
 * promotion branch (Level 3). The branch checked out and the major branches are
 * never touched, whatever their name.
 *
 * Returns true when nothing of the level is left: none was found, or all went.
 */
async function clearLevelBranches(u, level, args) {
  const ids = (u.userStories || []).filter((story) => story.level >= level).map((story) => story.id);
  const scenarioBranches = levelScenarioBranches(u, level);
  const protectedNames = new Set([...(u.branches?.majors || ["integration", "uat", "preprod", "main"]), "HEAD"]);
  const current = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  const isLevelBranch = (name) => {
    if (!name || name === current || protectedNames.has(name)) {
      return false;
    }
    const lower = name.toLowerCase();
    // The id followed by anything but a digit: US-02 must not take US-021 with it
    const holdsStory = ids.some((id) => new RegExp(`${id.toLowerCase()}(?!\\d)`).test(lower));
    return (
      holdsStory ||
      scenarioBranches.has(name) ||
      (level <= 2 && name.startsWith("backpromote/")) ||
      (level <= 3 && name.startsWith("promotion/"))
    );
  };

  // The fork was fetched with --prune in step 3, so origin/ is what GitHub holds now
  const local = gitOut(["branch", "--format=%(refname:short)"]).split("\n").map((b) => b.trim()).filter(isLevelBranch);
  const remote = gitOut(["for-each-ref", "--format=%(refname:strip=3)", "refs/remotes/origin/"])
    .split("\n")
    .map((b) => b.trim())
    .filter(isLevelBranch);
  if (local.length === 0 && remote.length === 0) {
    ok("No branch of this level is left, here or in your fork");
    return true;
  }

  info("  The branches the labs of this level create:");
  for (const name of [...new Set([...local, ...remote])].sort()) {
    const where = [local.includes(name) ? "here" : null, remote.includes(name) ? "in your fork" : null].filter(Boolean).join(" and ");
    info(c.dim(`    ${name}  (${where})`));
  }
  if (remote.length > 0) {
    warn("Deleting a branch in your fork closes the Pull Request still open from it.");
  }
  const sure = args.yes === true || (await confirm("Delete these branches, here and in your fork?", true));
  if (!sure) {
    info("  The branches are left as they are.");
    return false;
  }

  let failures = 0;
  for (const name of local) {
    if (run("git", ["branch", "-D", name], { quiet: true, capture: true }).code === 0) {
      ok(`Deleted ${name} here`);
    } else {
      failures++;
      warn(`${name} could not be deleted here. Delete it in the Source Control panel.`);
    }
  }
  for (const name of remote) {
    if (run("git", ["push", "origin", "--delete", name], { quiet: true, capture: true }).code === 0) {
      ok(`Deleted ${name} in your fork`);
    } else {
      failures++;
      warn(`${name} could not be deleted in your fork. Delete it on GitHub, from the Branches page of your fork.`);
    }
  }
  return failures === 0;
}

/**
 * The branches the teammate scenarios of this level and the later ones create.
 * A scenario belongs to the level of its story, read from training-universe.json
 * through its folder name (us-017-sign-off is US-017), and to the levels it
 * declares when the universe has no such story.
 */
function levelScenarioBranches(u, level) {
  const dir = path.join(ROOT, "scripts", "simulate");
  const branches = new Set();
  if (!fs.existsSync(dir)) {
    return branches;
  }
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name, "scenario.json");
    if (!fs.existsSync(file)) {
      continue;
    }
    let scenario = null;
    try {
      scenario = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    if (!scenario.branch) {
      continue;
    }
    const id = (name.match(/^us-\d{3}/i) || [""])[0].toUpperCase();
    const story = (u.userStories || []).find((one) => one.id === id);
    const storyLevel = story ? story.level : Math.max(0, ...(scenario.levels || []));
    if (storyLevel >= level) {
      branches.add(scenario.branch);
    }
  }
  return branches;
}

/**
 * Step 5: the two orgs a contributor works in, set up again from the integration
 * the reset just put back.
 *
 * Moving a branch changes nothing in an org. A learner who restarted Level 2
 * still had Crew Size required in helios-dev from Lab 2.3, and the backpromote of
 * Lab 2.1 failed on it. Set up one of my training orgs deploys the project as it
 * now stands, which takes the field back to optional, and reloads the data.
 *
 * It runs as a child process rather than in this one: it stops with abort() on
 * a failed deployment, which ends the process, and the second org would never
 * be set up. The child is told there is no panel and nobody to answer, so it
 * neither opens a second command in the panel nor waits on a question; its lines
 * come through this command instead.
 *
 * Returns the aliases left as they were, for the last words of the reset.
 */
async function reseedOrgs(args) {
  const aliases = ["helios-dev", "helios-integration"];
  const sure = args.yes === true || (await confirm("Set up helios-dev and helios-integration again, so they match integration?", true));
  if (!sure) {
    info("  Your orgs are left as they are.");
    return aliases;
  }
  const connected = connectedOrgs().filter((org) => org.connected);
  const left = [];
  for (const alias of aliases) {
    const org = connected.find((one) => one.alias === alias || (one.aliases || []).includes(alias));
    if (!org) {
      warn(`${alias} is not connected, so it was not set up again.`);
      info(c.dim("    Connect it in the Orgs Manager panel, then run Set up one of my training orgs on it."));
      left.push(alias);
      continue;
    }
    info(`  Setting up ${c.bold(alias)} again. On a scratch org this takes a few minutes.`);
    const res = await runStreamed(process.execPath, [path.join(ROOT, "scripts", "training.mjs"), "seed", "--org", alias, "--skip-update-check"], {
      env: { SFDX_HARDIS_WEBSOCKET: "", TRAINING_NO_PROMPT: "true" }
    });
    if (res.code === 0) {
      ok(`${alias} matches integration again`);
    } else {
      warn(`${alias} could not be set up again: the lines above say why. Run Set up one of my training orgs on it.`);
      left.push(alias);
    }
  }
  return left;
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
