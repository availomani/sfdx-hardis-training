/**
 * Every rule that decides whether a lab was really done.
 *
 * The same rules run twice:
 *   - scripts/verify/check.mjs, locally, so a learner sees the result immediately
 *   - scripts/verify/audit.mjs, in the claim workflow, against a clone of their
 *     public repository
 *
 * Each rule has one or two checks:
 *   - check(ctx): what the level leaves behind in the fork, once every lab of it
 *     is done. The badge audit runs only this one, against a clone, and so does
 *     "Everything in level N".
 *   - now(ctx), when the lab needs it: what is true right after the lab, done
 *     well. "Check my work" on one lab runs it, on the learner's machine, where it
 *     may read the working copy and the orgs (ctx.local). A lab done right never
 *     fails it, whether it is run the minute the lab ends or three labs later, so
 *     every now() also passes once check() does.
 *
 * Two hard rules for anything written here, from section 15.4 of the spec:
 *
 *  1. Assert outcomes, never procedures. A learner who rebased, squashed or
 *     resolved a conflict through the GitHub web UI did the work and must pass.
 *     Never assert "a merge commit with two parents exists".
 *  2. A failure message names the lab, what was looked for, and where.
 *     It is the only support channel a learner has.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

// --------------------------------------------------------------- context
export function makeContext(dir, { local = false, sfQuery = null } = {}) {
  const git = (args) => {
    const res = spawnSync("git", args, { cwd: dir, encoding: "utf8", shell: false });
    return (res.stdout || "").trim();
  };
  // On the learner's machine the local branches are whatever they were at the last pull: a Pull
  // Request merged on GitHub is not in the local integration yet. What counts is the fork, so fetch
  // it first, and read the published branch before the local one.
  if (local) {
    spawnSync("git", ["fetch", "origin", "--prune", "--quiet"], { cwd: dir, encoding: "utf8", shell: false });
  }
  const refsOf = (branch) => (branch.startsWith("origin/") ? [branch] : [`origin/${branch}`, branch]);
  const branches = git(["branch", "-a", "--format=%(refname:short)"])
    .split("\n")
    .map((b) => b.replace(/^origin\//, "").trim())
    .filter(Boolean);

  const cache = new Map();
  /** File content on a branch, or null. Falls back to the working tree. */
  const readOn = (branch, file) => {
    const key = `${branch}::${file}`;
    if (cache.has(key)) {
      return cache.get(key);
    }
    let content = null;
    for (const ref of refsOf(branch)) {
      const res = spawnSync("git", ["show", `${ref}:${file}`], { cwd: dir, encoding: "utf8", shell: false });
      if (res.status === 0) {
        content = res.stdout;
        break;
      }
    }
    if (content === null && branch === currentBranch()) {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, "utf8");
      }
    }
    cache.set(key, content);
    return content;
  };
  const listOn = (branch, prefix) => {
    for (const ref of refsOf(branch)) {
      const res = spawnSync("git", ["ls-tree", "-r", "--name-only", ref], { cwd: dir, encoding: "utf8", shell: false });
      if (res.status === 0) {
        return res.stdout.split("\n").map((s) => s.trim()).filter((s) => s && s.startsWith(prefix));
      }
    }
    return [];
  };
  function currentBranch() {
    return git(["rev-parse", "--abbrev-ref", "HEAD"]);
  }
  const log = (branch) => {
    for (const ref of refsOf(branch)) {
      const res = spawnSync("git", ["log", "--format=%s%n%b", ref], { cwd: dir, encoding: "utf8", shell: false });
      if (res.status === 0) {
        return res.stdout;
      }
    }
    return "";
  };

  /** A file of the working copy, uncommitted changes included. Local checks only. */
  const readWorking = (file) => {
    const p = path.join(dir, file);
    return local && fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  };

  return {
    dir, git, branches, readOn, listOn, log, currentBranch, readWorking, local, sfQuery,
    hasBranch: (b) => branches.includes(b)
  };
}

// --------------------------------------------------------------- helpers
const DEV = "integration";

// A learner clicks Check my work when a lab is finished, which for Labs 1.3,
// 1.4 and 1.5 is before the Pull Request of Lab 1.6 puts anything into
// integration. Their work is real, it just lives on their story branch, so
// these rules look there too. Three red ticks in a row would teach them to
// stop clicking the button.
const readAnywhere = (ctx, file) => ctx.readOn(DEV, file) || ctx.readOn(ctx.currentBranch(), file);

// readAnywhere is for a file that only exists once the work is done, where the
// first version found is the only version there is. It is the wrong tool for a
// file the project already had, a permission set or a layout: integration
// carries one, so it wins the `||` and the learner's own branch is never read.
// Their work is then reported missing while it sits in their next commit.
const inAnyVersion = (ctx, file, holds) =>
  [ctx.readOn(DEV, file), ctx.readOn(ctx.currentBranch(), file)].some((content) => content && holds(content));
const FIELD = (obj, field) => `force-app/main/default/objects/${obj}/fields/${field}.field-meta.xml`;
const PERMSET = (name) => `force-app/main/default/permissionsets/${name}.permissionset-meta.xml`;

const pass = (detail) => ({ ok: true, detail });
const miss = (detail, where) => ({ ok: false, detail, where });

function fieldGrantedIn(content, field) {
  if (!content) {
    return false;
  }
  const block = new RegExp(
    `<fieldPermissions>\\s*(?:<editable>[^<]*</editable>\\s*)?<field>${field.replace(/[.$]/g, "\\$&")}</field>\\s*<readable>true</readable>`,
    "m"
  );
  return block.test(content.replace(/\r/g, ""));
}

function mentions(text, needle) {
  return typeof text === "string" && text.toLowerCase().includes(needle.toLowerCase());
}

/** The story branch a lab created, local or published, or null. */
function storyBranch(ctx, story) {
  const prefix = `features/${story}`;
  return ctx.branches.find((b) => b.startsWith(prefix)) || null;
}

/** True when the published copy of a branch exists: what Save / Publish pushed. */
function published(ctx, branch) {
  return ctx.git(["rev-parse", "--verify", "--quiet", `origin/${branch}`]) !== "";
}

/** The first rule result that passed, or the last one, whose message says what is missing. */
function firstPassing(...attempts) {
  let last = null;
  for (const attempt of attempts) {
    last = attempt();
    if (last.ok) {
      return last;
    }
  }
  return last;
}

const ruleCheck = (id) => (ctx) => RULES.find((r) => r.id === id).check(ctx);

/**
 * A hotfix in a history: the word itself, or a merge of a fix/ branch, which is how Lab 3.7 names
 * it (branchPrefixChoices) and how the DORA report of Lab 3.6 recognises one.
 */
const HOTFIX_RULE = "force-app/main/default/objects/Installation__c/validationRules/Installation_Date_Not_Past.validationRule-meta.xml";
/** The US-045 hotfix on a branch: the validation rule lets a cancelled installation be back-dated. */
const hasHotfix = (ctx, branch) => /ISPICKVAL\(Status__c,\s*(&quot;|")Cancelled(&quot;|")\)/.test(ctx.readOn(branch, HOTFIX_RULE) || "");

/**
 * The names of the Actions secrets of the learner's fork, or null when they cannot be read: no
 * GitHub CLI, or not signed in. The fork is origin, named explicitly: in a fork gh would pick the
 * parent repository by default.
 */
function forkSecretNames(ctx) {
  const url = ctx.git(["remote", "get-url", "origin"]);
  const slug = (url.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/) || [])[1];
  if (!slug) {
    return null;
  }
  const res = spawnSync("gh", ["secret", "list", "-R", slug, "--json", "name"], { cwd: ctx.dir, encoding: "utf8", shell: process.platform === "win32" });
  if (res.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(res.stdout).map((secret) => secret.name);
  } catch {
    return null;
  }
}

/** The dev org alias, as the universe names it. */
const DEV_ORG = "helios-dev";

// --------------------------------------------------------------- the rules
export const RULES = [
  // ------------------------------------------------------------- level 1
  {
    id: "1.2", level: 1, lab: 2,
    title: "Your fork has integration and uat branches, and each knows which org it deploys to",
    check: (ctx) => {
      if (!ctx.hasBranch(DEV)) {
        return miss(`no branch named "${DEV}"`, "your fork. Lab 1.2 creates it, or Reset this level restores it");
      }
      const rerun = "Run Set up my training environment again: it writes the file and pushes it";
      for (const branch of ["integration", "uat"]) {
        const file = `config/branches/.sfdx-hardis.${branch}.yml`;
        const config = ctx.readOn(DEV, file);
        if (!config) {
          return miss(`${file} is missing`, `branch ${DEV}. ${rerun}`);
        }
        const hasOrg = /targetUsername:[ \t]*["']?[^"'\s][^\n]*/.test(config) &&
          !/targetUsername:\s*["']{2}\s*$/m.test(config);
        if (!hasOrg) {
          return miss(`targetUsername is still empty in ${file}`, `branch ${DEV}. ${rerun}`);
        }
      }
      return pass("integration and uat both name their org");
    }
  },
  {
    id: "1.3", level: 1, lab: 3,
    title: "US-014 was taken from the backlog on its own branch",
    // Right after the lab there is a branch and nothing in it yet: that is the lab
    // done. Once the story is merged, the branch may be gone and the history says it.
    now: (ctx) => {
      const branch = storyBranch(ctx, "US-014");
      if (branch) {
        return pass(`Your story branch ${branch} exists`);
      }
      return ctx.readOn(DEV, FIELD("Installation__c", "Panels_Required__c"))
        ? pass("US-014 is already merged into integration")
        : miss(
          "no branch starting with features/US-014",
          "your local branches and your fork. New User Story creates it: pick US-014 and answer the questions of steps 2 to 5"
        );
    },
    check: (ctx) => {
      // The story's own branch, or what it delivered once merged and the branch deleted
      const branch = storyBranch(ctx, "US-014");
      if (branch) {
        return pass(`Your story branch ${branch} exists`);
      }
      return readAnywhere(ctx, FIELD("Installation__c", "Panels_Required__c"))
        ? pass("US-014 was delivered: Panels_Required__c is on integration")
        : miss("no branch starting with features/US-014, and US-014 is not on integration", `your branches and ${DEV}`);
    }
  },
  {
    id: "1.4", level: 1, lab: 4,
    title: "Panels Required exists on Installation and the crew can read it",
    // Lab 1.4 ends with the field in the org and nowhere else: the repository only
    // learns about it in Lab 1.5. So right after the lab, the org is what to read.
    now: (ctx) => firstPassing(
      () => ruleCheck("1.4")(ctx),
      () => {
        if (!ctx.sfQuery) {
          return miss("your dev org could not be read from here", `${DEV_ORG}. Check it is connected in Orgs Manager`);
        }
        // The Tooling API, because FieldDefinition hides a field from a user who
        // cannot see it, and not seeing it is one of the mistakes this checks for
        const objects = ctx.sfQuery(DEV_ORG, "SELECT Id FROM CustomObject WHERE DeveloperName = 'Installation'", { tooling: true });
        if (objects === null || objects.length === 0) {
          return miss("your dev org could not be queried", `${DEV_ORG}. Reconnect it in Orgs Manager, then run this again`);
        }
        const fields = ctx.sfQuery(
          DEV_ORG,
          `SELECT Id FROM CustomField WHERE DeveloperName = 'Panels_Required' AND TableEnumOrId = '${objects[0].Id}'`,
          { tooling: true }
        );
        if (!fields || fields.length === 0) {
          return miss("there is no Panels_Required__c field on Installation", `the org ${DEV_ORG}. Step 2 creates it`);
        }
        const granted = (permset, access) => (ctx.sfQuery(
          DEV_ORG,
          `SELECT Id FROM FieldPermissions WHERE Parent.Name = '${permset}' AND Field = 'Installation__c.Panels_Required__c' AND ${access} = true`
        ) || []).length > 0;
        if (!granted("Helios_Delivery_Crew", "PermissionsRead")) {
          return miss(
            "the field exists, but the Helios_Delivery_Crew permission set does not grant read access to it",
            `the org ${DEV_ORG}, Setup > Permission Sets > Helios Delivery Crew > Object Settings > Installations`
          );
        }
        return granted("Helios_Delivery_Manager", "PermissionsEdit")
          ? pass(`Panels Required exists in ${DEV_ORG}, the crew can read it and the planners can fill it in`)
          : miss(
            "the crew can read the field, but Helios_Delivery_Manager does not grant edit access to it, so no planner can fill it in",
            `the org ${DEV_ORG}, Setup > Permission Sets > Helios Delivery Manager > Object Settings > Installations`
          );
      }
    ),
    check: (ctx) => {
      const field = readAnywhere(ctx, FIELD("Installation__c", "Panels_Required__c"));
      if (!field) {
        return miss(
          "Installation__c.Panels_Required__c was not found",
          `${FIELD("Installation__c", "Panels_Required__c")} on ${DEV} or on your current branch`
        );
      }
      return inAnyVersion(ctx, PERMSET("Helios_Delivery_Crew"), (crew) =>
        fieldGrantedIn(crew, "Installation__c.Panels_Required__c"))
        ? pass("The field exists and the crew permission set grants it")
        : miss(
          "the field exists, but Helios_Delivery_Crew does not grant read access to it",
          `${PERMSET("Helios_Delivery_Crew")} on ${DEV} or on your current branch`
        );
    }
  },
  {
    id: "1.5", level: 1, lab: 5,
    title: "Panels Required is on the Installation layout",
    // Lab 1.5 ends with the story published on its own branch, before any Pull
    // Request: the published branch is what has to carry the three components.
    now: (ctx) => firstPassing(
      () => ruleCheck("1.6")(ctx),
      () => {
        const branch = storyBranch(ctx, "US-014");
        if (!branch) {
          return miss("no branch starting with features/US-014", "your local branches and your fork. Lab 1.3 creates it");
        }
        const where = `branch ${branch} in your fork`;
        if (!published(ctx, branch)) {
          return miss(
            `${branch} exists on your machine but was never published`,
            "your fork. Save / Publish pushes it: answer Yes when it asks"
          );
        }
        const ref = `origin/${branch}`;
        if (!ctx.readOn(ref, FIELD("Installation__c", "Panels_Required__c"))) {
          return miss("the Panels_Required__c field is not in the published branch", `${where}. Retrieve it (step 1), commit it and publish again`);
        }
        if (!fieldGrantedIn(ctx.readOn(ref, PERMSET("Helios_Delivery_Crew")), "Installation__c.Panels_Required__c")) {
          return miss("Helios_Delivery_Crew in the published branch does not grant the field", `${PERMSET("Helios_Delivery_Crew")} on ${where}`);
        }
        if (!fieldGrantedIn(ctx.readOn(ref, PERMSET("Helios_Delivery_Manager")), "Installation__c.Panels_Required__c")) {
          return miss("Helios_Delivery_Manager in the published branch does not grant the field", `${PERMSET("Helios_Delivery_Manager")} on ${where}`);
        }
        const layout = ctx.readOn(ref, "force-app/main/default/layouts/Installation__c-Installation Layout.layout-meta.xml");
        return mentions(layout, "Panels_Required__c")
          ? pass(`The field, both permission sets and the layout are published on ${branch}`)
          : miss("the Installation layout in the published branch does not carry the field", `the Installation layout on ${where}`);
      }
    ),
    check: (ctx) => {
      return inAnyVersion(ctx, "force-app/main/default/layouts/Installation__c-Installation Layout.layout-meta.xml", (layout) =>
        mentions(layout, "Panels_Required__c"))
        ? pass("The layout carries the new field")
        : miss(
          "Panels_Required__c is not on the Installation layout",
          "force-app/main/default/layouts/Installation__c-Installation Layout.layout-meta.xml on integration or on your current branch"
        );
    }
  },
  {
    id: "1.6", level: 1, lab: 6,
    title: "US-014 reached integration through a Pull Request",
    check: (ctx) => {
      const field = ctx.readOn(DEV, FIELD("Installation__c", "Panels_Required__c"));
      return field
        ? pass("The field reached integration through a Pull Request")
        : miss("Panels_Required__c is not on integration yet", `branch ${DEV}`);
    }
  },
  {
    id: "1.7", level: 1, lab: 7,
    title: "Capstone: US-016 delivered on your own",
    check: (ctx) => {
      const field = ctx.readOn(DEV, FIELD("Installation__c", "Crew_Notes__c"));
      if (!field) {
        return miss(
          "Installation__c.Crew_Notes__c was not found",
          `${FIELD("Installation__c", "Crew_Notes__c")} on branch ${DEV}`
        );
      }
      const crew = ctx.readOn(DEV, PERMSET("Helios_Delivery_Crew"));
      if (!fieldGrantedIn(crew, "Installation__c.Crew_Notes__c")) {
        return miss(
          "Crew_Notes__c is not granted on Helios_Delivery_Crew",
          `${PERMSET("Helios_Delivery_Crew")} on branch ${DEV}`
        );
      }
      // US-016 asks for the list view as well
      const listView = ctx.readOn(DEV, "force-app/main/default/objects/Installation__c/listViews/Open_Installations.listView-meta.xml");
      return listView
        ? pass("Crew Notes, its permission and the Open Installations list view are on integration")
        : miss(
          "the Open Installations list view was not found",
          `force-app/main/default/objects/Installation__c/listViews/Open_Installations.listView-meta.xml on branch ${DEV}`
        );
    }
  },

  // ------------------------------------------------------------- level 2
  {
    id: "2.1", level: 2, lab: 1, auditable: false,
    title: "Your dev org is level with integration",
    // The proof is in the org: Romain's field reached helios-dev. Only the learner's
    // machine can read it, so the badge audit leaves this lab out.
    now: (ctx) => firstPassing(
      () => ruleCheck("2.1")(ctx),
      () => {
        if (!ctx.sfQuery) {
          return miss("your dev org could not be read from here", `${DEV_ORG}. Check it is connected in Orgs Manager`);
        }
        const objects = ctx.sfQuery(DEV_ORG, "SELECT Id FROM CustomObject WHERE DeveloperName = 'Installation'", { tooling: true });
        if (!objects || objects.length === 0) {
          return miss("your dev org could not be queried", `${DEV_ORG}. Reconnect it in Orgs Manager, then run this again`);
        }
        const fields = ctx.sfQuery(
          DEV_ORG,
          `SELECT Id FROM CustomField WHERE DeveloperName = 'Signed_Off_By' AND TableEnumOrId = '${objects[0].Id}'`,
          { tooling: true }
        );
        return fields && fields.length > 0
          ? pass(`Romain's Signed Off By field reached ${DEV_ORG}: your org is level with integration`)
          : miss(
            "Romain's Signed_Off_By__c field is not in your dev org, so the backpromote did not bring it",
            `the org ${DEV_ORG}. Merge his US-017 Pull Request first (step 1), then run the backpromote again`
          );
      }
    ),
    check: (ctx) => {
      // What there was to backpromote: Romain's US-017, merged into integration
      return ctx.readOn(DEV, FIELD("Installation__c", "Signed_Off_By__c"))
        ? pass("Romain's US-017 is in integration, the work your dev org had to catch up with")
        : miss(
          "Romain's US-017 was never merged, so there was nothing to backpromote",
          `${FIELD("Installation__c", "Signed_Off_By__c")} on branch ${DEV}. Lab 2.1 step 1 merges it`
        );
    }
  },
  {
    id: "2.2", level: 2, lab: 2,
    title: "US-021: the warning flow warns once, and the field it needs deployed with it",
    check: (ctx) => {
      const flowFile = "force-app/main/default/flows/Installation_Crew_Warning.flow-meta.xml";
      const flow = ctx.readOn(DEV, flowFile) || "";
      if (!/Crew_Warning_Sent__c/.test(flow)) {
        return miss(
          "Installation_Crew_Warning does not read Crew_Warning_Sent__c yet, so it still warns on every save",
          `${flowFile} on branch ${DEV}`
        );
      }
      const field = ctx.readOn(DEV, FIELD("Installation__c", "Crew_Warning_Sent__c"));
      return field
        ? pass("The flow warns once, and the field it reads is versioned")
        : miss(
          "Installation__c.Crew_Warning_Sent__c never reached the sources: the flow reads a field the package does not carry",
          `${FIELD("Installation__c", "Crew_Warning_Sent__c")} on branch ${DEV}`
        );
    }
  },
  {
    id: "2.3", level: 2, lab: 3,
    title: "US-024: Crew Size is required, and an Apex action backfills the old records",
    check: (ctx) => {
      const field = ctx.readOn(DEV, FIELD("Installation__c", "Crew_Size__c")) || "";
      if (!/<required>true<\/required>/.test(field)) {
        return miss(
          "Crew_Size__c is still optional",
          `${FIELD("Installation__c", "Crew_Size__c")} on branch ${DEV}`
        );
      }
      const actions = ctx.listOn(DEV, "config/branches/").concat(ctx.listOn(DEV, "scripts/actions/"));
      const withApex = actions.some((f) => {
        const content = ctx.readOn(DEV, f) || "";
        return /apexScript|commandsPreDeploy|commandsPostDeploy/.test(content) && /Crew_Size|backfill/i.test(content);
      });
      return withApex
        ? pass("The field is required and the backfill action is declared")
        : miss(
          "no post-deploy Apex action that backfills Crew Size was found",
          `config/branches/ and scripts/actions/ on branch ${DEV}`
        );
    }
  },
  {
    id: "2.4", level: 2, lab: 4,
    title: "US-026: the reference data and the batch follow the deployment",
    check: (ctx) => {
      const workspaces = ctx.listOn(DEV, "scripts/data/");
      if (!workspaces.some((f) => /CrewRefData|CrewCapacity/i.test(f))) {
        return miss(
          "no crew capacity data workspace was found",
          `scripts/data/ on branch ${DEV}, expected a folder such as HeliosCrewRefData with an export.json`
        );
      }
      const actionFiles = ctx.listOn(DEV, "config/branches/").concat(ctx.listOn(DEV, "scripts/actions/"));
      const text = actionFiles.map((f) => ctx.readOn(DEV, f) || "").join("\n");
      const hasData = /dataImport|data:import|HeliosCrewRefData|CrewCapacity/i.test(text);
      const hasSchedule = /schedule|CrewCapacityBatch/i.test(text);
      // The word on its own matches a comment. A declared manual action carries
      // the type, which is what the Deployment Actions editor writes.
      const hasManual = /type:\s*["']?manual\b/i.test(text);
      const missing = [
        !hasData ? "the data import action" : null,
        !hasSchedule ? "the batch schedule action" : null,
        !hasManual ? "the manual step" : null
      ].filter(Boolean);
      return missing.length === 0
        ? pass("Data import, batch schedule and manual step are all declared")
        : miss(
          `these deployment actions are missing: ${missing.join(", ")}`,
          `config/branches/ and scripts/actions/ on branch ${DEV}`
        );
    }
  },
  {
    id: "2.5", level: 2, lab: 5,
    title: "US-027: the query is out of the loop and the scheduler is covered",
    check: (ctx) => {
      const cls = ctx.readOn(DEV, "force-app/main/default/classes/InstallationScheduler.cls") || "";
      if (!/schedulableOn/.test(cls)) {
        return miss(
          "schedulableOn was not found in InstallationScheduler",
          `force-app/main/default/classes/InstallationScheduler.cls on branch ${DEV}`
        );
      }
      // The outcome, not the procedure: the query has to be out of the loop. Any
      // shape that queries once for the whole list passes, which is what an IN bind
      // on the collection looks like however it is written.
      // A learner who adds a bulk query but leaves the per-record one inside the
      // loop has fixed nothing, and the governor limit is still reached. Read
      // schedulableOn alone: the class also ships earliestInstallDate, which
      // queries one installation on purpose and is none of this lab's business.
      const fromMethod = cls.slice(cls.indexOf("schedulableOn"));
      const nextMethod = fromMethod.search(/\n {4}(public|private|protected|static)\s/);
      const body = nextMethod === -1 ? fromMethod : fromMethod.slice(0, nextMethod);
      if (/WHERE\s+Installation__c\s*=\s*:/i.test(body)) {
        return miss(
          "schedulableOn still queries one installation at a time inside its loop, whatever else was added beside it",
          `force-app/main/default/classes/InstallationScheduler.cls on branch ${DEV}, expected that query to be gone from schedulableOn`
        );
      }
      if (!/WHERE\s+Installation__c\s+IN\s*:/i.test(cls)) {
        return miss(
          "schedulableOn still queries inside its loop: one SOQL per installation hits the governor limit",
          `force-app/main/default/classes/InstallationScheduler.cls on branch ${DEV}, expected a single query binding the whole list`
        );
      }
      const test = ctx.readOn(DEV, "force-app/main/default/classes/InstallationSchedulerTest.cls") || "";
      return /schedulableOn/.test(test) && /@isTest/.test(test)
        ? pass("The query is out of the loop, and the new behaviour has a test")
        : miss(
          "InstallationSchedulerTest does not cover schedulableOn",
          `force-app/main/default/classes/InstallationSchedulerTest.cls on branch ${DEV}`
        );
    }
  },
  {
    id: "2.6", level: 2, lab: 6,
    title: "US-033: the batch cost permission moved to the permission set",
    check: (ctx) => {
      const crew = ctx.readOn(DEV, PERMSET("Helios_Delivery_Crew"));
      if (!crew) {
        return miss("Helios_Delivery_Crew is missing", `${PERMSET("Helios_Delivery_Crew")} on branch ${DEV}`);
      }
      if (!fieldGrantedIn(crew, "Panel_Batch__c.Cost__c")) {
        return miss(
          "Panel_Batch__c.Cost__c is not granted on Helios_Delivery_Crew",
          `${PERMSET("Helios_Delivery_Crew")} on branch ${DEV}`
        );
      }
      // The Profiles stay in the sources, short: the permission must not live there
      const crewProfile = "force-app/main/default/profiles/Helios Crew.profile-meta.xml";
      const profile = ctx.readOn(DEV, crewProfile);
      if (!profile) {
        return miss(
          "the Helios Crew profile is gone from the sources. Profiles stay in the repository and are deployed; only their permissions move to permission sets",
          `${crewProfile} on branch ${DEV}`
        );
      }
      return /<fieldPermissions>/.test(profile)
        ? miss(
          "the Helios Crew profile carries field permissions, which minimizeProfiles removes on every publish. Publish it again with Save / Publish",
          `${crewProfile} on branch ${DEV}`
        )
        : pass("The permission lives on the permission set, and the Helios Crew profile is still in the sources");
    }
  },
  {
    id: "2.7", level: 2, lab: 7,
    title: "The conflict with Mariia is resolved, and both sides survived",
    check: (ctx) => {
      const flows = ctx.listOn(DEV, "force-app/main/default/flows/");
      const assign = flows.find((f) => /Assign_Crew/i.test(f));
      if (!assign) {
        return miss("Installation_Assign_Crew is missing from the sources", `force-app/main/default/flows/ on branch ${DEV}`);
      }
      const flow = ctx.readOn(DEV, assign) || "";
      if (/<{7}|>{7}|={7}/.test(flow)) {
        return miss(
          "the flow still contains git conflict markers",
          `${assign} on branch ${DEV}`
        );
      }
      const hasCap = /cap|maximum|Crew_Capacity|too large/i.test(flow);
      if (!hasCap) {
        return miss(
          "the crew capacity cap from US-018 is not in the flow, so one side of the conflict was lost",
          `${assign} on branch ${DEV}`
        );
      }
      // Its own message: a learner told to look at the flow while the markers
      // are in the permission set can stare at a correct flow forever
      const manager = ctx.readOn(DEV, PERMSET("Helios_Delivery_Manager")) || "";
      if (/<{7}|>{7}|={7}/.test(manager)) {
        return miss(
          "the permission set still contains git conflict markers",
          `${PERMSET("Helios_Delivery_Manager")} on branch ${DEV}`
        );
      }
      return pass("Mariia's cap and your change are both in integration, with no conflict markers left");
    }
  },
  {
    id: "2.8", level: 2, lab: 8, auditable: true,
    title: "The repository carries only what belongs to it",
    check: (ctx) => {
      // Deployment.settings is the one setting this project ships on purpose: it
      // is what lets a deployment run while the Lab 2.4 batch is scheduled.
      // The course ships two short Profiles on purpose (Lab 2.6). A whole-org retrieve
      // brings Admin back with every field and user permission of the org, and the
      // cleaning keeps the user permissions of Admin: the short one has neither.
      const shipped = (f) => {
        if (!/\/profiles\/(Admin|Helios Crew)\.profile-meta\.xml$/.test(f)) {
          return false;
        }
        const profile = ctx.readOn(DEV, f) || "";
        return !/<(fieldPermissions|userPermissions|objectPermissions)>/.test(profile);
      };
      const stray = ctx.listOn(DEV, "force-app/main/default/").filter((f) =>
        /\/(profiles|settings|standardValueSets|objectTranslations|networks)\//.test(f) &&
        !f.endsWith("/settings/Deployment.settings-meta.xml") &&
        !shipped(f)
      );
      return stray.length === 0
        ? pass("No over-committed metadata is left on integration")
        : miss(
          `${stray.length} file(s) that should never have been committed are on integration: ${stray.slice(0, 3).join(", ")}`,
          `branch ${DEV}. Lab 2.8 is about resetting a selection that went too wide`
        );
    }
  },
  {
    id: "2.9", level: 2, lab: 9,
    title: "Capstone: US-041, the handover checklist",
    check: (ctx) => {
      const objects = ctx.listOn(DEV, "force-app/main/default/objects/");
      if (!objects.some((f) => /Handover_Item__c/.test(f))) {
        return miss(
          "the Handover_Item__c object was not found",
          `force-app/main/default/objects/ on branch ${DEV}`
        );
      }
      const workspaces = ctx.listOn(DEV, "scripts/data/");
      if (!workspaces.some((f) => /Handover/i.test(f))) {
        return miss(
          "no data workspace loads the checklist reference items",
          `scripts/data/ on branch ${DEV}`
        );
      }
      // The close check exists from Level 1: US-041 is done when it reads the checklist
      const closeCheck = "force-app/main/default/flows/Installation_Close_Check.flow-meta.xml";
      return /Handover_Item__c/.test(ctx.readOn(DEV, closeCheck) || "")
        ? pass("Object, reference data and the close check are all in integration")
        : miss("Installation Close Check does not look at the handover checklist yet", `${closeCheck} on branch ${DEV}`);
    }
  },

  // ------------------------------------------------------------- level 3
  {
    id: "3.1", level: 3, lab: 1,
    title: "The pipeline reaches production, and every org authenticates with JWT",
    check: (ctx) => {
      const missingBranches = ["uat", "preprod", "main"].filter((b) => !ctx.hasBranch(b));
      if (missingBranches.length > 0) {
        return miss(`these branches do not exist: ${missingBranches.join(", ")}`, "your fork");
      }
      // Lab 3.1 writes this on the branch the release manager is standing on, and
      // it only reaches main with the first promotion, several labs later. Either
      // branch carrying it means the pipeline was configured.
      const project = [ctx.readOn("main", "config/.sfdx-hardis.yml"), ctx.readOn(DEV, "config/.sfdx-hardis.yml")]
        .filter(Boolean)
        .join("\n");
      if (!/availableTargetBranches:[\s\S]{0,200}preprod/.test(project)) {
        return miss(
          "preprod is not listed under availableTargetBranches, so nobody can start a hotfix",
          "config/.sfdx-hardis.yml"
        );
      }
      const configs = ctx.listOn("main", "config/branches/").concat(ctx.listOn(DEV, "config/branches/"));
      const missing = ["preprod", "main"].filter((b) => !configs.some((f) => f.endsWith(`.sfdx-hardis.${b}.yml`)));
      if (missing.length > 0) {
        return miss(`missing branch configuration: ${missing.join(", ")}`, "config/branches/. Add/Configure Org writes it, Lab 3.1 steps 4 to 7");
      }
      const branches = ["integration", "uat", "preprod", "main"];
      const notConfigured = [];
      for (const b of branches) {
        // Whichever branch carries the configured file counts: the release
        // manager writes it where they stand, and it reaches main with the
        // first promotion, several labs later.
        const cfg = [ctx.readOn(DEV, `config/branches/.sfdx-hardis.${b}.yml`), ctx.readOn("main", `config/branches/.sfdx-hardis.${b}.yml`)]
          .filter(Boolean)
          .find((text) => /targetUsername:[ \t]*["']?[^"'\s]/.test(text) && /instanceUrl:[ \t]*["']?https/.test(text)) || "";
        const hasUser = /targetUsername:[ \t]*["']?[^"'\s]/.test(cfg);
        const hasUrl = /instanceUrl:[ \t]*["']?https/.test(cfg);
        if (!hasUser || !hasUrl) {
          notConfigured.push(b);
        }
      }
      if (notConfigured.length > 0) {
        return miss(
          `targetUsername or instanceUrl is missing for: ${notConfigured.join(", ")}`,
          "config/branches/. sf hardis:project:configure:auth writes both"
        );
      }
      // The encrypted key files are published with the rest of the pipeline configuration
      const keys = ctx.listOn(DEV, "config/branches/.jwt/").concat(ctx.listOn("main", "config/branches/.jwt/"));
      const noKey = branches.filter((b) => !keys.some((f) => f.endsWith(`/${b}.key`)));
      if (noKey.length > 0) {
        return miss(
          `no encrypted key file for: ${noKey.join(", ")}`,
          "config/branches/.jwt/ on integration. Add/Configure Org writes them, and Publish my pipeline configuration puts them there"
        );
      }
      const devProject = ctx.readOn(DEV, "config/.sfdx-hardis.yml") || "";
      if (!/orgAuthenticationMode:\s*["']?encryptedCert/.test(devProject)) {
        return miss(
          "orgAuthenticationMode still says the pipeline has no certificates",
          `config/.sfdx-hardis.yml on branch ${DEV}, expected orgAuthenticationMode: encryptedCert (Lab 3.1 step 9)`
        );
      }
      // The secrets of the fork are only visible from the learner's machine, through gh
      const secrets = ctx.local ? forkSecretNames(ctx) : null;
      const shortcuts = (secrets || []).filter((name) => /^SFDX_AUTH_URL_/.test(name));
      return shortcuts.length === 0
        ? pass("The four orgs authenticate with JWT, and the Level 1 shortcut is gone")
        : miss(
          `the Level 1 shortcut is still there: ${shortcuts.join(", ")}`,
          "your fork, Settings > Secrets and variables > Actions. Lab 3.1 step 10 deletes them"
        );
    }
  },
  {
    id: "3.2", level: 3, lab: 2,
    title: "Mariia's US-052 was reviewed before the merge, and no field left the layout",
    check: (ctx) => {
      // The outcome of the story and of the review: the cap moved to the second column
      // of the Information section, and Total Capacity is on the layout too
      const layoutFile = "force-app/main/default/layouts/Installation__c-Installation Layout.layout-meta.xml";
      const layout = ctx.readOn(DEV, layoutFile) || "";
      const information = (layout.split("<layoutSections>").find((s) => s.includes("<label>Information</label>")) || "");
      const columns = information.split("<layoutColumns").slice(1);
      const second = columns[1] || "";
      if (!second.includes("<field>Crew_Capacity_Cap__c</field>")) {
        return miss(
          "the crew capacity cap is not in the second column of the Information section: US-052 is not merged",
          `${layoutFile} on branch ${DEV}`
        );
      }
      return layout.includes("<field>Total_Capacity_kW__c</field>")
        ? pass("US-052 is merged, and Total_Capacity_kW__c is still on the Installation layout")
        : miss(
          "Total_Capacity_kW__c is missing from the Installation layout. Steps 4 to 6 ask Mariia to put it back before the merge",
          `${layoutFile} on branch ${DEV}`
        );
    }
  },
  {
    id: "3.3", level: 3, lab: 3,
    title: "Romain's US-056 deploys, and .forceignore hides nothing it should not",
    check: (ctx) => {
      const forceignore = ctx.readOn(DEV, ".forceignore") || "";
      if (/Crew_W\*/.test(forceignore)) {
        return miss(
          "the Crew_W* wildcard is still in .forceignore, so any field whose name starts with Crew_W stays out of every deployment",
          `.forceignore on branch ${DEV}. Lab 3.3 step 8 sends it back to Romain`
        );
      }
      return ctx.readOn(DEV, FIELD("Installation__c", "Crew_Workload__c"))
        ? pass("US-056 is merged, and its field deploys")
        : miss(
          "Romain's US-056 is not merged into integration yet",
          `${FIELD("Installation__c", "Crew_Workload__c")} on branch ${DEV}`
        );
    }
  },
  {
    id: "3.4", level: 3, lab: 4,
    title: "The colliding Pull Requests were ordered, and both grants survived",
    check: (ctx) => {
      // US-020 is deliberately NOT checked here: Lab 3.4 sends it back to its author
      // and no lab ever merges it. Requiring it would make this check unpassable.
      const missing = [
        ["US-018", FIELD("Installation__c", "Crew_Capacity_Cap__c")],
        ["US-019", FIELD("Panel_Batch__c", "Quote_Pdf_Url__c")]
      ].filter(([, file]) => !ctx.readOn(DEV, file)).map(([id]) => id);
      if (missing.length > 0) {
        return miss(`these stories never reached integration: ${missing.join(", ")}`, `their fields on branch ${DEV}`);
      }
      const manager = ctx.readOn(DEV, PERMSET("Helios_Delivery_Manager")) || "";
      if (/<{7}|>{7}|={7}/.test(manager)) {
        return miss("Helios_Delivery_Manager still contains conflict markers", `${PERMSET("Helios_Delivery_Manager")} on branch ${DEV}`);
      }
      const lostGrants = ["Crew_Capacity_Cap__c", "Quote_Pdf_Url__c"].filter((f) => !manager.includes(f));
      return lostGrants.length === 0
        ? pass("Both stories are merged and Helios_Delivery_Manager carries both grants")
        : miss(
          `Helios_Delivery_Manager lost these grants: ${lostGrants.join(", ")}`,
          `${PERMSET("Helios_Delivery_Manager")} on branch ${DEV}`
        );
    }
  },
  {
    id: "3.5", level: 3, lab: 5,
    title: "Integration was promoted to UAT, without overwriting what UAT keeps for itself",
    check: (ctx) => {
      if (!ctx.hasBranch("uat")) {
        return miss("there is no uat branch", "your fork");
      }
      const field = ctx.readOn("uat", FIELD("Installation__c", "Panels_Required__c"));
      if (!field) {
        return miss(
          "uat does not carry the Level 1 and Level 2 work, so integration was never promoted into it",
          `${FIELD("Installation__c", "Panels_Required__c")} on branch uat`
        );
      }
      // Published before the promotion, so it reached uat with it
      const noOverwrite = ctx.readOn("uat", "manifest/package-no-overwrite.xml") || ctx.readOn(DEV, "manifest/package-no-overwrite.xml") || "";
      return /Helios_Warehouse/.test(noOverwrite)
        ? pass("The work reached uat, and the warehouse address UAT keeps for itself is protected")
        : miss(
          "Helios_Warehouse is not in the overwrite manager's list, so a promotion puts the production address back in UAT",
          `manifest/package-no-overwrite.xml on branch ${DEV}. Lab 3.5 step 2 creates it`
        );
    }
  },
  {
    id: "3.6", level: 3, lab: 6,
    title: "UAT was released to production, and the DORA report was read",
    // Right after the lab, the DORA report is a file on the learner's machine: never committed,
    // so only Check my work can see it
    now: (ctx) => {
      const released = ruleCheck("3.6")(ctx);
      if (!released.ok) {
        return released;
      }
      const doraDir = path.join(ctx.dir, "docs", "dora");
      const reports = fs.existsSync(doraDir) ? fs.readdirSync(doraDir).filter((f) => /^dora-report.*\.md$/.test(f)) : [];
      return reports.length > 0
        ? pass("Production has the work, and the DORA report is there to read")
        : miss("no DORA report was generated", "docs/dora/ in your project. Lab 3.6 step 7, Generate DORA Metrics Report");
    },
    check: (ctx) => {
      if (!ctx.hasBranch("main")) {
        return miss("there is no main branch", "your fork");
      }
      const field = ctx.readOn("main", FIELD("Installation__c", "Panels_Required__c"));
      if (!field) {
        return miss(
          "main does not carry the work, so uat was never released into it",
          `${FIELD("Installation__c", "Panels_Required__c")} on branch main`
        );
      }
      return pass("Production has the work");
    }
  },
  {
    id: "3.7", level: 3, lab: 7,
    title: "The hotfix shipped, and the retrofit brought it back down",
    // The lab ends with the retrofit merged into integration, so the outcome is the
    // same the minute it finishes and three labs later: one rule, no now().
    check: (ctx) => {
      if (!hasHotfix(ctx, "main")) {
        return miss(
          "the US-045 fix is not on main, so production still refuses a back-dated cancellation",
          `${HOTFIX_RULE} on branch main. Lab 3.7 part 2 releases preprod into main`
        );
      }
      return hasHotfix(ctx, DEV)
        ? pass("The hotfix is in production, and the retrofit put it back into integration")
        : miss(
          "the hotfix is in production but not in integration, so the next story there deploys the old formula over it",
          `${HOTFIX_RULE} on branch ${DEV}. Lab 3.7 part 3 is the retrofit`
        );
    }
  },
  {
    id: "3.8", level: 3, lab: 8,
    title: "Production is under monitoring, and the project says where",
    check: (ctx) => {
      const project = ctx.readOn(DEV, "config/.sfdx-hardis.yml") || "";
      const url = project.match(/monitoring_?[Rr]epository:\s*["']?(https?:\/\/\S*monitoring[^\s"']*)/);
      return url
        ? pass(`Monitoring repository recorded: ${url[1]}`)
        : miss(
          "the project does not say where its monitoring repository is",
          `monitoringRepository in config/.sfdx-hardis.yml on branch ${DEV}. Lab 3.8 step 8 sets it in Pipeline Settings`
        );
    }
  },
  {
    id: "3.9", level: 3, lab: 9, auditable: false,
    title: "The project documentation is generated, and a person wrote in it",
    // Generated on demand and never committed: only the learner's machine has it
    check: (ctx) => {
      const page = path.join(ctx.dir, "docs", "objects", "Installation__c.md");
      if (!fs.existsSync(page)) {
        return miss("no generated documentation was found", "docs/objects/Installation__c.md in your project. Lab 3.9 step 2, Generate Documentation");
      }
      return /DO_NOT_OVERWRITE_DOC=TRUE/.test(fs.readFileSync(page, "utf8"))
        ? pass("The documentation is generated, and the Installation page keeps what you wrote")
        : miss(
          "the Installation page can still be overwritten, and the paragraph you wrote with it",
          "docs/objects/Installation__c.md, its second line. Lab 3.9 step 5 sets DO_NOT_OVERWRITE_DOC to TRUE"
        );
    }
  },
  {
    id: "3.10", level: 3, lab: 10,
    title: "Capstone: a full release cycle",
    check: (ctx) => {
      // The week's release carried Romain's US-055 to production. The Lab 3.7 hotfix is on
      // main since that lab, so finding it here says the week's promotions kept it.
      const installDate = ctx.readOn("main", FIELD("Installation__c", "Install_Date__c")) || "";
      if (!/<inlineHelpText>/.test(installDate)) {
        return miss(
          "Romain's US-055 never reached production, so the week's release did not happen",
          `${FIELD("Installation__c", "Install_Date__c")} on branch main`
        );
      }
      return hasHotfix(ctx, "main")
        ? pass("The week's release reached production, and main still carries the Lab 3.7 hotfix")
        : miss(
          "main lost the Lab 3.7 hotfix somewhere in the week's promotions, so the incident is back",
          `${HOTFIX_RULE} on branch main`
        );
    }
  }
];

export function rulesForLevel(level) {
  return RULES.filter((r) => r.level === level);
}

export function findRule(level, lab) {
  return RULES.find((r) => r.level === level && r.lab === lab);
}
