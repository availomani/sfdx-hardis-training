/**
 * Training > Update my course.
 *
 * Brings the changes the course received since the learner forked it into the
 * fork: the scripts behind the Training menu, the teammate stories, the Check my
 * work rules, the project configuration. The lab pages need none of this, they
 * are read on the published site.
 *
 * It merges the main branch of the training repository into a branch of its
 * own, cut from the fork's integration, pushes it and opens a Pull Request into
 * integration: the one way anything reaches a major branch in this course. Then
 * it waits for the checks of that Pull Request, merges it with a merge commit,
 * never a squash, so that git remembers what was brought in and the next update
 * only brings what is new, and brings the result into the branch the learner is
 * on. One click, and the learner goes on with the course.
 *
 * One update at a time: when an update Pull Request is already open, the new
 * course changes are merged into its branch, and the same Pull Request carries
 * them; with nothing new, the command picks that Pull Request up where it was
 * left and merges it. A branch whose push failed is pushed on the next run
 * instead of being made again.
 *
 * Nothing the learner built is thrown away, unlike Reset this level. A file
 * that both the learner and the course changed stops the merge: the command
 * undoes it and says which files, rather than leaving a half merge behind. A
 * failed check stops it before the merge, and says where to look.
 */
import { c, title, info, ok, warn, fail, abort, run, gitOut, confirm, repoSlug, stamp, openPullRequest, ensureGh } from "../lib/util.mjs";
import {
  UPDATE_BASE,
  UPDATE_BRANCH_PREFIX,
  ensureCourseUpstream,
  fetchCourse,
  missingCourseCommits,
  openUpdatePullRequest,
  waitForPullRequestChecks,
  mergeUpdatePullRequest
} from "../lib/course-updates.mjs";

const MERGE_MESSAGE = "Update the course from the training repository";

/**
 * A local update branch that already holds every course change, left behind by
 * a run that stopped before its Pull Request existed: its push failed, or the
 * Pull Request could not be opened. It is pushed again and carried on, rather
 * than made a second time.
 */
function pendingUpdateBranch() {
  const local = gitOut(["branch", "--list", `${UPDATE_BRANCH_PREFIX}*`, "--format=%(refname:short)"])
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return local.find((b) => missingCourseCommits(b).length === 0) || null;
}

/** Where the learner is, as something git switch can go back to, detached or not. */
function currentPosition() {
  const name = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  return name && name !== "HEAD"
    ? { args: [name], label: name, branch: name }
    : { args: ["--detach", gitOut(["rev-parse", "HEAD"])], label: "the commit you were on", branch: null };
}

/**
 * Uncommitted changes, put aside while git works and given back after. Git
 * refuses to switch branches or merge over changes in progress, and neither is
 * something the learner should have to sort out before clicking a menu entry.
 */
function putAside(reason) {
  if (gitOut(["status", "--porcelain"]) === "") {
    return { back: () => {} };
  }
  if (run("git", ["stash", "push", "-u", "-m", reason], { quiet: true, capture: true }).code !== 0) {
    abort(
      "Your uncommitted changes could not be put aside, so nothing was updated.",
      "Git refuses during an unfinished merge. Finish or abandon it in the Source Control panel, then run Update my course again."
    );
  }
  return {
    back: () => {
      if (run("git", ["stash", "pop"], { quiet: true, capture: true }).code === 0) {
        ok("Your uncommitted changes are back");
      } else {
        warn("Your uncommitted changes are kept in the git stash: Source Control panel, Stashes, Apply Stash.");
      }
    }
  };
}

/**
 * The updated integration, in the branch the learner is on.
 *
 * The training commands run the scripts of the branch that is checked out, so
 * an update merged on GitHub and left there changes nothing for the learner.
 * On integration it is a pull. On a feature branch it is a merge of integration
 * into it, which is how that branch would get the course anyway; when that
 * conflicts with the learner's work there, the branch is left as it was and the
 * learner is told to go to integration.
 */
function bringHome() {
  run("git", ["fetch", "--quiet", "origin", UPDATE_BASE], { quiet: true, capture: true });
  const here = currentPosition();
  if (!here.branch) {
    warn(`You are on a detached commit: switch to ${UPDATE_BASE} to use the updated course.`);
    return;
  }
  const aside = putAside("before Update my course brings the update");
  if (here.branch === UPDATE_BASE) {
    const pulled =
      run("git", ["merge", "--ff-only", `origin/${UPDATE_BASE}`], { quiet: true, capture: true }).code === 0 ||
      run("git", ["merge", "--no-edit", `origin/${UPDATE_BASE}`], { quiet: true, capture: true }).code === 0;
    if (pulled) {
      ok(`Your ${UPDATE_BASE} is up to date`);
    } else {
      abortMerge();
      warn(`Your local ${UPDATE_BASE} could not take the update: Pull in the Source Control panel to see why.`);
    }
    aside.back();
    return;
  }
  // The local integration follows too, when it only has to move forward
  run("git", ["fetch", "--quiet", "origin", `${UPDATE_BASE}:${UPDATE_BASE}`], { quiet: true, capture: true });
  if (run("git", ["merge", "--no-edit", `origin/${UPDATE_BASE}`], { quiet: true, capture: true }).code === 0) {
    ok(`Your ${UPDATE_BASE} is up to date, and so is your branch ${here.branch}`);
  } else {
    abortMerge();
    warn(`Your ${UPDATE_BASE} is up to date. Your branch ${here.branch} could not take it without a conflict, so it was left as it was.`);
    info(`  Switch to ${UPDATE_BASE} to use the updated course.`);
  }
  aside.back();
}

/** Only a merge that started can be aborted. */
function abortMerge() {
  if (run("git", ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], { quiet: true, capture: true }).code === 0) {
    run("git", ["merge", "--abort"], { quiet: true, capture: true });
  }
}

export default async function update(args) {
  title("Update my course");

  if (!ensureCourseUpstream()) {
    abort(
      "This folder is not your fork of the course, so there is nothing to update it from.",
      "Run Set up my training environment first: it creates your fork and points this folder at it."
    );
  }
  // Every step after the merge goes through gh: the Pull Request, its checks,
  // its merge. Signed in now, not after a branch was already pushed.
  await ensureGh();

  title("1 of 6  What changed in the course");
  if (!fetchCourse()) {
    abort("The training repository could not be reached.", "Check your network connection and run Update my course again.");
  }
  const missing = missingCourseCommits();
  if (missing.length === 0) {
    ok("Your fork already has every change of the course. Nothing to do.");
    return;
  }
  const open = openUpdatePullRequest();
  if (open) {
    run("git", ["fetch", "--quiet", "origin", open.branch], { quiet: true, capture: true });
  }
  // An open update that already holds every course change only waits to be merged
  const onlyMerge = Boolean(open) && missingCourseCommits(`origin/${open.branch}`).length === 0;
  info(`  ${missing.length} change(s) of the course your fork does not have yet:`);
  missing.slice(0, 15).forEach((commit) => info(c.dim(`    ${commit.subject}`)));
  if (missing.length > 15) {
    info(c.dim(`    ... and ${missing.length - 15} more`));
  }
  info(c.dim("  Changes to the lab pages, the translations, the site and the badges are left out: you read those on the site."));

  const pending = open ? null : pendingUpdateBranch();
  const branch = open ? open.branch : pending || args.branch || `${UPDATE_BRANCH_PREFIX}${stamp()}`;
  const question = onlyMerge
    ? `They wait in the update Pull Request already open, ${open.url}. Merge it into ${UPDATE_BASE} once its checks pass?`
    : open
      ? `Add them to the update Pull Request that is already open, from ${branch}, and merge it into ${UPDATE_BASE} once its checks pass?`
      : pending
        ? `Push ${branch}, the update made last time, and merge it into ${UPDATE_BASE} through a Pull Request?`
        : `Bring them in on a new branch, ${branch}, and merge it into ${UPDATE_BASE} through a Pull Request?`;
  info("");
  const sure = args.yes === true || (await confirm(question, true));
  if (!sure) {
    info("Nothing was changed.");
    return;
  }

  const slug = repoSlug();
  let prUrl = open ? open.url : null;

  if (onlyMerge) {
    title("2 of 6  A branch for the update");
    ok(`Already made: ${branch}`);
    title("3 of 6  Merging the course into it");
    ok("Already merged");
    title("4 of 6  Pushing it and opening the Pull Request");
    ok(`Already open: ${c.cyan(prUrl)}`);
  } else {
    // Whatever the learner is in the middle of stays where it is: put aside now,
    // given back as soon as the branch is pushed, where they were
    const previous = currentPosition();
    const aside = putAside("before Update my course");
    const giveBack = () => {
      if (run("git", ["switch", ...previous.args], { quiet: true, capture: true }).code !== 0) {
        warn(`Could not go back to ${previous.label}.`);
      }
      aside.back();
    };

    title("2 of 6  A branch for the update");
    const checkout = open
      ? run("git", ["switch", "-C", branch, `origin/${branch}`], { quiet: true, capture: true })
      : pending
        ? run("git", ["switch", branch], { quiet: true, capture: true })
        : run("git", ["switch", "--no-track", "-c", branch, `origin/${UPDATE_BASE}`], { quiet: true, capture: true });
    if (checkout.code !== 0) {
      giveBack();
      abort(`The branch ${branch} could not be checked out.`, (checkout.stderr || "").trim() || "Run Update my course again.");
    }
    ok(open ? `On ${branch}, the branch of the open update` : pending ? `On ${branch}, made last time` : `On ${branch}, made from the ${UPDATE_BASE} of your fork`);

    title("3 of 6  Merging the course into it");
    if (pending) {
      ok("Already merged last time");
    } else {
      const merged = run("git", ["merge", "--no-edit", "-m", MERGE_MESSAGE, "upstream/main"], { capture: true, quiet: true });
      if (merged.code !== 0) {
        const conflicts = gitOut(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
        // Only a merge that started can be aborted: a missing git identity or an
        // unrelated history stops git before anything is merged
        abortMerge();
        giveBack();
        if (!open) {
          run("git", ["branch", "-D", branch], { quiet: true, capture: true });
        }
        if (conflicts.length === 0) {
          fail("Git could not merge the course into your fork:");
          (merged.stderr || merged.stdout || "").trim().split("\n").slice(0, 6).forEach((line) => info(c.dim(`    ${line}`)));
          abort(
            "Update my course stopped before merging anything.",
            /tell me who you are|user\.email|user\.name/i.test(merged.stderr || "")
              ? "Git needs a name and an email first: commit once in the Source Control panel, which asks for them, then run Update my course again."
              : "Nothing was pushed and your branches are as they were."
          );
        }
        fail(`The course and your fork both changed ${conflicts.length} file(s), so the update was undone:`);
        conflicts.forEach((file) => info(c.dim(`    ${file}`)));
        info("");
        info("  Two ways out:");
        info(`  - ${c.bold("Reset this level")} starts the level again from its current state, course changes included,`);
        info("    and throws away your work on integration in this level.");
        info("  - Or merge by hand and keep both, the way Lab 2.7 solves a conflict, then publish the branch:");
        info(c.dim(open ? `      git switch -C ${branch} origin/${branch}` : `      git switch --no-track -c ${branch} origin/${UPDATE_BASE}`));
        info(c.dim("      git merge upstream/main"));
        abort("Update my course stopped on a conflict.", "Nothing was pushed and your branches are as they were.");
      }
      ok("Merged");
    }

    title("4 of 6  Pushing it and opening the Pull Request");
    const pushed = run("git", ["push", "-u", "origin", branch], { quiet: true, capture: true });
    giveBack();
    if (pushed.code !== 0) {
      fail(`The push was refused, so GitHub does not have the update yet. It is kept on your local branch ${branch}.`);
      info(`  Run ${c.bold("Update my course")} again when you are online: it pushes that branch instead of making a new one.`);
      process.exitCode = 1;
      return;
    }
    ok("Pushed");
    if (open) {
      ok(`The open update Pull Request now carries the new changes too: ${c.cyan(prUrl)}`);
    } else {
      const body = [
        "Changes of the course since this fork was taken, merged from the main branch of the training repository.",
        "",
        ...missing.slice(0, 50).map((commit) => `- ${commit.subject}`),
        ...(missing.length > 50 ? [`- ... and ${missing.length - 50} more`] : []),
        "",
        "Merged by **Update my course** with a merge commit, not a squash: git then remembers what was brought in, and the next update only brings what is new."
      ].join("\n");
      prUrl = openPullRequest({ slug, base: UPDATE_BASE, branch, title: MERGE_MESSAGE, body });
      if (!prUrl || !/\/pull\/\d+$/.test(prUrl)) {
        fail("The Pull Request could not be opened.");
        info(`  The update is pushed on ${branch}. Run ${c.bold("Update my course")} again: it opens the Pull Request and goes on from there.`);
        process.exitCode = 1;
        return;
      }
      ok(`Pull Request opened into ${UPDATE_BASE}`);
      info(`  ${c.cyan(prUrl)}`);
    }
  }

  title("5 of 6  Waiting for its checks, then merging it");
  info(c.dim("  Mega-Linter and the deployment simulation usually take 3 to 5 minutes."));
  const checks = await waitForPullRequestChecks(slug, prUrl);
  if (!checks.ok) {
    fail(
      checks.timedOut
        ? "The checks of the update Pull Request did not finish in time, so it was not merged."
        : "A check of the update Pull Request failed, so it was not merged:"
    );
    checks.failed.forEach((check) => info(c.dim(`    ${check.name}`)));
    info(`  Open it to see why: ${c.cyan(prUrl)}`);
    info(`  Once it is fixed, or the checks are run again, click ${c.bold("Update my course")} again: it picks this Pull Request up and merges it.`);
    process.exitCode = 1;
    return;
  }
  ok(checks.none ? "No check ran on it (are GitHub Actions switched off on your fork?)" : "Every check passed");
  const merged = mergeUpdatePullRequest(slug, prUrl, MERGE_MESSAGE);
  if (!merged.ok) {
    fail("GitHub refused to merge the update Pull Request:");
    merged.message.split("\n").slice(0, 6).forEach((line) => info(c.dim(`    ${line}`)));
    info(`  Open it to see why: ${c.cyan(prUrl)}`);
    process.exitCode = 1;
    return;
  }
  ok(`Merged into ${UPDATE_BASE}`);
  // The branch has done its job, on GitHub and here
  run("git", ["push", "--quiet", "origin", "--delete", branch], { quiet: true, capture: true });
  run("git", ["branch", "-D", branch], { quiet: true, capture: true });

  title("6 of 6  Bringing it to your computer");
  bringHome();

  title("Done");
  ok("Your fork has the current course. Go on with the labs.");
  info(c.dim("  From Level 3 on, the update reaches uat, preprod and main with your next promotions, like any change."));
}
