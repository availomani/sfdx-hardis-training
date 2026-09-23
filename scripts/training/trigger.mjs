/**
 * Training > Trigger my workflows.
 *
 * GitHub parks the workflows of a new fork until somebody says they may run.
 * Once they are allowed, the Pull Requests opened while they were parked stay
 * empty: GitHub does not go back and start the checks it skipped, and a learner
 * reads that as "my Pull Request is broken".
 *
 * A push is what starts them. So this writes one managed line in README.md,
 * commits it and pushes it, and the checks of the open Pull Request start.
 *
 * It exists for a fork, and only for a fork. Nothing on a real project needs
 * it, which is why it says so every time it runs.
 */
import fs from "fs";
import path from "path";
import {
  ROOT, c, title, info, ok, warn, abort, run, git, gitOut, confirm, repoSlug
} from "../lib/util.mjs";

const README = path.join(ROOT, "README.md");
const START = "<!-- workflow-trigger:start -->";
const END = "<!-- workflow-trigger:end -->";

/** Branches nobody pushes to directly: a Pull Request is the only way in. */
const PROTECTED = ["main", "integration", "uat", "preprod"];

function ghJson(args) {
  const res = run("gh", args, { capture: true, quiet: true });
  if (res.code !== 0) {
    return null;
  }
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

/**
 * The line README.md carries, rewritten in place rather than appended, so a
 * learner who runs this five times does not end up with five of them.
 */
function stampReadme() {
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const block = `${START}\n<!-- Training setup: a push is what starts the workflows of a fork. ${stamp} -->\n${END}`;
  const previous = fs.readFileSync(README, "utf8");
  const eol = previous.includes("\r\n") ? "\r\n" : "\n";
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
  const next = pattern.test(previous)
    ? previous.replace(pattern, block.split("\n").join(eol))
    : `${previous.replace(/\s*$/, "")}${eol}${eol}${block.split("\n").join(eol)}${eol}`;
  fs.writeFileSync(README, next, "utf8");
}

export default async function trigger(args) {
  title("Trigger my workflows");

  const slug = repoSlug();
  if (!slug) {
    abort("This folder has no GitHub remote.", "Run Set up my training environment first.");
  }

  // Pushing before the switch is flipped wastes the push: GitHub skips the run
  // and there is nothing to go back to.
  const permissions = ghJson(["api", `repos/${slug}/actions/permissions`]);
  const listed = ghJson(["api", `repos/${slug}/actions/workflows`, "--paginate"]);
  const parked = (listed?.workflows || []).filter((workflow) => workflow.state !== "active");
  if (permissions?.enabled !== true || parked.length > 0) {
    warn("The workflows of your fork are not allowed to run yet, so pushing would change nothing.");
    info("");
    info(`    Open ${c.cyan(`https://github.com/${slug}/actions`)} and click`);
    info(`    ${c.bold("I understand my workflows, go ahead and enable them")}.`);
    info("    Then run this again.");
    process.exitCode = 1;
    return;
  }

  const branch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (PROTECTED.includes(branch)) {
    abort(
      `You are on ${branch}, which takes changes through a Pull Request only.`,
      "Switch to your User Story branch and run this again."
    );
  }

  if (gitOut(["status", "--porcelain"])) {
    abort(
      "You have uncommitted changes.",
      "Commit or stash them first: this command makes a commit of its own and will not mix it with yours."
    );
  }

  info(`  This adds one commented line to ${c.bold("README.md")} on ${c.bold(branch)}, and pushes it.`);
  info(c.dim("    It changes no Salesforce metadata, so the deployment check sees exactly what it saw before."));
  info(c.dim("    It is a fork thing. On a real project the workflows already run and nothing needs this."));
  const sure = args.yes === true || (await confirm(`Push a commit to ${branch}?`, true));
  if (!sure) {
    info("Nothing was changed.");
    return;
  }

  stampReadme();
  git(["add", "--", "README.md"]);
  if (git(["commit", "-m", "chore: trigger the workflows of this fork"], { capture: true, quiet: true }).code !== 0) {
    abort("Nothing to commit.", "README.md already carries this line. Edit it by hand and run this again.");
  }
  if (git(["push", "origin", branch], { capture: true, quiet: true }).code !== 0) {
    abort(
      `The push to ${branch} failed.`,
      "Sign in to GitHub in VS Code (Accounts, bottom left), then run this again."
    );
  }

  ok(`Pushed to ${c.bold(branch)}. The checks start within a few seconds.`);
  const prs = ghJson(["pr", "list", "--head", branch, "--json", "number,url", "--limit", "1"]);
  if (prs?.length) {
    info(`  Watch them on ${c.cyan(`${prs[0].url}/checks`)}`);
  } else {
    info(`  Watch them on ${c.cyan(`https://github.com/${slug}/actions`)}`);
  }
}
