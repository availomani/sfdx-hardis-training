/**
 * Training > Simulate my teammates.
 *
 * A learner cannot review a Pull Request that lives in somebody else's
 * repository, and Level 3 rebuilds part of the branch topology, so a
 * pre-existing branch would not even share a sensible ancestor.
 *
 * This recreates the teammate branch from the patch set in scripts/simulate/,
 * and opens the Pull Request inside the learner's own fork, at the moment the
 * lab needs it. The patch sets are the same files that produced the teammate
 * Pull Requests on the public training repo, so what a learner reviews is byte
 * for byte what the screenshots show.
 *
 * A scenario says where its work goes:
 *   base        the branch the Pull Request targets (integration by default)
 *   from        the branch it is cut from (base by default): preprod for a hotfix
 *   continues   true when it is the next commit of a teammate branch that
 *               already exists, after a review: the branch is kept, the commit
 *               is added, and a Pull Request is opened into base only when there
 *               is none yet (the hotfix going back into integration)
 */
import fs from "fs";
import path from "path";
import {
  ROOT, c, title, info, ok, warn, abort, run, git, gitOut,
  select, confirm, universe, hasGh, repoSlug
} from "../lib/util.mjs";

const SIMULATE_DIR = path.join(ROOT, "scripts", "simulate");

/**
 * Whether the fork already has an open Pull Request for that branch. `gh pr
 * create` fails the same way whether one exists, the network is down or gh is
 * signed out, and only the first of those is good news.
 */
function openPullRequestExists(slug, branch) {
  const listed = run(
    "gh",
    ["pr", "list", "-R", slug, "--head", branch, "--state", "open", "--json", "number"],
    { capture: true, quiet: true }
  );
  if (listed.code !== 0) {
    return false;
  }
  try {
    return JSON.parse(listed.stdout || "[]").length > 0;
  } catch {
    return false;
  }
}

export default async function simulate(args) {
  title("Simulate my teammates");

  const all = loadScenarios();
  if (all.length === 0) {
    abort("No teammate scenario was found.", `Expected folders with a scenario.json inside ${path.relative(ROOT, SIMULATE_DIR)}`);
  }

  // The Training menu of a level passes its own number, so the list only offers
  // the teammate work that level actually uses. Run without it and you get all
  // of them.
  const level = args.level ? Number(args.level) : null;
  const scenarios = level ? all.filter((s) => (s.levels || []).includes(level)) : all;
  if (scenarios.length === 0) {
    abort(`No teammate work is used by level ${level}.`, `Known scenarios: ${all.map((s) => s.id).join(", ")}`);
  }

  const id = await select(
    "Which teammate work do you need?",
    scenarios.map((s) => ({ value: s.id, label: `${s.title}`, hint: s.usedBy })),
    args.scenario
  );
  const scenario = scenarios.find((s) => s.id === id);

  // Somebody who changes an org rather than the repository: an admin in production
  if (scenario.kind === "org") {
    await simulateOrgChange(scenario, args);
    return;
  }

  const slug = repoSlug();
  if (slug && slug.toLowerCase() === universe().course.upstreamRepo.toLowerCase()) {
    abort(
      "This would open a Pull Request on the shared training repository.",
      "Work in your own fork. See Lab 1.2."
    );
  }

  const base = scenario.base || "integration";
  const from = scenario.from || base;
  info("");
  info(`  ${scenario.description}`);
  info("");
  if (scenario.continues) {
    info(`  It continues the branch ${c.bold(scenario.branch)} of your teammate,`);
    info(`  and its Pull Request into ${c.bold(base)} in ${c.bold(slug || "your fork")}.`);
  } else {
    info(`  It creates the branch ${c.bold(scenario.branch)} from your current ${c.bold(from)},`);
    info(`  and opens a Pull Request into ${c.bold(base)} in ${c.bold(slug || "your fork")}.`);
  }

  const sure = args.yes === true || (await confirm("Create it?", true));
  if (!sure) {
    info("Nothing was created.");
    return;
  }

  const startingBranch = gitOut(["rev-parse", "--abbrev-ref", "HEAD"]);
  // Uncommitted work, a configuration change not published yet for instance, is put
  // aside while the teammate branch is built, and put back on the branch the learner
  // was on, whatever happens in between
  // Set below from the exit code of the stash itself, never from the working
  // tree being dirty: git refuses to stash during an unresolved merge, which is
  // the state Labs 2.7 and 3.4 put a learner in on purpose, and the recovery
  // path further down deletes files on the strength of this flag.
  let stashed = false;
  const restore = () => {
    run("git", ["checkout", startingBranch && startingBranch !== scenario.branch ? startingBranch : "integration"], { quiet: true });
    if (stashed) {
      stashed = false;
      if (run("git", ["stash", "pop"], { quiet: true }).code === 0) {
        ok("Your uncommitted changes are back where they were");
      } else {
        warn("Your uncommitted changes could not be put back automatically. They are in the latest stash: Source Control panel, Stashes, Pop Latest Stash.");
      }
    }
  };
  if (gitOut(["status", "--porcelain"]) !== "") {
    stashed =
      run("git", ["stash", "push", "--include-untracked", "-m", "Simulate my teammates: uncommitted work"], {
        quiet: true
      }).code === 0;
    if (stashed) {
      info("  Your uncommitted changes are put aside while the teammate branch is built, and put back at the end.");
      process.on("exit", () => stashed && restore());
    } else {
      abort(
        "Your uncommitted changes could not be put aside, so nothing was simulated.",
        "Git refuses to stash during an unresolved merge. Finish or abandon it, then run Simulate my teammates again."
      );
    }
  }

  title("1 of 4  Creating the teammate branch");
  run("git", ["fetch", "origin", "--prune"]);
  if (scenario.continues) {
    if (!gitOut(["rev-parse", "--verify", "--quiet", `origin/${scenario.branch}`])) {
      abort(
        `Your teammate's branch ${scenario.branch} is not in your fork yet.`,
        "Run the teammate work that starts it first, from the same Simulate my teammates list."
      );
    }
    run("git", ["checkout", "-B", scenario.branch, `origin/${scenario.branch}`], { quiet: true });
  } else {
    if (run("git", ["checkout", from]).code !== 0) {
      abort(`There is no ${from} branch to branch from.`, "Run Reset this level first, from the Training menu of your level.");
    }
    run("git", ["pull", "--ff-only", "origin", from], { quiet: true });
    const existing = gitOut(["rev-parse", "--verify", scenario.branch]);
    if (existing) {
      warn(`${scenario.branch} already exists. It is being recreated from the current ${from}.`);
      if (run("git", ["branch", "-D", scenario.branch]).code !== 0) {
        restore();
        abort(`The old ${scenario.branch} could not be deleted, so nothing was simulated.`);
      }
    }
    // Checked: on a failure HEAD stays where it is, and the teammate files
    // would be committed to that branch instead
    if (run("git", ["checkout", "-b", scenario.branch]).code !== 0) {
      restore();
      abort(`The branch ${scenario.branch} could not be created, so nothing was simulated.`);
    }
  }
  ok(`On ${scenario.branch}`);

  title("2 of 4  Applying the teammate changes");
  const planned = planPatches(scenario);
  const applied = [...applyFiles(scenario), ...writePlanned(planned)];
  applied.forEach((f) => info(c.dim(`    ${f}`)));
  ok(`${applied.length} file(s) written`);

  title("3 of 4  Committing as your teammate");
  run("git", ["add", "-A"]);
  const hasChanges = gitOut(["status", "--porcelain"]) !== "";
  if (hasChanges) {
    // The message goes through a file: on Windows the shell stops an argument at
    // its first line break, and the body would be lost
    const messageFile = path.join(ROOT, ".training-commit-message.txt");
    fs.writeFileSync(messageFile, scenario.commitMessage, "utf8");
    const commit = run("git", [
      "-c", `user.name=${scenario.author.name}`,
      "-c", `user.email=${scenario.author.email}`,
      "commit", "-F", messageFile
    ]);
    fs.rmSync(messageFile, { force: true });
    if (commit.code !== 0) {
      // The teammate files go. Safe because nothing of the learner's is in the
      // working tree: it was either clean or stashed, and a stash that failed
      // stopped the command above.
      run("git", ["reset", "--hard", "--quiet"]);
      run("git", ["clean", "-fdq"]);
      restore();
      abort(
        "Your teammate's commit could not be made.",
        "Git refused it: the message above says why. Nothing was pushed."
      );
    }
    ok("Committed");
  } else if (scenario.continues) {
    ok("Nothing new to commit: the branch goes as it is");
  } else {
    warn(`Nothing to commit: the teammate changes are already in your ${from} branch.`);
    restore();
    return;
  }

  title("4 of 4  Opening the Pull Request in your fork");
  const push = run("git", ["push", "-u", "origin", scenario.branch, "--force-with-lease"]);
  if (push.code !== 0) {
    abort("The branch could not be pushed to your fork.", "Check that origin points at your own fork and that you can push to it.");
  }

  if (!hasGh()) {
    warn("The GitHub CLI is not installed, so the Pull Request was not opened automatically.");
    info(`  Open it yourself: ${c.cyan(`https://github.com/${slug}/compare/${base}...${scenario.branch}?expand=1`)}`);
  } else {
    const bodyFile = path.join(ROOT, ".training-pr-body.md");
    fs.writeFileSync(bodyFile, scenario.prBody, "utf8");
    // GitHub needs a moment after a push before its API can see the new branch.
    // Asked too soon it answers "No commits between <base> and <head>", which
    // reads like the push failed when it did not. Three tries, two seconds apart,
    // has been enough every time. The command writes straight to the terminal,
    // so its message cannot be inspected here: any failure is retried, and the
    // fallback below still covers a Pull Request that genuinely already exists.
    let pr = { code: 1, stderr: "" };
    for (let attempt = 1; attempt <= 3; attempt++) {
      pr = run("gh", [
        "pr", "create",
        // Named explicitly: in a fork with no default repository set, gh picks
        // the parent, the shared training repository, as the base
        "--repo", slug,
        "--base", base,
        "--head", scenario.branch,
        "--title", scenario.prTitle,
        "--body-file", bodyFile
      ]);
      if (pr.code === 0) {
        break;
      }
      if (attempt < 3) {
        info(`  The branch is not visible to the GitHub API yet, retrying (${attempt} of 3)`);
        run(process.execPath, ["-e", "const t = Date.now(); while (Date.now() - t < 2000) {}"], { quiet: true });
      }
    }
    fs.rmSync(bodyFile, { force: true });
    // "It already exists" is the only failure that means success here, and the
    // way to know is to ask the fork rather than to assume
    const alreadyOpen = pr.code !== 0 && openPullRequestExists(slug, scenario.branch);
    if (alreadyOpen) {
      ok("The new commit is on the Pull Request your teammate already opened");
    } else if (pr.code !== 0) {
      warn("The Pull Request could not be opened automatically. It may already exist.");
      info(`  Check: ${c.cyan(`https://github.com/${slug}/pulls`)}`);
    } else {
      ok("Pull Request opened");
    }
  }

  restore();

  title("Done");
  info(`  ${scenario.nextStep}`);
}

/**
 * A change made live in an org, the way an admin does it in Setup: nothing in git, no Pull
 * Request. It is applied at the moment the lab needs it, because the next release that touches
 * the same component would otherwise have removed it before anybody went looking.
 */
async function simulateOrgChange(scenario, args) {
  info("");
  info(`  ${scenario.description}`);
  info("");
  info(`  It changes ${c.bold(scenario.org)} directly, the way it happened. Nothing in your repository changes.`);
  const sure = args.yes === true || (await confirm("Make the change?", true));
  if (!sure) {
    info("Nothing was changed.");
    return;
  }
  const { addPicklistValue } = await import("./seed.mjs");
  title(`Changing ${scenario.org}`);
  if (scenario.change.type !== "picklist-value" || !addPicklistValue(scenario.org, scenario.change)) {
    abort(
      `The change could not be made in ${scenario.org}.`,
      `Check that ${scenario.org} is connected in Orgs Manager, then run this again.`
    );
  }
  ok(`${scenario.change.object}.${scenario.change.field} now offers ${c.bold(scenario.change.value)} in ${scenario.org}`);
  title("Done");
  info(`  ${scenario.nextStep}`);
}

function loadScenarios() {
  if (!fs.existsSync(SIMULATE_DIR)) {
    return [];
  }
  return fs.readdirSync(SIMULATE_DIR)
    .map((name) => path.join(SIMULATE_DIR, name, "scenario.json"))
    .filter((p) => fs.existsSync(p))
    .map((p) => ({ ...JSON.parse(fs.readFileSync(p, "utf8")), dir: path.dirname(p) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Applies the patches of a scenario to files that already exist.
 *
 * A permission set or a layout belongs to everybody: several stories add to the
 * same file, and the learner has usually added to it too. Copying a snapshot
 * over it would take their work back out without a word, so a teammate says
 * what it adds and what it removes, and nothing else changes.
 *
 * Each patch is { file, block, insertBefore | insertAfter | remove }, { file, replace: { from, to } },
 * or one of the structural patches of applyStructuralPatch below. A replace works whatever the line
 * endings of the learner's working copy.
 */
function planPatches(scenario) {
  // Every patch is worked out in memory first, and nothing is written until all
  // of them fit: a scenario that stopped half way used to leave the permission
  // set changed and the field file written, on a branch the learner never asked for.
  const planned = new Map();
  for (const patch of scenario.patches || []) {
    const target = path.join(ROOT, patch.file);
    if (!planned.has(target) && !fs.existsSync(target)) {
      abort(
        `The teammate change expects ${patch.file}, which is not in your project.`,
        "Reset the level from the Training menu, then run this again."
      );
    }
    let content = planned.has(target) ? planned.get(target) : fs.readFileSync(target, "utf8");
    if (patch.fieldPermission || patch.layoutField || patch.removeLayoutField) {
      planned.set(target, applyStructuralPatch(patch, content));
      continue;
    }
    if (patch.replace) {
      const eol = content.includes("\r\n") ? "\r\n" : "\n";
      const fromText = patch.replace.from.replace(/\r?\n/g, eol);
      const toText = patch.replace.to.replace(/\r?\n/g, eol);
      if (content.includes(toText)) {
        warn(`${patch.file} already carries this change.`);
      } else if (!content.includes(fromText)) {
        abort(
          `The teammate change cannot be placed in ${patch.file}.`,
          "Reset the level from the Training menu, then run this again."
        );
      } else {
        content = content.replace(fromText, toText);
      }
      planned.set(target, content);
      continue;
    }
    if (patch.remove) {
      if (!content.includes(patch.remove)) {
        warn(`Nothing to remove in ${patch.file}: it was already gone.`);
      }
      content = content.replace(patch.remove, "");
    }
    if (patch.block) {
      if (content.includes(patch.block.trim())) {
        warn(`${patch.file} already carries this change.`);
      } else {
        const anchor = patch.insertBefore || patch.insertAfter;
        if (!anchor || !content.includes(anchor)) {
          abort(
            `The teammate change cannot be placed in ${patch.file}.`,
            "Reset the level from the Training menu, then run this again."
          );
        }
        const at = content.indexOf(anchor) + (patch.insertAfter ? anchor.length : 0);
        content = content.slice(0, at) + patch.block + content.slice(at);
      }
    }
    planned.set(target, content);
  }
  return planned;
}

function writePlanned(planned) {
  const written = [];
  for (const [target, content] of planned) {
    fs.writeFileSync(target, content, "utf8");
    written.push(`${path.relative(ROOT, target).replace(/\\/g, "/")} (patched)`);
  }
  return written;
}

/**
 * A teammate change described by what it means rather than by the text around it.
 *
 * Anchoring on exact lines broke as soon as a file was formatted differently, and
 * a permission inserted at the top of the file put it where Salesforce never does:
 * the learner's next retrieve then showed it moving, a diff about nothing. These
 * find their place the way Salesforce orders the file.
 *
 *   { fieldPermission: { field, editable, readable } }   in alphabetical order
 *   { layoutField: "X", after: "Y" }                      layout item X after item Y
 *   { removeLayoutField: "Z" }                            layout item Z removed
 */
function applyStructuralPatch(patch, content) {
  const cannot = () =>
    abort(`The teammate change cannot be placed in ${patch.file}.`, "Reset the level from the Training menu, then run this again.");

  if (patch.fieldPermission) {
    const { field, editable, readable } = patch.fieldPermission;
    const blocks = [...content.matchAll(/( *)<fieldPermissions>[\s\S]*?<field>([^<]+)<\/field>[\s\S]*?<\/fieldPermissions>\r?\n/g)];
    if (blocks.some((m) => m[2] === field)) {
      warn(`${patch.file} already carries this change.`);
      return content;
    }
    if (blocks.length === 0) {
      cannot();
    }
    const indent = blocks[0][1];
    const inner = `${indent}    `;
    const block =
      `${indent}<fieldPermissions>\n${inner}<editable>${editable === true}</editable>\n` +
      `${inner}<field>${field}</field>\n${inner}<readable>${readable !== false}</readable>\n${indent}</fieldPermissions>\n`;
    const next = blocks.find((m) => m[2].localeCompare(field, "en") > 0);
    const at = next ? next.index : blocks[blocks.length - 1].index + blocks[blocks.length - 1][0].length;
    return content.slice(0, at) + block + content.slice(at);
  }

  const itemOf = (name) =>
    new RegExp(`( *)<layoutItems>\\s*<behavior>[^<]*</behavior>\\s*<field>${name}</field>\\s*</layoutItems>\\r?\\n`).exec(content);

  if (patch.removeLayoutField) {
    const item = itemOf(patch.removeLayoutField);
    if (!item) {
      warn(`Nothing to remove in ${patch.file}: it was already gone.`);
      return content;
    }
    return content.slice(0, item.index) + content.slice(item.index + item[0].length);
  }

  if (itemOf(patch.layoutField)) {
    warn(`${patch.file} already carries this change.`);
    return content;
  }
  const anchor = itemOf(patch.after);
  if (!anchor) {
    cannot();
  }
  const indent = anchor[1];
  const block =
    `${indent}<layoutItems>\n${indent}    <behavior>${patch.behavior || "Edit"}</behavior>\n` +
    `${indent}    <field>${patch.layoutField}</field>\n${indent}</layoutItems>\n`;
  const at = anchor.index + anchor[0].length;
  return content.slice(0, at) + block + content.slice(at);
}

function applyFiles(scenario) {
  const filesDir = path.join(scenario.dir, "files");
  if (!fs.existsSync(filesDir)) {
    return [];
  }
  const written = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(from, relPath);
      } else {
        const to = path.join(ROOT, relPath);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        written.push(relPath);
      }
    }
  };
  walk(filesDir, "");
  for (const gone of scenario.deletes || []) {
    const target = path.join(ROOT, gone);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      written.push(`${gone} (deleted)`);
    }
  }
  return written;
}
