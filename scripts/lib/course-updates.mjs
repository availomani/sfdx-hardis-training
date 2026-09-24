/**
 * Whether the learner's fork is behind the course.
 *
 * A fork is a copy taken on the day the learner forked. The lab pages are read
 * on the published site and are always current, but the scripts behind the
 * Training menu, the teammate stories, the Check my work rules and the project
 * configuration live in the fork, and they age. A lab published after the fork
 * was taken can need a teammate story or a check rule the fork does not have.
 *
 * This compares the fork's integration branch with the main branch of the
 * training repository, the upstream remote that Set up my training environment
 * declares. Only commits that change something the fork runs count: a badge
 * claim, a lab page, a translation or the site change nothing a training
 * command or a CI job of the fork reads, and nagging about them would teach
 * learners to ignore the message.
 */
import { c, info, warn, run, gitOut, universe, hasGh } from "./util.mjs";

/**
 * What the fork never runs: badge claims, the lab pages and their images, the
 * translations, the site, the documentation. Everything else counts, the
 * scripts, config/, force-app/, manifest/, .github/ and training-universe.json
 * first.
 */
const NOT_RUN_BY_THE_FORK = [
  /^badges\//,
  /^labs\//,
  /^i18n\//,
  /^site-theme\//,
  /^site-overrides\//,
  /^site-src\//,
  /^course-site\.yml$/,
  /^mkdocs-nav\.yml$/,
  /^training-manifest\.json$/,
  /^[^/]+\.md$/
];

/** The branch the update is compared with and merged into. */
export const UPDATE_BASE = "integration";

/** The prefix of the branches Update my course creates. */
export const UPDATE_BRANCH_PREFIX = "course/update-";

function remoteUrl(name) {
  return gitOut(["remote", "get-url", name]);
}

function slugOf(url) {
  const match = (url || "").match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * True when there is a training repository to compare with: an upstream remote
 * that is not the fork itself. Before Set up my training environment ran, the
 * clone's origin is the training repository and there is nothing to compare.
 */
export function hasCourseUpstream() {
  const upstream = slugOf(remoteUrl("upstream"));
  const origin = slugOf(remoteUrl("origin"));
  return Boolean(upstream && origin && upstream.toLowerCase() !== origin.toLowerCase());
}

/** Adds the upstream remote when a clone lost it. Returns false when it cannot. */
export function ensureCourseUpstream() {
  if (hasCourseUpstream()) {
    return true;
  }
  const origin = slugOf(remoteUrl("origin"));
  const upstreamRepo = universe().course.upstreamRepo;
  if (!origin || origin.toLowerCase() === upstreamRepo.toLowerCase() || remoteUrl("upstream")) {
    return false;
  }
  info(c.dim("    Adding the training repository as the upstream remote."));
  run("git", ["remote", "add", "upstream", `https://github.com/${upstreamRepo}.git`], { quiet: true });
  return hasCourseUpstream();
}

/**
 * Fetches the two refs the comparison reads, and nothing else: the main branch
 * of the course and the integration branch of the fork, which moves on GitHub
 * whenever the learner merges a Pull Request there. Quiet and forgiving:
 * offline, the check has nothing new to say and the command carries on.
 */
export function fetchCourse() {
  const env = { GIT_TERMINAL_PROMPT: "0" };
  const upstream = run("git", ["fetch", "--quiet", "upstream", "main"], { quiet: true, capture: true, env });
  run("git", ["fetch", "--quiet", "origin", UPDATE_BASE], { quiet: true, capture: true, env });
  return upstream.code === 0;
}

function refExists(ref) {
  return run("git", ["rev-parse", "--verify", "--quiet", ref], { quiet: true, capture: true }).code === 0;
}

/**
 * The commits of the training repository the given branch does not have, the
 * ones that change nothing the fork runs left out, newest first:
 * [{ sha, subject }].
 */
export function missingCourseCommits(ref = `origin/${UPDATE_BASE}`) {
  if (!refExists("upstream/main") || !refExists(ref)) {
    return [];
  }
  const raw = run(
    "git",
    ["log", "--no-merges", "--format=%x00%h%x09%s", "--name-only", "upstream/main", `^${ref}`],
    { quiet: true, capture: true }
  ).stdout;
  return raw
    .split("\0")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [header, ...files] = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const [sha, ...subject] = header.split("\t");
      return { sha, subject: subject.join("\t"), files };
    })
    .filter((commit) => commit.files.some((file) => !NOT_RUN_BY_THE_FORK.some((pattern) => pattern.test(file))))
    .map(({ sha, subject }) => ({ sha, subject }));
}

/**
 * The Pull Request of an update that is still open, from GitHub: { number, url,
 * branch }, or null. Asked of GitHub rather than read from the branches: a
 * squash-merged or closed update leaves its branch behind, and a branch is no
 * proof that anything is waiting.
 */
export function openUpdatePullRequest() {
  const slug = slugOf(remoteUrl("origin"));
  if (!slug || !hasGh()) {
    return null;
  }
  const res = run("gh", ["pr", "list", "--repo", slug, "--base", UPDATE_BASE, "--state", "open", "--json", "number,url,headRefName"], {
    quiet: true,
    capture: true
  });
  if (res.code !== 0) {
    return null;
  }
  try {
    const pr = JSON.parse(res.stdout || "[]").find((p) => (p.headRefName || "").startsWith(UPDATE_BRANCH_PREFIX));
    return pr ? { number: pr.number, url: pr.url, branch: pr.headRefName } : null;
  } catch {
    return null;
  }
}

/**
 * The check every training command runs first. Says nothing when the fork is
 * current, when there is no training repository to compare with, or offline.
 * Returns the number of course changes the fork is missing.
 */
export function adviseCourseUpdate({ fetch = true, quietWhenCurrent = true } = {}) {
  if (!hasCourseUpstream()) {
    return 0;
  }
  if (fetch && !fetchCourse()) {
    return 0;
  }
  const missing = missingCourseCommits();
  if (missing.length === 0) {
    if (!quietWhenCurrent) {
      info(`  Course     : ${c.green("up to date")}`);
    }
    return 0;
  }
  const waiting = openUpdatePullRequest();
  console.log("");
  if (waiting) {
    warn(`Your fork is missing ${missing.length} change(s) of the course, and an update Pull Request is open.`);
    info(`    Merge ${c.cyan(waiting.url)} into ${UPDATE_BASE} with ${c.bold("Merge pull request")}, never a squash, then Pull.`);
  } else {
    warn(`Your fork is missing ${missing.length} change(s) of the course since you forked it.`);
    missing.slice(0, 3).forEach((commit) => info(c.dim(`    ${commit.subject}`)));
    if (missing.length > 3) {
      info(c.dim(`    ... and ${missing.length - 3} more`));
    }
    info(`    Run ${c.bold("Update my course")} from the Training menu of your level: it opens a Pull Request into ${UPDATE_BASE} that brings them in.`);
  }
  console.log("");
  return missing.length;
}
