#!/usr/bin/env node
/**
 * Parses and validates a badge claim issue, and writes GitHub Actions outputs.
 *
 * Every field is untrusted input. Nothing here is ever interpolated into a shell
 * command by the workflow: values travel through the environment, and this script
 * refuses anything that does not match a strict shape.
 *
 * Reads: ISSUE_BODY, ISSUE_AUTHOR
 * Writes on stdout, for $GITHUB_OUTPUT:
 *   valid, reason, level, handle, trailblazer, trailblazer_name, trailblazer_state, repo
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchTrailblazerProfile } from "./trailblazer.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const body = process.env.ISSUE_BODY || "";
const author = (process.env.ISSUE_AUTHOR || "").trim();

/** The value of one issue-form field, addressed by its heading. */
function field(label) {
  // The body is cut on its "### " headings: JavaScript has no end-of-input anchor
  // like \Z, and a regular expression that believes it has one stops at the first z
  const section = body
    .split(/^###\s+/m)
    .find((part) => part.split(/\r?\n/)[0].trim().toLowerCase() === label.toLowerCase());
  if (section === undefined) {
    return "";
  }
  return section
    .split(/\r?\n/)
    .slice(1)
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && line !== "_No response_")
    .join("\n")
    .trim();
}

function output(values) {
  for (const [key, value] of Object.entries(values)) {
    const text = String(value ?? "");
    if (text.includes("\n")) {
      const delimiter = `EOF_${Math.random().toString(36).slice(2)}`;
      console.log(`${key}<<${delimiter}`);
      console.log(text);
      console.log(delimiter);
    } else {
      console.log(`${key}=${text}`);
    }
  }
}

function reject(reason) {
  output({ valid: "false", reason });
  process.exit(0);
}

// ------------------------------------------------------------------ level
const levelRaw = field("Level");
const levelMatch = levelRaw.match(/^([123])\b/);
if (!levelMatch) {
  reject(
    [
      "## This claim could not be read",
      "",
      "The **Level** field has to be 1, 2 or 3. Edit this issue and pick one from the list, and the",
      "audit runs again on its own."
    ].join("\n")
  );
}
const level = Number(levelMatch[1]);

// ------------------------------------------------------------ trailblazer
const trailblazer = field("Trailblazer username");
if (!/^[A-Za-z0-9._-]{1,60}$/.test(trailblazer)) {
  reject(
    [
      "## This claim could not be read",
      "",
      "The **Trailblazer username** field has to be a plain username: letters, digits, dots, hyphens",
      "and underscores, up to 60 characters. Not a URL.",
      "",
      "Edit this issue to correct it, and the audit runs again on its own."
    ].join("\n")
  );
}

// The shape being right does not make the profile real. A badge page links to
// this username for as long as the badge exists, and a username with nothing
// behind it makes the whole page look made up.
const profile = await fetchTrailblazerProfile(trailblazer);
if (profile.state === "missing") {
  reject(
    [
      "## That Trailblazer username does not exist",
      "",
      `There is no public Trailblazer profile for \`${trailblazer}\`.`,
      "",
      "Your badge page links to your profile, so the username has to be a real one. It is the last",
      "part of your own profile URL, and it is **not** your email or your Salesforce username:",
      "",
      "```",
      "https://www.salesforce.com/trailblazer/mytrailblazerusername",
      "                                       ^^^^^^^^^^^^^^^^^^^^^",
      "```",
      "",
      "If you do not have one yet, set it at <https://trailhead.salesforce.com/en/profile> under",
      "**Edit Profile**.",
      "",
      "Edit this issue with the right username, and the audit runs again on its own."
    ].join("\n")
  );
}
// `private` and `unknown` both pass. A private profile is a real one, and an API
// that could not be reached is not the learner's problem: a third party being
// down must never cost somebody a badge. Neither gives a name, and the badge
// falls back to the GitHub one.

// ------------------------------------------------------------- repository
const repoRaw = field("Public repository URL");
const repoMatch = repoRaw.match(/^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/);
if (!repoMatch) {
  reject(
    [
      "## This claim could not be read",
      "",
      "The **Public repository URL** field has to be a plain GitHub repository URL, like:",
      "",
      "```",
      "https://github.com/your-handle/sfdx-hardis-training",
      "```",
      "",
      "No trailing path, no branch, no `git@` form. Edit this issue to correct it, and the audit runs",
      "again on its own."
    ].join("\n")
  );
}

const [, owner, repo] = repoMatch;

if (`${owner}/${repo}`.toLowerCase() === "hardisgroupcom/sfdx-hardis-training") {
  reject(
    [
      "## That is this repository",
      "",
      "The **Public repository URL** has to be **your own** copy, the one you worked in. Everything in",
      "this course happens in your fork.",
      "",
      "Edit this issue with your repository URL, and the audit runs again on its own."
    ].join("\n")
  );
}

// The handle the badge is keyed by is the owner of the repository that was
// audited, because that is what the audit can actually prove. The issue author
// is recorded separately: claiming somebody else's repository proves nothing.
if (author && owner.toLowerCase() !== author.toLowerCase()) {
  reject(
    [
      "## The repository is not yours",
      "",
      `This issue was opened by \`${author}\`, and the repository belongs to \`${owner}\`.`,
      "",
      "A badge is awarded to the owner of the repository the audit reads, so the two have to match.",
      "If you worked in a repository under an organisation, fork it to your own account and claim",
      "that one.",
      "",
      "Edit this issue with a repository you own, and the audit runs again on its own."
    ].join("\n")
  );
}

// Badges are filed under the Trailblazer username, and nothing proves that the
// person opening this issue owns the one they typed. What the audit does prove
// is the GitHub repository, so the rule is first come: a username already
// carrying somebody else's badge cannot be taken, and a typo that lands on a
// stranger is refused rather than overwriting their page.
const existingRecord = path.join(ROOT, "badges", `${trailblazer}.json`);
if (fs.existsSync(existingRecord)) {
  let recipient = null;
  try {
    recipient = JSON.parse(fs.readFileSync(existingRecord, "utf8")).recipient || null;
  } catch {
    // An unreadable record blocks nobody: the award rewrites it anyway
  }
  if (recipient && recipient.toLowerCase() !== owner.toLowerCase()) {
    reject(
      [
        "## That Trailblazer username already belongs to somebody else",
        "",
        `The badges filed under \`${trailblazer}\` were awarded to the GitHub account \`${recipient}\`.`,
        "",
        "Badges are filed under the Trailblazer username, so two people cannot share one.",
        "",
        "If it was a typo, edit this issue with your own Trailblazer username and the audit runs again",
        "on its own. If that really is your username and this is not your GitHub account, open an issue",
        "saying so and it will be sorted out by hand."
      ].join("\n")
    );
  }
}

output({
  valid: "true",
  reason: "",
  level: String(level),
  handle: owner,
  trailblazer,
  trailblazer_name: profile.name || "",
  trailblazer_state: profile.state,
  repo: `https://github.com/${owner}/${repo}.git`
});
