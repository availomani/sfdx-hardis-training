/**
 * The arithmetic of the course statistics. No network and no file here: it
 * takes what collect.mjs read and returns numbers, so it can be tested on
 * fixtures.
 *
 * Time spent is active time. Every commit, Pull Request and Pull Request
 * comment of a repository is a point on one timeline, and the time between two
 * markers is the sum of the gaps between consecutive points. A gap longer than
 * the idle cutoff counts for nothing: the learner went to lunch, or to bed.
 * That makes every figure a floor, because work done in the org leaves no
 * point at all.
 */
import { SEGMENTS, MEASURED, LEVEL_STARTED, LEVELS, segmentKey } from "./markers.mjs";

export const IDLE_CUTOFF_MINUTES = 45;
/**
 * How many learners a figure needs. Under three, a lab or a level shows no
 * figure and keeps the estimate it was written with: one or two learners are
 * somebody's afternoon, not what the lab takes.
 */
export const MIN_SAMPLE = 3;

const MINUTE = 60 * 1000;
const time = (iso) => (iso ? Date.parse(iso) : NaN);

// ------------------------------------------------------------ announced times
/** "15 min", "about 2 h", "about 7 h 20" as minutes. Null when it is none of them. */
export function parseAnnounced(text) {
  const value = String(text || "");
  const hours = value.match(/(\d+)\s*h(?:\s*(\d+))?/i);
  if (hours) {
    return Number(hours[1]) * 60 + Number(hours[2] || 0);
  }
  const minutes = value.match(/(\d+)\s*min/i);
  return minutes ? Number(minutes[1]) : null;
}

/**
 * The announced minutes of each lab, keyed "1.3".
 *
 * These are the estimates: what a lab was expected to take when it was
 * written. training-universe.json keeps them, because the page of a lab
 * announces what learners were observed to take, once enough of them did.
 */
export function announcedByLab(universe, timeOf = (level, lab) => lab.time) {
  const out = {};
  for (const level of universe.levels || []) {
    for (const lab of level.labs || []) {
      out[`${level.level}.${lab.lab}`] = parseAnnounced(timeOf(level, lab));
    }
  }
  return out;
}

const sumAnnounced = (labs, announced) =>
  labs.every((lab) => typeof announced[lab] === "number") ? labs.reduce((total, lab) => total + announced[lab], 0) : null;

// ------------------------------------------------------------------ timeline
/**
 * Every moment the repository shows its owner at work, sorted, from the day it
 * was created. Commits that came with the fork are older and are left out, and
 * so are the commits of the course that an update brings in later.
 *
 * moments are other times the learner was seen at work: the receipts of Check
 * my work. They belong here whether or not they are used as the end of a lab.
 * A lab timed from receipts and the segment it sits in are then measured over
 * the same gaps, and the labs of a segment add up to it. Left out, a receipt
 * in the middle of an hour without a commit made two countable half hours of a
 * gap the segment counted for nothing.
 */
export function timeline(repo, moments = []) {
  const from = time(repo.createdAt);
  const owner = String(repo.owner || "").toLowerCase();
  const points = [from, ...moments];
  for (const one of repo.commits || []) {
    if (String(one.author || "").toLowerCase() === owner) {
      points.push(time(one.date));
    }
  }
  for (const pr of repo.pullRequests || []) {
    points.push(time(pr.createdAt), time(pr.mergedAt));
    for (const date of pr.commitDates || []) {
      points.push(time(date));
    }
    for (const date of pr.commentDates || []) {
      points.push(time(date));
    }
  }
  return [...new Set(points.filter((point) => Number.isFinite(point) && point >= from))].sort((a, b) => a - b);
}

/** Active minutes between two moments of a timeline. */
export function activeMinutes(points, start, end, cutoffMinutes = IDLE_CUTOFF_MINUTES) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  const inside = [start, ...points.filter((point) => point > start && point < end), end];
  let total = 0;
  for (let i = 1; i < inside.length; i++) {
    const gap = inside[i] - inside[i - 1];
    if (gap <= cutoffMinutes * MINUTE) {
      total += gap;
    }
  }
  return Math.round(total / MINUTE);
}

// ------------------------------------------------------------------- markers
/** Every moment the end marker of a segment was met, oldest first. */
function markerTimes(repo, segment) {
  const { end } = segment;
  if (end.kind === "commit") {
    const owner = String(repo.owner || "").toLowerCase();
    return (repo.commits || [])
      .filter((one) => String(one.author || "").toLowerCase() === owner && end.message.test(one.message || ""))
      .map((one) => time(one.date))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }
  return (repo.pullRequests || [])
    .filter((pr) => pr.mergedAt && end.head.test(pr.head || "") && (!end.base || pr.base === end.base))
    .map((pr) => time(pr.mergedAt))
    .sort((a, b) => a - b);
}

/**
 * When each segment ended, or null.
 *
 * A story can take two Pull Requests, so the end is the last one merged, but
 * only up to the first merge of the next segment that has one. A learner who
 * resets a level does its stories again, weeks later, and that second pass
 * must not stretch the first.
 */
export function segmentEnds(repo) {
  const all = SEGMENTS.map((segment) => markerTimes(repo, segment));
  return SEGMENTS.map((segment, index) => {
    const mine = all[index];
    if (mine.length === 0) {
      return null;
    }
    if (segment.end.first) {
      return mine[0];
    }
    const next = all.slice(index + 1).find((times) => times.length > 0 && times[0] > mine[0]);
    const before = next ? mine.filter((at) => at < next[0]) : mine;
    return before.length > 0 ? before[before.length - 1] : mine[0];
  });
}

// ------------------------------------------------------------------ receipts
/**
 * The receipt lines of a claim, as { "1.2": time }.
 *
 *   LAB 1.2 OK  handle=jdupont  commit=7f3a91c  2026-09-15T14:22Z
 */
export function parseReceipts(text) {
  const out = {};
  const pattern = /^\s*LAB\s+(\d+\.\d+)\s+OK\b.*?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)\s*$/gm;
  for (const match of String(text || "").matchAll(pattern)) {
    const at = time(match[2].length === 17 ? match[2].replace("Z", ":00Z") : match[2]);
    if (Number.isFinite(at) && (!(match[1] in out) || at < out[match[1]])) {
      out[match[1]] = at;
    }
  }
  return out;
}

/**
 * Receipts say when each lab passed only when they were taken lab after lab.
 * Check my work used to stamp every lab of the level with the time of the run,
 * so a claim made before that was fixed carries one minute, repeated.
 */
function receiptsUsable(receipts, level) {
  const ends = SEGMENTS.filter((segment) => segment.level === level).map((segment) => receipts[segment.labs[segment.labs.length - 1]]);
  return ends.every(Number.isFinite) && new Set(ends).size === ends.length && ends.every((at, i) => i === 0 || at > ends[i - 1]);
}

// ------------------------------------------------------------------- learner
const matchesAny = (patterns, names) => names.some((name) => patterns.some((pattern) => pattern.test(name)));

/**
 * One learner: which levels they started and completed, and the minutes of
 * each segment that could be measured.
 *
 * badgeLevels is the levels of the badges this repository earned, and receipts
 * the lines of its claims, already parsed.
 */
export function learnerStats(repo, { badgeLevels = [], receipts = {}, cutoffMinutes = IDLE_CUTOFF_MINUTES } = {}) {
  const points = timeline(repo, Object.values(receipts));
  const gitEnds = segmentEnds(repo);
  const names = [...(repo.branches || []), ...(repo.pullRequests || []).map((pr) => pr.head || "")];

  const levels = {};
  const segments = {};
  const labs = {};
  let previousEnd = time(repo.createdAt);
  for (const level of LEVELS) {
    const fromReceipts = receiptsUsable(receipts, level);
    if (fromReceipts) {
      const anchors = SEGMENTS.filter((segment) => segment.anchor).flatMap((segment) => segment.labs);
      Object.assign(labs, labMinutes(points, receipts, level, previousEnd, cutoffMinutes, anchors));
    }
    const indexes = SEGMENTS.map((segment, index) => (segment.level === level ? index : -1)).filter((index) => index >= 0);
    let total = 0;
    let complete = true;
    for (const index of indexes) {
      const segment = SEGMENTS[index];
      const end = fromReceipts ? receipts[segment.labs[segment.labs.length - 1]] : gitEnds[index];
      // A segment needs both of its ends. One that ended before the one ahead of
      // it was done out of order, and its start is anybody's guess.
      const minutes = Number.isFinite(end) && Number.isFinite(previousEnd) && end > previousEnd
        ? activeMinutes(points, previousEnd, end, cutoffMinutes)
        : null;
      if (segment.anchor) {
        // Only where the clock starts: what came before it is not on GitHub
      } else if (minutes === null) {
        complete = false;
      } else {
        segments[segmentKey(segment)] = { minutes, source: fromReceipts ? "receipts" : "git" };
        total += minutes;
      }
      previousEnd = Number.isFinite(end) ? end : NaN;
    }
    const completed = badgeLevels.includes(level);
    const anySegment = indexes.some((index) => gitEnds[index] !== null);
    levels[level] = {
      started: completed || anySegment || matchesAny(LEVEL_STARTED[level], names),
      completed,
      minutes: complete ? total : null
    };
  }
  return { levels, segments, labs };
}

/**
 * The minutes of each lab of a level, from receipts taken lab after lab: a lab
 * runs from the receipt of the one before to its own. The first lab of the
 * level runs from where the level before ended.
 */
function labMinutes(points, receipts, level, levelStart, cutoffMinutes, anchors) {
  const out = {};
  const ids = Object.keys(receipts)
    .filter((id) => Number(id.split(".")[0]) === level)
    .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]));
  ids.forEach((id, index) => {
    const lab = Number(id.split(".")[1]);
    // Only the first lab of a level runs from where the level before ended
    const first = index === 0 && lab === 1;
    // A lab with no receipt before it would be given the time of two
    if (!first && (index === 0 || Number(ids[index - 1].split(".")[1]) !== lab - 1)) {
      return;
    }
    if (anchors.includes(id)) {
      return;
    }
    const minutes = activeMinutes(points, first ? levelStart : receipts[ids[index - 1]], receipts[id], cutoffMinutes);
    if (minutes !== null) {
      out[id] = minutes;
    }
  });
  return out;
}

// ---------------------------------------------------------------- aggregates
export function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * The fastest time somebody could have done the lab in, or null.
 *
 * The smallest figure is often not one. A learner who runs Check my work for
 * two labs in a row is read as having done the second in three minutes. So the
 * fastest is the first figure, from the smallest up, that is at least five
 * minutes and at least a quarter of the median. The slowest is never kept: it
 * is somebody who was interrupted, and says nothing about the lab.
 */
export function plausibleFastest(values) {
  const middle = median(values);
  const plausible = values.filter((value) => typeof value === "number" && value >= 5 && value >= middle / 4);
  return plausible.length > 0 ? Math.min(...plausible) : null;
}

/**
 * What is published: counts and medians, and nobody's name.
 *
 * A median over fewer than minSample learners is left out, and its sample is
 * still given, so the page can say how far from a figure it is.
 */
export function aggregate(learners, announced, { generatedAt, cutoffMinutes = IDLE_CUTOFF_MINUTES, minSample = MIN_SAMPLE } = {}) {
  // The median and the fastest learner, or neither while too few learners are
  // behind them
  const shown = (values) => (values.length >= minSample
    ? { medianMinutes: median(values), fastestMinutes: plausibleFastest(values) }
    : { medianMinutes: null, fastestMinutes: null });

  const levels = LEVELS.map((level) => {
    const started = learners.filter((one) => one.levels[level].started);
    const completed = started.filter((one) => one.levels[level].completed);
    const minutes = learners.map((one) => one.levels[level].minutes).filter((value) => typeof value === "number");
    const labs = MEASURED.filter((segment) => segment.level === level).flatMap((segment) => segment.labs);
    return {
      level,
      started: started.length,
      completed: completed.length,
      announcedMinutes: sumAnnounced(labs, announced),
      ...shown(minutes),
      sample: minutes.length
    };
  });

  const segments = MEASURED.map((segment) => {
    const key = segmentKey(segment);
    const minutes = learners.map((one) => one.segments[key]).filter(Boolean).map((one) => one.minutes);
    return {
      level: segment.level,
      labs: segment.labs,
      announcedMinutes: sumAnnounced(segment.labs, announced),
      ...shown(minutes),
      sample: minutes.length
    };
  });

  // Lab by lab, for the learners whose receipts say when each lab passed
  const labs = Object.keys(announced)
    .map((lab) => {
      const minutes = learners.map((one) => (one.labs || {})[lab]).filter((value) => typeof value === "number");
      return { level: Number(lab.split(".")[0]), lab, announcedMinutes: announced[lab], ...shown(minutes), sample: minutes.length };
    })
    .filter((row) => row.sample > 0);

  return {
    $comment: "Generated by scripts/stats/course-stats.mjs, once a week. Counts and medians only: no learner is named here.",
    generatedAt: generatedAt || new Date().toISOString(),
    idleCutoffMinutes: cutoffMinutes,
    minSample,
    learners: learners.length,
    levels,
    segments,
    labs
  };
}

/** Whether a stats file has the shape the site build reads. Returns the problems. */
export function validate(stats) {
  const problems = [];
  const isCount = (value) => Number.isInteger(value) && value >= 0;
  const isMinutes = (value) => value === null || isCount(value);
  if (!stats || typeof stats !== "object") {
    return ["not an object"];
  }
  if (!Number.isFinite(Date.parse(stats.generatedAt))) {
    problems.push("generatedAt is not a date");
  }
  for (const key of ["idleCutoffMinutes", "minSample", "learners"]) {
    if (!isCount(stats[key])) {
      problems.push(`${key} is not a count`);
    }
  }
  for (const [name, rows] of [["levels", stats.levels], ["segments", stats.segments], ["labs", stats.labs || []]]) {
    if (!Array.isArray(rows)) {
      problems.push(`${name} is not a list`);
      continue;
    }
    rows.forEach((row, index) => {
      const where = `${name}[${index}]`;
      if (!LEVELS.includes(row.level)) {
        problems.push(`${where}.level is not a level`);
      }
      const figures = [row.medianMinutes, row.announcedMinutes, row.fastestMinutes ?? null];
      if (!isCount(row.sample) || !figures.every(isMinutes)) {
        problems.push(`${where} has a figure that is not a count`);
      }
      if (name === "levels" && (!isCount(row.started) || !isCount(row.completed) || row.completed > row.started)) {
        problems.push(`${where} has more completed than started`);
      }
      if (name === "segments" && (!Array.isArray(row.labs) || row.labs.length === 0)) {
        problems.push(`${where}.labs is empty`);
      }
    });
  }
  // The file is public and the report with the names is not: a handle or a
  // repository URL in here means the two were mixed up
  if (/github\.com|"handle"|"owner"|"repository"/i.test(JSON.stringify({ ...stats, $comment: "" }))) {
    problems.push("the file names a learner or a repository");
  }
  return problems;
}
