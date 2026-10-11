/**
 * Where each lab leaves a trace on GitHub, for the course statistics.
 *
 * A learner's repository cannot say when a lab started or ended. What it can
 * say is when a Pull Request was merged, and each lab ends with one. So the
 * time spent is measured per segment: from the end marker of the segment
 * before to its own.
 *
 * A segment covers several labs when only the last of them leaves a trace:
 * Labs 1.3 to 1.5 build, retrieve and publish US-014, and nothing is merged
 * before Lab 1.6.
 *
 * Labs 1.1 and 1.2 are not measured. They install the tools, sign up for the
 * org and create the scratch orgs, and the repository only appears at the very
 * end of that: the forks of the course are two minutes old when Lab 1.2 ends.
 * The end of Lab 1.2 is an anchor instead: the moment the clock starts.
 *
 * A lab whose User Story or branch name changes has to change here too: the
 * patterns below are the names training-universe.json gives the branches.
 */

/** A merged Pull Request whose head branch matches. */
const head = (pattern) => ({ kind: "pullRequest", head: pattern });
/** A merged Pull Request into this branch. */
const into = (base, headPattern) => ({ kind: "pullRequest", base, head: headPattern || /./ });
/** The first time a marker is met, when a later lab meets it again. */
const first = (marker) => ({ ...marker, first: true });
/** A commit of the learner on integration whose first line matches. */
const commit = (pattern) => ({ kind: "commit", message: pattern });

export const SEGMENTS = [
  // ------------------------------------------------------------- level 1
  // Set up my training environment ends with this commit
  { level: 1, labs: ["1.2"], anchor: true, end: commit(/^Point the pipeline at my training orgs/i) },
  { level: 1, labs: ["1.3", "1.4", "1.5", "1.6"], end: head(/^features\/US-014/i) },
  { level: 1, labs: ["1.7"], end: head(/^features\/US-016/i) },
  // ------------------------------------------------------------- level 2
  // The backpromote of Lab 2.1 happens in the org and leaves nothing here
  { level: 2, labs: ["2.1", "2.2"], end: head(/^features\/US-021/i) },
  { level: 2, labs: ["2.3"], end: head(/^features\/US-024/i) },
  { level: 2, labs: ["2.4"], end: head(/^features\/US-026/i) },
  { level: 2, labs: ["2.5"], end: head(/^features\/US-027/i) },
  { level: 2, labs: ["2.6"], end: head(/^features\/US-033/i) },
  { level: 2, labs: ["2.7"], end: head(/^features\/US-034/i) },
  { level: 2, labs: ["2.8"], end: head(/^features\/US-038/i) },
  { level: 2, labs: ["2.9"], end: head(/^features\/US-041/i) },
  // ------------------------------------------------------------- level 3
  { level: 3, labs: ["3.1"], end: head(/^features\/US-050/i) },
  { level: 3, labs: ["3.2"], end: head(/^training\/mate-us-052/i) },
  { level: 3, labs: ["3.3"], end: head(/^training\/mate-us-0(56|62)/i) },
  { level: 3, labs: ["3.4"], end: head(/^training\/mate-us-020/i) },
  { level: 3, labs: ["3.5"], end: into("uat", /^integration$/i) },
  // The first release into main. Lab 3.7 releases into main again, for its
  // hotfix, before the retrofit that ends it: taking the last one would give
  // Lab 3.6 most of the time of Lab 3.7.
  { level: 3, labs: ["3.6"], end: first(into("main")) },
  { level: 3, labs: ["3.7"], end: head(/^retrofit\//i) },
  // Monitoring and the project documentation live in other places than the
  // Pull Requests of this repository
  { level: 3, labs: ["3.8", "3.9", "3.10"], end: head(/^promotion\//i) },
  { level: 3, labs: ["3.11"], end: head(/^training\/mate-us-055/i) }
];

/**
 * What says a level was started, when none of its segments ended yet: a branch
 * or a Pull Request head with one of these names.
 */
export const LEVEL_STARTED = {
  1: [/^integration$/i, /^features\//i],
  2: [/^training\/mate-us-017/i, /^features\/US-0(21|24|26|27|33|34|38|41)/i],
  3: [/^preprod$/i, /^features\/US-050/i, /^training\/mate-us-05[2-9]/i, /^training\/mate-us-06/i, /^retrofit\//i, /^promotion\//i]
};

export const LEVELS = [1, 2, 3];

/** The segments that are measured: every one but the anchors. */
export const MEASURED = SEGMENTS.filter((segment) => !segment.anchor);

/** "1.3,1.4,1.5,1.6", the way a segment is keyed in the statistics. */
export const segmentKey = (segment) => segment.labs.join(",");
