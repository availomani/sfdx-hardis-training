/**
 * Branch protection on the learner's fork.
 *
 * Without it, GitHub shows a green Merge button on a Pull Request whose
 * deployment check failed, and a merge made on red deploys nothing, or deploys
 * half of it. The course teaches that a red check stops the merge, so the fork
 * enforces it rather than hoping everybody reads the check first.
 *
 * What a protected branch requires here:
 *   - a Pull Request: nobody pushes to a major branch, the release manager
 *     included
 *   - every GitHub Actions check that runs on each Pull Request into a major
 *     branch has finished and succeeded
 *   - nobody bypasses it, the owner of the fork included, and nobody force
 *     pushes or deletes the branch
 *
 * No approval is required: a learner works alone and cannot approve their own
 * Pull Request, so requiring one would block every merge of the course.
 */
import { c, info, ok, warn, run, parseJsonOutput } from "./util.mjs";

// The checks GitHub Actions attaches to every Pull Request into a major branch,
// named the way GitHub names them: the job name, not the workflow file.
//   - "Simulate Deployment to Major Org" is check-deploy.yml, on every Pull
//     Request into integration, uat, preprod and main
//   - "Mega-Linter" is megalinter.yml, which runs on every push, so on the
//     head of every Pull Request opened from a branch of the fork
// A workflow that only runs when some paths change (link-check.yml) cannot be
// required: every Pull Request that does not touch those paths would wait for
// it forever.
export const REQUIRED_CHECKS = ["Simulate Deployment to Major Org", "Mega-Linter"];

function ghApi(args) {
  return run("gh", ["api", ...args], { capture: true, quiet: true });
}

/** The required checks of a branch, or null when the branch is not protected. */
export function protectionOf(slug, branch) {
  const res = ghApi([`repos/${slug}/branches/${branch}/protection`]);
  if (res.code !== 0) {
    return null;
  }
  const protection = parseJsonOutput(res.stdout);
  return {
    checks: protection?.required_status_checks?.contexts || [],
    enforceAdmins: protection?.enforce_admins?.enabled === true,
    pullRequest: Boolean(protection?.required_pull_request_reviews)
  };
}

/** True when the branch already requires every check, for everybody. */
export function isProtected(slug, branch) {
  const protection = protectionOf(slug, branch);
  return (
    protection !== null &&
    protection.enforceAdmins &&
    protection.pullRequest &&
    REQUIRED_CHECKS.every((check) => protection.checks.includes(check))
  );
}

export function protectBranch(slug, branch) {
  const res = ghApi([
    "-X", "PUT", `repos/${slug}/branches/${branch}/protection`,
    "-H", "Accept: application/vnd.github+json",
    "-F", "required_status_checks[strict]=false",
    ...REQUIRED_CHECKS.flatMap((check) => ["-f", `required_status_checks[contexts][]=${check}`]),
    "-F", "enforce_admins=true",
    "-F", "required_pull_request_reviews[required_approving_review_count]=0",
    "-F", "restrictions=null",
    "-F", "allow_force_pushes=false",
    "-F", "allow_deletions=false"
  ]);
  return res.code === 0;
}

export function unprotectBranch(slug, branch) {
  return ghApi(["-X", "DELETE", `repos/${slug}/branches/${branch}/protection`]).code === 0;
}

/**
 * Protects each branch, and says where to click when GitHub refuses.
 *
 * Returns true when every branch ended up protected.
 */
export function protectBranches(slug, branches) {
  let allProtected = true;
  for (const branch of branches) {
    if (isProtected(slug, branch)) {
      ok(`${c.bold(branch)} is already protected.`);
      continue;
    }
    if (protectBranch(slug, branch) && isProtected(slug, branch)) {
      ok(`${c.bold(branch)} now takes changes through a Pull Request only, merged once its checks are green.`);
      continue;
    }
    allProtected = false;
    warn(`${branch} could not be protected from here.`);
    info(`    Open https://github.com/${slug}/settings/branches, click ${c.bold("Add rule")},`);
    info(`    type ${c.bold(branch)} as the branch name pattern, tick ${c.bold("Require a pull request before merging")}`);
    info(`    with no approval, tick ${c.bold("Require status checks to pass before merging")},`);
    info(`    add ${REQUIRED_CHECKS.map((check) => c.bold(check)).join(" and ")},`);
    info(`    tick ${c.bold("Do not allow bypassing the above settings")}, then ${c.bold("Create")}.`);
  }
  return allProtected;
}

/**
 * Runs a push that a protected branch would refuse, and protects it again after.
 *
 * Two scripts of the course write straight to a major branch on the learner's
 * behalf: setting up the environment publishes the branch configuration, and
 * resetting a level force pushes integration. Both are the course repairing its
 * own state, not a contribution, so the protection is lifted for that one push
 * and put back whatever happened, with the course's own settings.
 */
export function withProtectionLifted(slug, branches, action) {
  const lifted = [];
  if (slug) {
    for (const branch of branches) {
      if (protectionOf(slug, branch) !== null && unprotectBranch(slug, branch)) {
        lifted.push(branch);
      }
    }
  }
  try {
    return action();
  } finally {
    for (const branch of lifted) {
      if (!protectBranch(slug, branch)) {
        warn(`${branch} is no longer protected, and putting the protection back failed.`);
        info("    Click Set up my training environment again: it protects integration and uat.");
      }
    }
  }
}
