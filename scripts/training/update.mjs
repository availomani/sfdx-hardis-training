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
 * integration: the one way anything reaches a major branch in this course. The
 * learner merges it with Merge pull request, never a squash, so that git
 * remembers what was brought in and the next update only brings what is new.
 *
 * One update at a time: when an update Pull Request is already open, the new
 * course changes are merged into its branch, and the same Pull Request carries
 * them. A branch whose push failed is pushed on the next run instead of being
 * made again.
 *
 * Nothing the learner built is thrown away, unlike Reset this level. A file
 * that both the learner and the course changed stops the merge: the command
 * undoes it and says which files, rather than leaving a half merge behind.
 */
import { c, title, info, ok, warn, fail, abort, run, gitOut, confirm, repoSlug, stamp, openPullRequest } from "../lib/util.mjs";
import {
  UPDATE_BASE,
  UPDATE_BRANCH_PREFIX,
  ensureCourseUpstream,
  fetchCourse,
  missingCourseCommits,
  openUpdatePullRequest
} from "../lib/course-updates.mjs";

const MERGE_MESSAGE = "Update the course from the training repository";

/** A local update branch that already holds every course change and never reached GitHub. */
function unpushedUpdateBranch() {
  const local = gitOut(["branch", "--list", `${UPDATE_BRANCH_PREFIX}*`, "--format=%(refname:short)"])
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return local.find((b) => !gitOut(["ls-remote", "--heads", "origin", b]) && missingCourseCommits(b).length === 0) || null;
}

/** Where the learner is, as something git switch can go back to, detached or not. */
function currentPosition() {
  const name = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  return name && name !== "HEAD" ? { args: [name], label: name } : { args: ["--detach", gitOut(["rev-parse", "HEAD"])], label: "the commit you were on" };
}

export default async function update(args) {
  title("Update my course");

  if (!ensureCourseUpstream()) {
    abort(
      "This folder is not your fork of the course, so there is nothing to update it from.",
      "Run Set up my training environment first: it creates your fork and points this folder at it."
    );
  }

  title("1 of 4  What changed in the course");
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
  if (open && missingCourseCommits(`origin/${open.branch}`).length === 0) {
    ok(`Your update is waiting in its Pull Request: ${c.cyan(open.url)}`);
    info(`  Merge it into ${UPDATE_BASE} with ${c.bold("Merge pull request")}, never a squash, then Pull in the Source Control panel.`);
    return;
  }
  info(`  ${missing.length} change(s) of the course your fork does not have yet:`);
  missing.slice(0, 15).forEach((commit) => info(c.dim(`    ${commit.subject}`)));
  if (missing.length > 15) {
    info(c.dim(`    ... and ${missing.length - 15} more`));
  }
  info(c.dim("  Changes to the lab pages, the translations, the site and the badges are left out: you read those on the site."));

  const unpushed = open ? null : unpushedUpdateBranch();
  const branch = open ? open.branch : unpushed || args.branch || `${UPDATE_BRANCH_PREFIX}${stamp()}`;
  const question = open
    ? `Add them to the update Pull Request that is already open, from ${branch}?`
    : unpushed
      ? `Push ${branch}, the update made last time, and open its Pull Request into ${UPDATE_BASE}?`
      : `Bring them in on a new branch, ${branch}, and open a Pull Request into ${UPDATE_BASE}?`;
  info("");
  const sure = args.yes === true || (await confirm(question, true));
  if (!sure) {
    info("Nothing was changed.");
    return;
  }

  // Whatever the learner is in the middle of stays where it is: put aside now,
  // given back at the end, where they were
  const previous = currentPosition();
  const dirty = gitOut(["status", "--porcelain"]) !== "";
  if (dirty) {
    warn("You have uncommitted changes. They are put aside during the update and given back afterwards.");
    if (run("git", ["stash", "push", "-u", "-m", "before Update my course"], { quiet: true, capture: true }).code !== 0) {
      abort(
        "Your uncommitted changes could not be put aside, so nothing was updated.",
        "Git refuses during an unfinished merge. Finish or abandon it in the Source Control panel, then run Update my course again."
      );
    }
  }
  const giveBack = () => {
    if (run("git", ["switch", ...previous.args], { quiet: true, capture: true }).code !== 0) {
      warn(`Could not go back to ${previous.label}.${dirty ? " Your uncommitted changes stay in the git stash: Source Control panel, Stashes, Apply Stash." : ""}`);
      return;
    }
    if (dirty) {
      if (run("git", ["stash", "pop"], { quiet: true, capture: true }).code === 0) {
        ok("Your uncommitted changes are back");
      } else {
        warn("Your uncommitted changes are kept in the git stash: Source Control panel, Stashes, Apply Stash.");
      }
    }
  };

  title("2 of 4  A branch for the update");
  const checkout = open
    ? run("git", ["switch", "-C", branch, `origin/${branch}`], { quiet: true, capture: true })
    : unpushed
      ? run("git", ["switch", branch], { quiet: true, capture: true })
      : run("git", ["switch", "--no-track", "-c", branch, `origin/${UPDATE_BASE}`], { quiet: true, capture: true });
  if (checkout.code !== 0) {
    giveBack();
    abort(`The branch ${branch} could not be checked out.`, (checkout.stderr || "").trim() || "Run Update my course again.");
  }
  ok(open ? `On ${branch}, the branch of the open update` : unpushed ? `On ${branch}, made last time` : `On ${branch}, made from the ${UPDATE_BASE} of your fork`);

  title("3 of 4  Merging the course into it");
  if (unpushed) {
    ok("Already merged last time");
  } else {
    const merged = run("git", ["merge", "--no-edit", "-m", MERGE_MESSAGE, "upstream/main"], { capture: true, quiet: true });
    if (merged.code !== 0) {
      const conflicts = gitOut(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
      // Only a merge that started can be aborted: a missing git identity or an
      // unrelated history stops git before anything is merged
      if (run("git", ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], { quiet: true, capture: true }).code === 0) {
        run("git", ["merge", "--abort"], { quiet: true, capture: true });
      }
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

  title("4 of 4  Pushing it and opening the Pull Request");
  const pushed = run("git", ["push", "-u", "origin", branch], { quiet: true, capture: true });
  giveBack();
  if (pushed.code !== 0) {
    fail(`The push was refused, so GitHub does not have the update yet. It is kept on your local branch ${branch}.`);
    info(`  Run ${c.bold("Update my course")} again when you are online: it pushes that branch instead of making a new one.`);
    process.exitCode = 1;
    return;
  }
  ok("Pushed");
  const slug = repoSlug();
  if (open) {
    ok(`The open update Pull Request now carries the new changes too: ${c.cyan(open.url)}`);
  } else {
    const body = [
      "Changes of the course since this fork was taken, merged from the main branch of the training repository.",
      "",
      ...missing.slice(0, 50).map((commit) => `- ${commit.subject}`),
      ...(missing.length > 50 ? [`- ... and ${missing.length - 50} more`] : []),
      "",
      "Merge it with **Merge pull request**, not with a squash: git then remembers what was brought in, and the next update only brings what is new."
    ].join("\n");
    const prUrl = openPullRequest({ slug, base: UPDATE_BASE, branch, title: MERGE_MESSAGE, body });
    if (prUrl) {
      ok(`Pull Request opened into ${UPDATE_BASE}`);
      info(`  ${c.cyan(prUrl)}`);
    } else {
      warn("The Pull Request could not be opened automatically.");
      info(`  Open it yourself: ${c.cyan(`https://github.com/${slug}/compare/${UPDATE_BASE}...${branch}?expand=1`)}`);
    }
  }

  title("Done");
  info(`  Wait for the checks of the Pull Request, then merge it with ${c.bold("Merge pull request")}, never a squash.`);
  info(`  Then Pull in the Source Control panel, on ${UPDATE_BASE}: the training commands use the new scripts from there.`);
  info(c.dim("  From Level 3 on, the update reaches uat, preprod and main with your next promotions, like any change."));
}
