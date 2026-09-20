/**
 * Training > Level 3 > Publish my pipeline configuration.
 *
 * The release manager owns the pipeline configuration: what the DevOps Pipeline
 * settings wrote, the certificates of Add/Configure Org, the .forceignore and the
 * package-no-overwrite list. Nobody pushes to a major branch, the release manager
 * included, and the branch protection refuses it: configuration goes through a
 * Pull Request into integration like everything else, and reaches the other major
 * branches with the next promotions.
 *
 * This takes the configuration files that changed, and nothing else, onto a
 * branch of their own, config/pipeline-<date>, pushes it and opens the Pull
 * Request. The release manager merges it once its checks are green.
 */
import fs from "fs";
import path from "path";
import { ROOT, c, title, info, ok, warn, abort, run, gitOut, confirm, repoSlug, hasGh } from "../lib/util.mjs";

// What a release manager configures, and nothing else: a feature never goes this way
const CONFIGURATION = [
  "config/.sfdx-hardis.yml",
  "config/branches",
  ".forceignore",
  "manifest/package-no-overwrite.xml"
];
const BASE = "integration";

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export default async function publish(args) {
  title("Publish my pipeline configuration");

  // git refuses a path that is neither on disk nor tracked: the no-overwrite list only
  // exists from Lab 3.5 on
  const paths = CONFIGURATION.filter((p) => fs.existsSync(path.join(ROOT, p)) || gitOut(["ls-files", "--", p]) !== "");
  const changed = gitOut(["status", "--porcelain", "--", ...paths])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (changed.length === 0) {
    ok("Nothing to publish: no configuration file changed on your disk.");
    return;
  }
  info("  The configuration you changed:");
  changed.forEach((line) => info(c.dim(`    ${line}`)));
  const others = gitOut(["status", "--porcelain"])
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !changed.includes(line));
  if (others.length > 0) {
    info("");
    info(c.dim("  Left out, because they are not configuration: a contributor brings them through a User Story."));
    others.forEach((line) => info(c.dim(`    ${line}`)));
  }
  const branch = args.branch || `config/pipeline-${stamp()}`;
  info("");
  const sure = args.yes === true || (await confirm(`Put it on a new branch, ${branch}, and open a Pull Request into ${BASE}?`, true));
  if (!sure) {
    info("Nothing was published.");
    return;
  }

  title("1 of 3  A branch for the configuration");
  run("git", ["fetch", "origin", BASE], { quiet: true });
  // The working tree follows the switch: the changed files come along, uncommitted
  if (run("git", ["switch", "-c", branch, `origin/${BASE}`]).code !== 0) {
    abort(
      `The branch ${branch} could not be created from ${BASE}.`,
      "A file you changed differs on GitHub too. Commit or undo it in the Source Control panel, then run this again."
    );
  }
  ok(`On ${branch}, made from the ${BASE} of your fork`);

  title("2 of 3  Committing the configuration");
  run("git", ["add", "--all", "--", ...paths]);
  const message = args.message || "Pipeline configuration, from the release manager";
  if (run("git", ["commit", "-m", message, "--", ...paths]).code !== 0) {
    abort("The configuration could not be committed.", "Git needs a name and an email first: Source Control panel, then commit once by hand.");
  }
  ok("Committed");

  title("3 of 3  Pushing it and opening the Pull Request");
  if (run("git", ["push", "-u", "origin", branch], { quiet: true, capture: true }).code !== 0) {
    warn("The push was refused. The commit is on your local branch: run Sync Changes in the Source Control panel when you are online.");
    return;
  }
  ok("Pushed");
  const slug = repoSlug();
  const body = [
    "Pipeline configuration, from the release manager. Nothing in it is a feature.",
    "",
    ...changed.map((line) => `- \`${line.replace(/^\S+\s+/, "")}\``),
    "",
    "Merge it with **Merge pull request**, not with a squash: the configuration travels to uat, preprod and main with the promotions."
  ].join("\n");
  const bodyFile = path.join(ROOT, ".training-pr-body.md");
  fs.writeFileSync(bodyFile, body, "utf8");
  let opened = false;
  if (hasGh() && slug) {
    for (let attempt = 1; attempt <= 3 && !opened; attempt++) {
      opened = run("gh", ["pr", "create", "--repo", slug, "--base", BASE, "--head", branch, "--title", message, "--body-file", bodyFile]).code === 0;
      if (!opened && attempt < 3) {
        run(process.execPath, ["-e", "const t = Date.now(); while (Date.now() - t < 2000) {}"], { quiet: true });
      }
    }
  }
  fs.rmSync(bodyFile, { force: true });
  if (!opened) {
    warn("The Pull Request could not be opened automatically.");
    info(`  Open it yourself: ${c.cyan(`https://github.com/${slug}/compare/${BASE}...${branch}?expand=1`)}`);
  } else {
    ok(`Pull Request opened into ${BASE}`);
  }

  // Back on integration: the configuration comes back to it with the merge
  run("git", ["switch", BASE], { quiet: true });

  title("Done");
  info(`  Wait for the checks of the Pull Request, then merge it with ${c.bold("Merge pull request")}.`);
  info(`  Then Pull in the Source Control panel: your ${BASE} gets the configuration back, merged.`);
}
