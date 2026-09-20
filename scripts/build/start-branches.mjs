#!/usr/bin/env node
/**
 * Creates the training/start-level-N branches that "Training > Reset this level"
 * resets to.
 *
 *   node scripts/build/start-branches.mjs --dry-run
 *   node scripts/build/start-branches.mjs --level 2
 *   node scripts/build/start-branches.mjs --push
 *
 * Run it from `main`, after the training Pull Request has merged. Each branch is
 * built from the one before it, by applying the deliverables of the level that
 * comes first:
 *
 *   training/start-level-1   main as it ships. A Level 1 learner starts here
 *   training/start-level-2   plus everything Level 1 delivers
 *   training/start-level-3   plus everything Level 2 delivers
 *
 * The deltas live in scripts/start-states/level-N/, as plain files copied over
 * the working tree, exactly like the teammate scenarios in scripts/simulate/.
 * That keeps them reviewable: a reviewer reads the files, not a patch.
 *
 * A level with no delta folder is skipped with a message rather than created
 * empty, because a reset branch that resets to the wrong state is worse than one
 * that is honestly missing.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const STATES = path.join(ROOT, "scripts", "start-states");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const PUSH = args.includes("--push");
// --check builds the branches locally, compares each tree with the published
// one, and writes nothing. It is what stops the release being declared done
// while "Reset this level" still points at branches nobody pushed.
const CHECK = args.includes("--check");
const levelIndex = args.indexOf("--level");
const ONLY = levelIndex > -1 ? Number(args[levelIndex + 1]) : null;

function git(argv, options = {}) {
  const res = spawnSync("git", argv, { cwd: ROOT, encoding: "utf8", ...options });
  if (res.status !== 0 && !options.allowFailure) {
    console.error(`git ${argv.join(" ")} failed:`);
    console.error((res.stderr || res.stdout || "").trim());
    process.exit(1);
  }
  return (res.stdout || "").trim();
}

function copyTree(from, to) {
  const written = [];
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const source = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(source, relPath);
      } else {
        const target = path.join(to, relPath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
        written.push(relPath);
      }
    }
  };
  walk(from, "");
  return written;
}

const branchName = (level) => `training/start-level-${level}`;

const dirty = git(["status", "--porcelain"]);
if (dirty && !DRY) {
  console.error("The working tree is not clean. Commit or stash first.");
  process.exit(1);
}

const startingBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
console.log(`Building the reset branches from ${startingBranch}.`);
console.log("");

let previous = startingBranch;

for (const level of [1, 2, 3]) {
  if (ONLY !== null && level !== ONLY) {
    previous = branchName(level);
    continue;
  }
  const branch = branchName(level);
  const deltaDir = path.join(STATES, `level-${level}`, "files");
  const deltaMeta = path.join(STATES, `level-${level}`, "state.json");

  if (level === 1) {
    console.log(`${branch}: main as it ships, no delta to apply.`);
    if (!DRY) {
      git(["checkout", "-B", branch, startingBranch]);
      if (PUSH) {
        git(["push", "--force-with-lease", "origin", branch]);
      }
    }
    previous = branch;
    continue;
  }

  if (!fs.existsSync(deltaDir)) {
    console.log(`${branch}: SKIPPED.`);
    console.log(`    scripts/start-states/level-${level}/files/ does not exist yet.`);
    console.log(`    It holds what level ${level - 1} delivers, which is what a learner joining`);
    console.log(`    at level ${level} has to start from. Build it by walking level ${level - 1}`);
    console.log("    and copying the resulting sources into that folder.");
    console.log("");
    continue;
  }

  const meta = fs.existsSync(deltaMeta) ? JSON.parse(fs.readFileSync(deltaMeta, "utf8")) : {};
  console.log(`${branch}: ${previous} plus what level ${level - 1} delivers.`);

  if (DRY) {
    const files = [];
    const walk = (dir, rel) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(dir, entry.name), relPath);
        } else {
          files.push(relPath);
        }
      }
    };
    walk(deltaDir, "");
    files.forEach((f) => console.log(`    ${f}`));
    console.log("");
    previous = branch;
    continue;
  }

  git(["checkout", "-B", branch, previous]);
  const written = copyTree(deltaDir, ROOT);
  for (const gone of meta.deletes || []) {
    const target = path.join(ROOT, gone);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      written.push(`${gone} (deleted)`);
    }
  }
  written.forEach((f) => console.log(`    ${f}`));

  git(["add", "-A"]);
  const message = meta.message || `chore: the state a level ${level} learner starts from`;
  const commit = spawnSync("git", ["commit", "-m", message], { cwd: ROOT, encoding: "utf8" });
  if (commit.status !== 0 && !/nothing to commit/i.test(commit.stdout || "")) {
    console.error((commit.stderr || commit.stdout || "").trim());
    process.exit(1);
  }
  if (PUSH) {
    git(["push", "--force-with-lease", "origin", branch]);
  }
  console.log("");
  previous = branch;
}

if (!DRY) {
  git(["checkout", startingBranch]);
}

// --check: every branch has to be published, and to hold what the generator
// just built. A stale one is worse than a missing one, because "Reset this
// level" then drops a learner into a state the current labs no longer describe.
if (CHECK) {
  const problems = [];
  for (const level of [1, 2, 3]) {
    const branch = branchName(level);
    const built = git(["rev-parse", `${branch}^{tree}`]);
    const published = spawnSync("git", ["rev-parse", `origin/${branch}^{tree}`], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (published.status !== 0) {
      problems.push(`${branch} is not published. Run: node scripts/build/start-branches.mjs --push`);
      continue;
    }
    if (published.stdout.trim() !== built) {
      problems.push(`${branch} is published but stale. Run: node scripts/build/start-branches.mjs --push`);
    }
  }
  if (problems.length > 0) {
    console.error("");
    console.error(`${problems.length} problem(s) with the reset branches:`);
    problems.forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }
  console.log("");
  console.log("Every reset branch is published and current.");
}

console.log(DRY ? "Dry run: nothing was created." : PUSH ? "Created and pushed." : "Created locally. Add --push to publish them.");
