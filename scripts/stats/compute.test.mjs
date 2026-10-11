/**
 * node --test scripts/stats/compute.test.mjs
 *
 * The repositories below are made up, in the shape collect.mjs returns. What
 * they hold is what real forks showed: a story merged twice after a reset, a
 * night between two labs, receipts that all carry the same minute.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAnnounced, announcedByLab, plausibleFastest, timeline, activeMinutes, segmentEnds, parseReceipts, learnerStats, median, aggregate, validate
} from "./compute.mjs";
import { SEGMENTS } from "./markers.mjs";
import { announcedTimes, withAnnouncedTimes } from "./lab-times.mjs";

const at = (day, clock) => `2026-10-${String(day).padStart(2, "0")}T${clock}:00Z`;
const merged = (number, head, day, opened, mergedAt, extra = {}) => ({
  number, head, base: "integration", createdAt: at(day, opened), mergedAt: at(day, mergedAt), commitDates: [], commentDates: [], ...extra
});

/** A learner who did Level 1 in one sitting. */
const levelOne = () => ({
  owner: "learner",
  name: "sfdx-hardis-training",
  createdAt: at(1, "09:00"),
  branches: ["main", "integration", "uat", "features/US-014-panels-required", "features/US-016-crew-notes"],
  commits: [
    { date: at(1, "09:05"), message: "Point the pipeline at my training orgs", author: "learner" },
    // Came with the fork, and with a later update of the course: not the learner's
    { date: "2026-09-20T10:00:00Z", message: "docs: a lab", author: "maintainer" },
    { date: at(1, "09:50"), message: "badge: level 1 for somebody", author: "github-actions[bot]" }
  ],
  pullRequests: [
    merged(1, "features/US-014-panels-required", 1, "09:40", "09:45", { commitDates: [at(1, "09:20"), at(1, "09:35")] }),
    merged(2, "features/US-016-crew-notes", 1, "10:05", "10:10", { commentDates: [at(1, "10:07")] })
  ]
});

const UNIVERSE = {
  levels: [
    { level: 1, labs: [1, 2, 3, 4, 5, 6, 7].map((lab) => ({ lab, time: ["15 min", "30 min", "10 min", "15 min", "20 min", "20 min", "25 min"][lab - 1] })) },
    { level: 2, labs: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((lab) => ({ lab, time: "30 min" })) },
    { level: 3, labs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((lab) => ({ lab, time: "40 min" })) }
  ]
};

test("announced times are read as minutes", () => {
  assert.equal(parseAnnounced("15 min"), 15);
  assert.equal(parseAnnounced("~30 min, most of it waiting"), 30);
  assert.equal(parseAnnounced("about 2 h"), 120);
  assert.equal(parseAnnounced("about 7 h 20"), 440);
  assert.equal(parseAnnounced("a while"), null);
  assert.equal(announcedByLab(UNIVERSE)["1.7"], 25);
  assert.equal(announcedByLab(UNIVERSE, () => "**Time**: ~50 min")["3.1"], 50);
});

test("the timeline keeps the learner's own moments, from the day of the fork", () => {
  const points = timeline(levelOne());
  assert.equal(points[0], Date.parse(at(1, "09:00")));
  assert.ok(!points.includes(Date.parse("2026-09-20T10:00:00Z")), "a commit older than the fork is left out");
  assert.ok(!points.includes(Date.parse(at(1, "09:50"))), "a commit of somebody else is left out");
  assert.ok(points.includes(Date.parse(at(1, "10:07"))), "a Pull Request comment is a moment");
});

test("a gap longer than the cutoff counts for nothing", () => {
  const points = [0, 10, 20, 200, 210].map((minutes) => minutes * 60000);
  assert.equal(activeMinutes(points, 0, 210 * 60000, 45), 30);
  assert.equal(activeMinutes(points, 0, 210 * 60000, 240), 210);
  assert.equal(activeMinutes(points, 20 * 60000, 20 * 60000, 45), null, "no time between a moment and itself");
});

test("Level 1 in one sitting", () => {
  const stats = learnerStats(levelOne(), { badgeLevels: [1] });
  // From the anchor at 09:05 to the US-014 merge at 09:45, with no gap over the cutoff
  assert.deepEqual(stats.segments["1.3,1.4,1.5,1.6"], { minutes: 40, source: "git" });
  assert.deepEqual(stats.segments["1.7"], { minutes: 25, source: "git" });
  assert.equal(stats.segments["1.2"], undefined, "the anchor is where the clock starts, not a figure");
  assert.deepEqual(stats.levels[1], { started: true, completed: true, minutes: 65 });
  assert.deepEqual(stats.levels[2], { started: false, completed: false, minutes: null });
});

test("a night between two labs is not time spent", () => {
  const repo = levelOne();
  repo.pullRequests[1] = merged(2, "features/US-016-crew-notes", 2, "08:00", "08:20");
  const stats = learnerStats(repo);
  assert.equal(stats.segments["1.7"].minutes, 20);
});

test("a story done again after a reset does not stretch its first pass", () => {
  const repo = levelOne();
  repo.pullRequests.push(merged(3, "features/US-014-panels-required-again", 9, "14:00", "14:30"));
  const ends = segmentEnds(repo);
  const index = SEGMENTS.findIndex((segment) => segment.labs.includes("1.6"));
  assert.equal(ends[index], Date.parse(at(1, "09:45")));
});

test("a story in two Pull Requests ends with the second", () => {
  const repo = levelOne();
  repo.pullRequests.push(
    merged(3, "features/US-021-crew-size-warning", 1, "10:30", "10:40"),
    merged(4, "features/US-024-crew-size-required", 1, "11:00", "11:05"),
    merged(5, "features/US-026-crew-capacity-data", 1, "11:20", "11:25"),
    merged(6, "features/US-026-crew-capacity-actions", 1, "11:40", "11:50"),
    merged(7, "features/US-027-schedule-by-availability", 1, "12:10", "12:20")
  );
  const stats = learnerStats(repo);
  assert.equal(stats.segments["2.4"].minutes, 45);
  assert.equal(stats.levels[2].started, true);
  assert.equal(stats.levels[2].minutes, null, "a level with a segment missing has no total");
});

test("a level whose start is unknown is not measured", () => {
  const repo = levelOne();
  repo.commits = [];
  const stats = learnerStats(repo);
  assert.equal(stats.segments["1.3,1.4,1.5,1.6"], undefined);
  assert.deepEqual(stats.segments["1.7"], { minutes: 25, source: "git" });
  assert.equal(stats.levels[1].minutes, null);
  assert.equal(stats.levels[1].started, true);
});

test("receipts taken lab after lab give each lab its time", () => {
  const receipts = parseReceipts([
    "LAB 1.2 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:06Z",
    "LAB 1.3 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:15Z",
    "LAB 1.4 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:25Z",
    "LAB 1.5 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:38Z",
    "LAB 1.6 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:47Z",
    "LAB 1.7 OK  handle=learner  commit=aaaaaaa  2026-10-01T10:12Z"
  ].join("\n"));
  const stats = learnerStats(levelOne(), { receipts });
  assert.equal(stats.labs["1.2"], undefined);
  assert.equal(stats.labs["1.3"], 9);
  assert.equal(stats.labs["1.6"], 9);
  assert.deepEqual(stats.segments["1.3,1.4,1.5,1.6"], { minutes: 41, source: "receipts" });
});

test("the labs of a segment add up to the segment", () => {
  // An hour without a commit, and a receipt in the middle of it: the receipt is
  // a moment the learner was at work, for the segment as much as for the lab
  const repo = levelOne();
  repo.pullRequests[0] = merged(1, "features/US-014-panels-required", 1, "11:00", "11:05");
  repo.pullRequests[1] = merged(2, "features/US-016-crew-notes", 1, "11:25", "11:30");
  const receipts = parseReceipts([
    "LAB 1.2 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:06Z",
    "LAB 1.3 OK  handle=learner  commit=aaaaaaa  2026-10-01T09:40Z",
    "LAB 1.4 OK  handle=learner  commit=aaaaaaa  2026-10-01T10:10Z",
    "LAB 1.5 OK  handle=learner  commit=aaaaaaa  2026-10-01T10:40Z",
    "LAB 1.6 OK  handle=learner  commit=aaaaaaa  2026-10-01T11:06Z",
    "LAB 1.7 OK  handle=learner  commit=aaaaaaa  2026-10-01T11:31Z"
  ].join("\n"));
  const stats = learnerStats(repo, { receipts });
  const labs = stats.labs["1.3"] + stats.labs["1.4"] + stats.labs["1.5"] + stats.labs["1.6"];
  assert.equal(labs, stats.segments["1.3,1.4,1.5,1.6"].minutes);
  assert.equal(labs, 120);
});

test("a lab whose receipt before it is missing gets no time of its own", () => {
  const receipts = parseReceipts([
    "LAB 2.2 OK  handle=learner  commit=aaaaaaa  2026-10-01T11:00Z",
    "LAB 2.3 OK  handle=learner  commit=aaaaaaa  2026-10-01T11:30Z"
  ].join("\n"));
  const repo = levelOne();
  repo.pullRequests.push(
    merged(3, "features/US-021-crew-size-warning", 1, "10:50", "10:55"),
    merged(4, "features/US-024-crew-size-required", 1, "11:20", "11:25")
  );
  const stats = learnerStats(repo, { receipts });
  assert.equal(stats.labs["2.2"], undefined, "it would carry the time of Lab 2.1 as well");
});

test("a marker met again by a later lab ends its own lab the first time", () => {
  const repo = levelOne();
  const toMain = (number, head, day, at) => ({ ...merged(number, head, day, at, at), base: "main" });
  repo.pullRequests.push(
    toMain(10, "preprod", 5, "10:00"),
    toMain(11, "preprod", 6, "15:00"),
    merged(12, "retrofit/US-046-needs-reinspection", 6, "16:00", "16:30")
  );
  const ends = segmentEnds(repo);
  const index = SEGMENTS.findIndex((segment) => segment.labs.includes("3.6"));
  assert.equal(ends[index], Date.parse(at(5, "10:00")), "the release, not the hotfix that follows it");
});

test("receipts that all carry the same minute fall back to git", () => {
  const receipts = parseReceipts(["1.2", "1.3", "1.4", "1.5", "1.6", "1.7"]
    .map((lab) => `LAB ${lab} OK  handle=learner  commit=aaaaaaa  2026-10-01T10:15Z`).join("\n"));
  const stats = learnerStats(levelOne(), { receipts });
  assert.deepEqual(stats.labs, {});
  assert.equal(stats.segments["1.7"].source, "git");
});

test("the earliest receipt of a lab wins", () => {
  const receipts = parseReceipts("LAB 1.3 OK  handle=a  commit=b  2026-10-02T09:00Z\nLAB 1.3 OK  handle=a  commit=b  2026-10-01T09:00Z");
  assert.equal(receipts["1.3"], Date.parse("2026-10-01T09:00:00Z"));
});

test("a median under the minimum sample is not published", () => {
  assert.equal(median([30, 10, 20]), 20);
  assert.equal(median([10, 20, 31, 40]), 26);
  assert.equal(median([]), null);

  const one = learnerStats(levelOne(), { badgeLevels: [1] });
  const few = aggregate([one, one], announcedByLab(UNIVERSE), { minSample: 3 });
  assert.equal(few.levels[0].medianMinutes, null);
  assert.equal(few.levels[0].sample, 2);

  const enough = aggregate([one, one, one], announcedByLab(UNIVERSE), { minSample: 3 });
  assert.deepEqual(enough.levels[0], { level: 1, started: 3, completed: 3, announcedMinutes: 90, medianMinutes: 65, fastestMinutes: 65, sample: 3 });
  assert.equal(few.levels[0].fastestMinutes, null, "the fastest waits for the sample too");
  assert.equal(enough.segments[0].announcedMinutes, 65);
  assert.deepEqual(validate(enough), []);
});

test("a page announces the observed time, and the estimate where nobody was observed", () => {
  const estimates = { "1.1": 15, "1.2": 30, "1.3": 10, "1.4": 15, "2.1": 15, "2.2": 25, "2.3": 30, "2.9": 30, "3.1": 50, "3.2": 25 };
  const stats = {
    labs: [{ lab: "1.3", medianMinutes: 14, sample: 6 }, { lab: "1.4", medianMinutes: null }, { lab: "2.3", medianMinutes: 115, sample: 1 }],
    segments: [
      { labs: ["1.3", "1.4"], medianMinutes: 40 },
      { labs: ["2.1", "2.2"], medianMinutes: 55, fastestMinutes: 28, sample: 14 },
      { labs: ["2.3"], medianMinutes: 56, fastestMinutes: null, sample: 11 },
      { labs: ["2.9"], medianMinutes: null }
    ]
  };
  const times = announcedTimes(stats, estimates);
  // What was observed is said for the labs it was measured on: 2.1 was timed with 2.2
  assert.deepEqual(times.labs["2.1"].observation, { labs: ["2.1", "2.2"], fastest: 28, median: 55, sample: 14 });
  assert.deepEqual(times.labs["2.3"].observation.labs, ["2.3"]);
  assert.equal(times.labs["2.3"].observation.fastest, null);
  // Three minutes is two labs checked in a row, not a lab done in three minutes:
  // the fastest is the first figure somebody could have done the lab in
  assert.equal(plausibleFastest([3, 6, 16, 50, 56, 60, 200]), 16, "3 and 6 are under a quarter of the median, 50");
  assert.equal(plausibleFastest([16, 50, 56]), 16);
  assert.equal(plausibleFastest([2, 3, 4, 4, 4]), null, "nothing reaches five minutes");
  assert.equal(plausibleFastest([4, 6, 8, 10, 12]), 6, "4 is under five minutes");
  assert.equal(times.labs["2.9"].observation, null);
  for (const one of Object.values(times.labs)) {
    delete one.observation;
  }
  assert.deepEqual(times.labs["1.3"], { minutes: 10, observed: true }, "its own median, rounded down to five minutes");
  assert.deepEqual(times.labs["1.4"], { minutes: 20, observed: true }, "its share of the segment: 40 x 15 / 25 is 24");
  assert.deepEqual(times.labs["2.1"], { minutes: 20, observed: true });
  assert.deepEqual(times.labs["2.2"], { minutes: 30, observed: true }, "34 is announced as 30, never 35");
  assert.deepEqual(times.labs["2.3"], { minutes: 55, observed: true }, "the median of eleven learners, not the 115 minutes of the one who has receipts");
  assert.deepEqual(times.labs["2.9"], { minutes: 30, observed: false }, "too few learners: the estimate");
  assert.deepEqual(times.labs["1.1"], { minutes: 15, observed: false }, "never measured: the estimate");
  // 15 + 30 + 14 + 24 is 83, and 55 + 56 + 30 is 141: a level is rounded down to a quarter of an hour
  assert.equal(times.levels[1], 75);
  assert.equal(times.levels[2], 135);
  assert.equal(times.levels[3], 75, "a level nobody was observed in keeps the sum of its estimates");
  assert.deepEqual(announcedTimes(null, estimates).labs["2.3"], { minutes: 30, observed: false, observation: null }, "no figures yet");
});

test("the observed times are written into a lab, a level page and the home page, in any language", () => {
  const universe = {
    levels: [{ level: 2, slug: "level-2", labs: [{ lab: 1, slug: "2-1-first" }, { lab: 2, slug: "2-2-second" }] }]
  };
  const times = { labs: { "2.1": { minutes: 20 }, "2.2": { minutes: 55 } }, levels: { 2: 75 } };

  assert.equal(
    withAnnouncedTimes("# Lab\n\n**Time**: ~15 min, most of it waiting\n\n~15 min later", "level-2/2-1-first.md", times, universe),
    "# Lab\n\n**Time**: ~20 min, most of it waiting\n\n~15 min later"
  );
  assert.equal(
    withAnnouncedTimes("**Durée** : ~30 min\n", "level-2/2-2-second.md", times, universe),
    "**Durée** : ~55 min\n"
  );

  const index = [
    "**Durée** : environ 1 h, en une fois.",
    "",
    "| [2.1](2-1-first.md)  | Le premier | 15 min |",
    "| [2.2](2-2-second.md) | Le second  | 30 min |"
  ].join("\n");
  assert.equal(withAnnouncedTimes(index, "level-2/index.md", times, universe), [
    "**Durée** : environ 1 h 15, en une fois.",
    "",
    "| [2.1](2-1-first.md)  | Le premier | 20 min |",
    "| [2.2](2-2-second.md) | Le second  | 55 min |"
  ].join("\n"));

  const home = "| [**2 - Advanced**](level-2/index.md) | The same people | 4 h  | Level 1 |\n| other | 4 h | row |";
  assert.equal(
    withAnnouncedTimes(home, "index.md", times, universe),
    "| [**2 - Advanced**](level-2/index.md) | The same people | 1 h 15  | Level 1 |\n| other | 4 h | row |"
  );

  // What was observed follows the time, in the words the caller gives
  const observed = {
    labs: { "2.1": { minutes: 20, observation: { labs: ["2.1"], fastest: 10, median: 22, sample: 6 } }, "2.2": { minutes: 55, observation: null } },
    levels: { 2: 75 },
    levelObservations: { 2: { labs: ["2.1", "2.2"], fastest: null, median: 80, sample: 5 } }
  };
  const describe = (observation, own) => `[${observation.labs.join("+")} for ${own.length}: ${observation.median}, fastest ${observation.fastest}]`;
  const once = withAnnouncedTimes("**Time**: ~15 min, most of it waiting\n", "level-2/2-1-first.md", observed, universe, describe);
  assert.equal(once, "**Time**: ~20 min, most of it waiting<!-- observed --> [2.1 for 1: 22, fastest 10]<!-- /observed -->\n");
  // The page is committed, so the next run reads what this one wrote: it has to
  // replace its own sentence, and to take it away when the figures go
  assert.equal(withAnnouncedTimes(once, "level-2/2-1-first.md", observed, universe, describe), once);
  assert.equal(withAnnouncedTimes(once, "level-2/2-1-first.md", times, universe, describe), "**Time**: ~20 min, most of it waiting\n");
  assert.equal(withAnnouncedTimes("**Time**: ~30 min\n", "level-2/2-2-second.md", observed, universe, describe), "**Time**: ~55 min\n");

  const levelOnce = withAnnouncedTimes(index, "level-2/index.md", observed, universe, describe);
  assert.ok(levelOnce.startsWith("**Durée** : environ 1 h 15, en une fois.<!-- observed --> [2.1+2.2 for 2: 80, fastest null]<!-- /observed -->\n"));
  assert.equal(withAnnouncedTimes(levelOnce, "level-2/index.md", observed, universe, describe), levelOnce);
  // The blank line after a table is not part of its last row
  assert.equal(withAnnouncedTimes(`${index}\n\nAfter the table.`, "level-2/index.md", times, universe).split("\n").slice(-2).join("|"), "|After the table.");

  assert.equal(withAnnouncedTimes("**Time**: whenever", "help.md", times, universe), "**Time**: whenever");
  assert.throws(() => withAnnouncedTimes("no time here", "level-2/2-1-first.md", times, universe), /no line announcing/);
});

test("a file that names a learner is refused", () => {
  const stats = aggregate([learnerStats(levelOne())], announcedByLab(UNIVERSE));
  assert.deepEqual(validate(stats), []);
  assert.ok(validate({ ...stats, repository: "https://github.com/learner/sfdx-hardis-training" }).length > 0);
  assert.ok(validate({ ...stats, levels: [{ ...stats.levels[0], started: 1, completed: 2 }] }).length > 0);
});
