/**
 * The deployment actions a start branch carries, given a Pull Request of the
 * learner's fork.
 *
 * sfdx-hardis collects the deployment actions of the Pull Requests a deployment
 * carries: scripts/actions/.sfdx-hardis.<number>.yml, read for each Pull Request
 * in scope. A start branch is built from the course, so its action files keep the
 * numbers of the course's own Pull Requests (.sfdx-hardis.28.yml for US-026), and
 * no Pull Request of a fork has them. After Reset this level into Level 3, the
 * first promotion to uat then went green with no deliverability step, no crew
 * capacity data and no nightly job, which Labs 3.5, 3.6 and 3.11 describe.
 *
 * Reset this level moves them into one file named after a Pull Request it opens
 * and merges itself, right after the reset. Its number is then lower than every
 * story the learner opens afterwards, and actions run in Pull Request number
 * order, so the Level 2 actions keep running before the Level 3 ones, as they do
 * for a learner who walked Level 2.
 */

/** Where sfdx-hardis reads the actions of a Pull Request. */
export const ACTIONS_DIR = "scripts/actions";

/** The two lists of an action file, in the order the merged file writes them. */
const ACTION_LISTS = ["commandsPreDeploy", "commandsPostDeploy"];

/** The action files of a tree, as git lists them: [{ file, pr }], by Pull Request number. */
export function numberedActionFiles(paths) {
  return paths
    .map((file) => ({ file, match: file.match(/^scripts\/actions\/\.sfdx-hardis\.(\d+)\.yml$/) }))
    .filter((one) => one.match)
    .map((one) => ({ file: one.file, pr: Number(one.match[1]) }))
    .sort((a, b) => a.pr - b.pr);
}

/** The name sfdx-hardis reads the actions of Pull Request <pr> from. */
export function actionFileOf(pr) {
  return `${ACTIONS_DIR}/.sfdx-hardis.${pr}.yml`;
}

/**
 * One action file holding the actions of several, in the order given: each list
 * keeps the actions of the first file first, so they run in the order they ran
 * when every file had a Pull Request of its own. The ids are kept as they are:
 * they are fixed in the start branch, so a second reset writes the same ids, and
 * sfdx-hardis knows an action by its id.
 *
 * Throws on anything but the two action lists, or on an id used twice: a file
 * this cannot merge faithfully is left as it is rather than half moved.
 */
export function mergeActionFiles(sources, header = []) {
  const lists = Object.fromEntries(ACTION_LISTS.map((name) => [name, []]));
  for (const { name, content } of sources) {
    const own = Object.fromEntries(ACTION_LISTS.map((list) => [list, []]));
    let current = null;
    // A file saved by a Windows editor can start with a byte order mark
    for (const line of content.replace(/^﻿/, "").replace(/\r\n/g, "\n").split("\n")) {
      // A blank line inside a block of text belongs to it, so it is kept
      if (line.trim() === "") {
        if (current) {
          own[current].push("");
        }
        continue;
      }
      if (/^#/.test(line) || line === "---") {
        continue;
      }
      const key = line.match(/^([A-Za-z][\w-]*):\s*$/);
      if (key) {
        if (!ACTION_LISTS.includes(key[1])) {
          throw new Error(`${name} holds ${key[1]}, which is not a list of deployment actions`);
        }
        current = key[1];
        continue;
      }
      // YAML also takes the items of a list at the column of its key
      if (!current || !/^(\s|- )/.test(line)) {
        throw new Error(`${name} has a line this cannot read: ${line.trim()}`);
      }
      own[current].push(line);
    }
    for (const list of ACTION_LISTS) {
      const lines = own[list];
      // The blank lines that end a file end its lists, not a block of text
      while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      // The items of one list share a column: each file is brought to two spaces,
      // whatever its own indent, or the merged file is not YAML any more
      const indent = Math.min(...lines.filter((line) => line !== "").map((line) => line.match(/^ */)[0].length));
      lists[list].push(...lines.map((line) => (line === "" ? "" : `  ${line.slice(indent)}`)));
    }
  }
  const ids = ACTION_LISTS.flatMap((name) => lists[name])
    .map((line) => line.match(/^\s*-\s+id:\s*(\S+)/))
    .filter(Boolean)
    .map((match) => match[1]);
  const twice = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (twice.length > 0) {
    throw new Error(`the id ${twice[0]} is used by two actions`);
  }
  const out = header.map((line) => `# ${line}`.trimEnd());
  for (const name of ACTION_LISTS) {
    if (lists[name].length > 0) {
      out.push(`${name}:`, ...lists[name]);
    }
  }
  return `${out.join("\n")}\n`;
}

/** True when a file written by mergeActionFiles holds a manual step to do before the deployment. */
export function hasPreDeployManualAction(merged) {
  let current = null;
  for (const line of merged.split("\n")) {
    current = line.match(/^([A-Za-z][\w-]*):\s*$/)?.[1] || current;
    // An item's own keys sit four spaces in, two past its dash
    if (current === "commandsPreDeploy" && /^ {2}(?:- | {2})type:\s*manual\s*$/.test(line)) {
      return true;
    }
  }
  return false;
}

/**
 * Ticks, in every comment of a Pull Request, the boxes of the pre-deployment
 * manual actions of one org branch: what a person does by clicking the box on
 * GitHub, where the markdown of the comment changes from [ ] to [x]. sfdx-hardis
 * reads the tick and records the action as done in that org branch.
 *
 * Takes the run function of util.mjs, and returns the ids of the actions ticked.
 */
export function tickPreDeployManualActions(run, slug, prNumber, orgBranch) {
  const escaped = orgBranch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The marker reads: <!-- sfdx-hardis-manual-action id:<id> org:<branch> pr:<n> when:pre-deploy -->
  const box = new RegExp(`- \\[ \\] (<!-- sfdx-hardis-manual-action [^>]*\\borg:${escaped} [^>]*\\bwhen:pre-deploy\\b[^>]*-->)`, "g");
  const listed = run("gh", ["api", `repos/${slug}/issues/${prNumber}/comments?per_page=100`, "--paginate"], { quiet: true, capture: true });
  if (listed.code !== 0) {
    return [];
  }
  let comments = [];
  try {
    comments = JSON.parse(listed.stdout || "[]");
  } catch {
    return [];
  }
  const ticked = new Set();
  for (const comment of comments) {
    const matches = (comment.body || "").match(box) || [];
    if (matches.length === 0) {
      continue;
    }
    const body = comment.body.replace(box, "- [x] $1");
    // The body goes through stdin: a checklist comment is longer than a command line takes on Windows
    const patched = run("gh", ["api", "-X", "PATCH", `repos/${slug}/issues/comments/${comment.id}`, "-F", "body=@-"], {
      quiet: true,
      capture: true,
      input: body
    });
    if (patched.code === 0) {
      matches.forEach((match) => ticked.add(match.match(/\bid:(\S+)/)?.[1]));
    }
  }
  return [...ticked];
}
