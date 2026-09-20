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
 *   valid, reason, level, handle, trailblazer, repo
 */
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

output({
  valid: "true",
  reason: "",
  level: String(level),
  handle: owner,
  trailblazer,
  repo: `https://github.com/${owner}/${repo}.git`
});
