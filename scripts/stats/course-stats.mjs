#!/usr/bin/env node
/**
 * The statistics of the course: how many learners start and finish each level,
 * and how long the labs take them, next to the time each lab announces.
 *
 *   node scripts/stats/course-stats.mjs             read GitHub, write stats/course-stats.json
 *   node scripts/stats/course-stats.mjs --details   and the report that names each learner
 *   node scripts/stats/course-stats.mjs --render    no network: rewrite STATS.md from the committed file
 *   node scripts/stats/course-stats.mjs --check     no network: the committed files are right, and agree
 *
 * stats/course-stats.json is committed, once a week, by
 * .github/workflows/course-stats.yml, and scripts/build/site.mjs builds the
 * Statistics page from it. It holds counts and medians and names nobody.
 *
 * STATS.md is the same page for somebody reading the repository on GitHub,
 * the way BACKLOG.md is. It is written from the JSON file and never by hand.
 *
 * The report of --details does name people, one row per learner, and goes to
 * hardis-report/course-stats/, which git ignores. It is for whoever maintains
 * the course, on their own machine, and nothing publishes it.
 *
 * A learner is a fork of the course, or a repository a badge claim named: a
 * copy made from a template is not a fork, and is only known once it claims.
 */
import fs from "fs";
import path from "path";
import { ROOT, parseArgs, universe } from "../lib/util.mjs";
import { githubToken, listForks, listClaims, readRepository, parseRepositoryUrl } from "./collect.mjs";
import { learnerStats, aggregate, validate, parseReceipts, announcedByLab, IDLE_CUTOFF_MINUTES, MIN_SAMPLE } from "./compute.mjs";
import { MEASURED, LEVELS, segmentKey } from "./markers.mjs";
import { strings, universeText } from "../lib/strings.mjs";
import { statsPage } from "../lib/pages.mjs";

const STATS_FILE = path.join(ROOT, "stats", "course-stats.json");
const STATS_PAGE = path.join(ROOT, "STATS.md");
const DETAILS_DIR = path.join(ROOT, "hardis-report", "course-stats");
const IGNORE_FILE = path.join(ROOT, "scripts", "stats", "ignore.json");

const args = parseArgs(process.argv.slice(2));

if (args.check) {
  check();
} else if (args.render) {
  console.log(writePage(readStats()) ? "Written: STATS.md" : "STATS.md is up to date.");
} else {
  await main();
}

async function main() {
  const u = universe();
  const upstream = u.course.upstreamRepo;
  const token = githubToken();
  const isIgnored = ignoreList();

  const [forks, claims] = await Promise.all([listForks(token, upstream), listClaims(token, upstream)]);
  const badges = badgeLevelsByRepository();

  // Forks first, then what only a claim or a badge knows about
  const repositories = new Map();
  const add = (repo) => {
    if (repo && `${repo.owner}/${repo.name}`.toLowerCase() !== upstream.toLowerCase() && !isIgnored(repo)) {
      repositories.set(keyOf(repo), repo);
    }
  };
  forks.forEach(add);
  claims.forEach((claim) => add(claim.repository));
  [...badges.values()].forEach((badge) => add(badge.repository));

  const learners = [];
  let unreadable = 0;
  for (const repo of repositories.values()) {
    const read = await readRepository(token, repo);
    if (!read) {
      unreadable++;
      continue;
    }
    const mine = claims.filter((claim) => claim.repository && keyOf(claim.repository) === keyOf(repo));
    const badge = badges.get(keyOf(repo));
    const stats = learnerStats(read, {
      badgeLevels: badge ? badge.levels : [],
      receipts: parseReceipts(mine.map((claim) => claim.receipts).join("\n"))
    });
    learners.push({ ...stats, repo: read, claims: mine.length, needsWork: mine.filter((claim) => claim.needsWork).length });
  }

  const stats = aggregate(learners, announcedByLab(u), { cutoffMinutes: IDLE_CUTOFF_MINUTES, minSample: MIN_SAMPLE });
  const problems = validate(stats);
  if (problems.length > 0) {
    console.error(`The statistics are not publishable:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  // A week in which nothing moved keeps the file, and its date, as they are:
  // the workflow then has nothing to commit, and no site to rebuild
  const figures = (one) => JSON.stringify({ ...one, generatedAt: null });
  let unchanged = false;
  try {
    unchanged = fs.existsSync(STATS_FILE) && figures(JSON.parse(fs.readFileSync(STATS_FILE, "utf8"))) === figures(stats);
  } catch {
    unchanged = false;
  }
  if (!unchanged) {
    fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2) + "\n", "utf8");
  }
  // From the file, not from this run: when the figures did not move, the page
  // keeps the date the file carries
  const pageWritten = writePage(readStats());

  console.log(`${learners.length} learner(s) read, ${unreadable} repository(ies) gone or private, ${forks.length} fork(s), ${claims.length} claim(s)`);
  for (const level of stats.levels) {
    console.log(`  Level ${level.level}: ${level.started} started, ${level.completed} completed, ${level.sample} timed`);
  }
  console.log(unchanged ? "The figures did not change: stats/course-stats.json is left as it is." : `Written: ${path.relative(ROOT, STATS_FILE)}`);

  if (pageWritten) {
    console.log("Written: STATS.md");
  }

  if (args.details) {
    writeDetails(learners);
  }
}

/** The committed figures, or an exit when they cannot be read. */
function readStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
  } catch (error) {
    console.error(`stats/course-stats.json is not readable JSON: ${error.message}`);
    return process.exit(1);
  }
}

/**
 * STATS.md, in English: the page of the site, for a reader of the repository.
 * The site builds its own from the same figures, in every language.
 */
function renderPage(stats) {
  const u = universe();
  return [
    "<!-- Generated by scripts/stats/course-stats.mjs from stats/course-stats.json. Do not edit by hand. -->",
    "",
    statsPage({ s: strings("en"), text: universeText("en", u), universe: u, stats }),
    `The same page on the course site: <${u.course.site}/stats/>`,
    ""
  ].join("\n");
}

/** Writes STATS.md when it differs. Returns whether it did. */
function writePage(stats) {
  const page = renderPage(stats);
  if (fs.existsSync(STATS_PAGE) && fs.readFileSync(STATS_PAGE, "utf8").replace(/\r\n/g, "\n") === page) {
    return false;
  }
  fs.writeFileSync(STATS_PAGE, page, "utf8");
  return true;
}

function check() {
  if (!fs.existsSync(STATS_FILE)) {
    console.log("stats/course-stats.json does not exist yet: the Statistics page says so until the first weekly run.");
    return;
  }
  const stats = readStats();
  const problems = validate(stats);
  if (problems.length > 0) {
    console.error(`stats/course-stats.json:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  const page = fs.existsSync(STATS_PAGE) ? fs.readFileSync(STATS_PAGE, "utf8").replace(/\r\n/g, "\n") : null;
  if (page !== renderPage(stats)) {
    console.error("STATS.md is out of date. Run: node scripts/stats/course-stats.mjs --render");
    process.exit(1);
  }
  console.log("stats/course-stats.json has the shape the site reads and names nobody, and STATS.md says the same.");
}

/** Who is left out: the maintainers and the accounts the end to end tests use. */
function ignoreList() {
  const list = JSON.parse(fs.readFileSync(IGNORE_FILE, "utf8"));
  const handles = new Set((list.handles || []).map((handle) => handle.toLowerCase()));
  const patterns = (list.repositoryPatterns || []).map((pattern) => new RegExp(pattern, "i"));
  return (repo) => handles.has(repo.owner.toLowerCase()) || patterns.some((pattern) => pattern.test(`${repo.owner}/${repo.name}`));
}

/**
 * The levels each repository earned a badge for, from the records the claims
 * wrote. The repository is the evidence of the badge, and the recipient's own
 * copy of the course when a record was written before evidence was.
 */
function badgeLevelsByRepository() {
  const out = new Map();
  const dir = path.join(ROOT, "badges");
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".json")) : []) {
    let record;
    try {
      record = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch {
      continue;
    }
    for (const badge of record.badges || []) {
      const evidence = (badge.evidence || []).find((one) => one.type === "Repository");
      const repository = parseRepositoryUrl(evidence && evidence.url)
        || (record.recipient ? { owner: record.recipient, name: "sfdx-hardis-training" } : null);
      if (!repository) {
        continue;
      }
      const entry = out.get(keyOf(repository)) || { repository, levels: [] };
      entry.levels.push(badge.level);
      out.set(keyOf(repository), entry);
    }
  }
  return out;
}

function keyOf(repo) {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

/** One row per learner, for the maintainer's eyes only. */
function writeDetails(learners) {
  const keys = MEASURED.map(segmentKey);
  const header = [
    "handle", "repository", "created", "lastPush", "fork", "claims", "needsWork",
    ...LEVELS.flatMap((level) => [`level${level}Started`, `level${level}Completed`, `level${level}Minutes`]),
    ...keys.map((key) => `labs ${key.replace(/,/g, " ")}`),
    "source"
  ];
  const rows = learners
    .slice()
    .sort((a, b) => a.repo.createdAt.localeCompare(b.repo.createdAt))
    .map((one) => [
      one.repo.owner,
      `https://github.com/${one.repo.owner}/${one.repo.name}`,
      one.repo.createdAt,
      one.repo.pushedAt,
      one.repo.isFork ? "yes" : "no",
      one.claims,
      one.needsWork,
      ...LEVELS.flatMap((level) => [
        one.levels[level].started ? "yes" : "no",
        one.levels[level].completed ? "yes" : "no",
        one.levels[level].minutes ?? ""
      ]),
      ...keys.map((key) => (one.segments[key] ? one.segments[key].minutes : "")),
      [...new Set(Object.values(one.segments).map((segment) => segment.source))].join("+")
    ]);

  fs.mkdirSync(DETAILS_DIR, { recursive: true });
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
  fs.writeFileSync(path.join(DETAILS_DIR, "learners.csv"), csv, "utf8");
  const md = [
    "# Course statistics, learner by learner",
    "",
    "Not to publish: this file names people. Minutes are active time, see scripts/stats/compute.mjs.",
    "",
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    ""
  ].join("\n");
  fs.writeFileSync(path.join(DETAILS_DIR, "learners.md"), md, "utf8");
  console.log(`Written, for your eyes only: ${path.relative(ROOT, DETAILS_DIR)}${path.sep}learners.csv and learners.md`);
}
