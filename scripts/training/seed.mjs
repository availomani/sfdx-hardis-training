/**
 * Training > Set up one of my training orgs.
 *
 * Deploys the Helios Energy app into an org you already connected in Orgs Manager,
 * grants yourself the manager permission set, then loads the sample data.
 *
 * Level 1 never clicks it: Set up my training environment seeds the three scratch
 * orgs itself, with the functions exported below. It is the button for the two
 * Developer Edition orgs Level 3 adds to the pipeline, and for putting an org back
 * after a lab went wrong.
 *
 * Design rules, from the spec:
 *   - Idempotent. Running it twice on the same org changes nothing.
 *   - Ordered for a cold org. Everything deploys in one pass.
 *   - Loud about failures. It stops at the first one and says what to do.
 *   - It never authenticates. Orgs Manager owns that.
 */
import fs from "fs";
import os from "os";
import path from "path";
import {
  ROOT, c, title, info, ok, warn, abort, run, runAsync, runJson,
  select, connectedOrgs, orgChoices, universe, readProgress, writeProgress
} from "../lib/util.mjs";

const MANAGER_PERMSET = "Helios_Delivery_Manager";

/** The command that puts the Helios app into an org, shared by both routes in. */
function deployArgs(target) {
  return [
    "project", "deploy", "start",
    "--source-dir", "force-app",
    "--target-org", target,
    "--test-level", "NoTestRun",
    "--wait", "60",
    // The course is the reference here. A scratch org that already holds the app, from an
    // earlier setup or another clone of the fork, would otherwise refuse every component
    // as a source tracking conflict: this clone has never seen the org
    "--ignore-conflicts"
  ];
}

/**
 * Deploys the app into several orgs at once, and returns the ones that failed
 * with what the deployment said. Three deployments in a row would triple the
 * longest wait of the setup, and they do not depend on each other.
 */
export async function deployAppToAll(targets) {
  const results = await Promise.all(
    targets.map(async (target) => ({ target, res: await runAsync("sf", deployArgs(target)) }))
  );
  return results.filter(({ res }) => res.code !== 0).map(({ target, res }) => ({
    target,
    output: (res.stdout + "\n" + res.stderr).trim()
  }));
}

/**
 * This has to happen before the data load. A metadata deployment grants no
 * field level security to anybody, so without it even a System Administrator
 * cannot write Installation__c.External_Id__c and the data load fails with a
 * message that has nothing to do with the real cause.
 */
export function grantManager(target, options = {}) {
  // Always captured: the answer has to be read, because an assignment that already
  // exists fails with "Duplicate PermissionSetAssignment", which is the state we want
  const res = run(
    "sf",
    ["org", "assign", "permset", "--name", MANAGER_PERMSET, "--target-org", target],
    { quiet: options.quiet === true, capture: true }
  );
  return res.code === 0 || /duplicate/i.test(res.stdout + res.stderr);
}

/**
 * The data load is an upsert on an external id, so it repeats safely. It runs
 * one org at a time: SFDMU writes its logs and working files inside the
 * workspace folder, and two loads sharing that folder overwrite each other.
 */
export function loadData(target, options = {}) {
  const workspace = baselineWorkspace();
  const res = run(
    "sf",
    ["hardis:org:data:import", "--agent", "--path", workspace, "--target-org", target],
    options.quiet ? { quiet: true, capture: true } : {}
  );
  if (workspace !== BASELINE) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  return { ok: res.code === 0, output: (res.stdout + "\n" + res.stderr).trim() };
}

const BASELINE = path.join("scripts", "data", "HeliosBaseline");

/**
 * The seed data as this project can load it.
 *
 * The baseline leaves Crew Size empty on most installations, on purpose: Lab 2.3 is about the day it
 * becomes mandatory. From then on the project deploys it as required, and loading an installation
 * without one fails. An org seeded after that point, helios-preprod or helios-prod in Level 3, gets
 * the default Lab 2.3's backfill gives them, 2, through a copy of the workspace. The committed files
 * never change.
 */
function baselineWorkspace() {
  const field = path.join(ROOT, "force-app", "main", "default", "objects", "Installation__c", "fields", "Crew_Size__c.field-meta.xml");
  const required = fs.existsSync(field) && /<required>true<\/required>/.test(fs.readFileSync(field, "utf8"));
  if (!required) {
    return BASELINE;
  }
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "helios-baseline-"));
  for (const file of fs.readdirSync(path.join(ROOT, BASELINE))) {
    const from = path.join(ROOT, BASELINE, file);
    if (fs.statSync(from).isFile()) {
      fs.copyFileSync(from, path.join(copy, file));
    }
  }
  const csv = path.join(copy, "Installation__c.csv");
  const [header, ...rows] = fs.readFileSync(csv, "utf8").split(/\r?\n/);
  const column = header.split(",").indexOf("Crew_Size__c");
  const filled = rows.map((row) => {
    if (!row || column < 0) {
      return row;
    }
    const cells = row.split(",");
    if (cells[column] === "") {
      cells[column] = "2";
    }
    return cells.join(",");
  });
  fs.writeFileSync(csv, [header, ...filled].join("\n"), "utf8");
  return copy;
}

/** Remembers which org was seeded, under which username, so a second run can skip it. */
export function recordSeeded(alias, username) {
  const progress = readProgress();
  progress.orgs = progress.orgs || {};
  progress.orgs[alias] = { seededAt: new Date().toISOString(), username: username || null };
  writeProgress(progress);
}

/** True when this exact org, not just an org with this alias, was seeded before. */
export function alreadySeeded(alias, username) {
  const entry = (readProgress().orgs || {})[alias];
  return Boolean(entry && entry.username && entry.username === username);
}

export default async function seed(args) {
  title("Set up one of my training orgs");

  const orgs = connectedOrgs().filter((o) => o.connected);
  if (orgs.length === 0) {
    abort(
      "No connected org was found.",
      "Open the Orgs Manager panel in VS Code and connect your training org first. See Lab 1.2."
    );
  }

  // Only an org of this course, matched on any of its aliases. Falling back to
  // "every connected org" put a learner's employer sandbox one click from a
  // deployment of the whole Helios app, and a list of one is not even asked
  // about: it would have been selected silently. Same rule as teardown.
  const known = universe().orgs.map((o) => o.alias);
  const suggested = orgs.filter(
    (o) => known.includes(o.alias) || (o.aliases || []).some((a) => known.includes(a))
  );
  if (suggested.length === 0) {
    abort(
      "None of the training orgs is connected.",
      `Connect one of them in the Orgs Manager panel first: ${known.join(", ")}`
    );
  }

  const target = await select("Which org do you want to set up?", orgChoices(suggested), args.org, "org");
  const username = (orgs.find((o) => o.alias === target || o.username === target) || {}).username;

  info("");
  info(`This will put the ${c.bold("Helios Delivery")} app and its sample data into ${c.bold(target)}.`);
  info(c.dim("Nothing is deleted. Running this twice is harmless."));

  // ------------------------------------------------------- 1. metadata
  title("1 of 4  Deploying the Helios Delivery app");
  info(c.dim("    On a brand new org this takes a few minutes."));
  if (run("sf", deployArgs(target)).code !== 0) {
    abort(
      `The deployment to ${target} failed.`,
      "Read the errors above. The most common cause is a connection that expired: reconnect the org in Orgs Manager and run this again."
    );
  }
  ok("The app is deployed");

  // ---------------------------------------- 2. permission set, before the data
  title("2 of 4  Granting yourself the Helios Delivery Manager permission set");
  if (grantManager(target)) {
    ok(`${MANAGER_PERMSET} is assigned to you`);
  } else {
    warn("The permission set could not be assigned. Continuing.");
  }

  // ------------------------------------------------------------ 3. data
  title("3 of 4  Loading the Helios sample data");
  if (!loadData(target).ok) {
    abort(
      `The data load into ${target} failed.`,
      "The deployment worked, so the app is there and only the records are missing. Run Set up one of my training orgs again: the load is an upsert and repeats safely."
    );
  }
  ok("Accounts, contacts, opportunities, installations and panel batches are loaded");

  // ----------------------------------------------------------- 4. drift
  title("4 of 4  Applying what makes this org different from the others");
  const applied = applyDrift(target);
  if (applied.length === 0) {
    info(c.dim("    Nothing to apply for this org."));
  } else {
    applied.forEach((line) => ok(line));
  }

  recordSeeded(target, username);

  title("Your org is ready");
  const counts = countRecords(target);
  if (counts) {
    info(`  ${counts.installations} installations, ${counts.batches} panel batches, ${counts.accounts} accounts.`);
  }
  info("");
  info(`  Open it from the ${c.bold("Orgs Manager")} panel, then pick the ${c.bold("Helios Delivery")} app`);
  info("  in the App Launcher and look at the Installations tab.");
}

/**
 * Per-org differences the labs rely on, from scripts/drift/<alias>.json.
 * This is how helios-prod ends up one step behind the repository, which is what
 * Lab 3.7 needs in order to have something to retrofit.
 */
export function applyDrift(alias) {
  const file = path.join(ROOT, "scripts", "drift", `${alias}.json`);
  if (!fs.existsSync(file)) {
    return [];
  }
  const drift = JSON.parse(fs.readFileSync(file, "utf8"));
  const done = [];
  for (const step of drift.steps || []) {
    if (step.type === "apex") {
      const tmp = path.join(ROOT, ".training-drift.apex");
      fs.writeFileSync(tmp, step.code, "utf8");
      const res = run("sf", ["apex", "run", "--file", tmp, "--target-org", alias], { quiet: true, capture: true });
      fs.rmSync(tmp, { force: true });
      if (res.code === 0) {
        done.push(step.label);
      } else {
        warn(`${step.label} could not be applied. The lab that needs it will say so.`);
      }
    } else if (step.type === "picklist-value") {
      if (addPicklistValue(alias, step)) {
        done.push(step.label);
      } else {
        warn(`${step.label} could not be applied. The lab that needs it will say so.`);
      }
    } else if (step.type === "data") {
      const res = run("sf", [
        "hardis:org:data:import", "--agent",
        "--path", path.join("scripts", "data", step.workspace),
        "--target-org", alias
      ], { quiet: true, capture: true });
      if (res.code === 0) {
        done.push(step.label);
      } else {
        warn(`${step.label} could not be applied.`);
      }
    }
  }
  return done;
}

/**
 * Adds one value to a picklist of the org, the way an admin in Setup would end up with it.
 *
 * The Apex Metadata API cannot change a custom field, so this goes through the Metadata API
 * from a throwaway project: retrieve the field as the org has it, add the value, deploy that
 * one file back. Nothing in the learner's project is touched.
 */
export function addPicklistValue(alias, step) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-drift-"));
  try {
    fs.writeFileSync(
      path.join(dir, "sfdx-project.json"),
      JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }], sourceApiVersion: "64.0" }),
      "utf8"
    );
    fs.mkdirSync(path.join(dir, "force-app"), { recursive: true });
    const member = `CustomField:${step.object}.${step.field}`;
    if (run("sf", ["project", "retrieve", "start", "--metadata", member, "--target-org", alias], { cwd: dir, quiet: true, capture: true }).code !== 0) {
      return false;
    }
    const file = path.join(dir, "force-app", "main", "default", "objects", step.object, "fields", `${step.field}.field-meta.xml`);
    if (!fs.existsSync(file)) {
      return false;
    }
    const xml = fs.readFileSync(file, "utf8");
    const start = xml.indexOf(`<fullName>${step.value}</fullName>`);
    if (start >= 0) {
      // Present but inactive: a release that deployed the field without the value
      // deactivated it, which is not "the admin added it". Reactivate it.
      const end = xml.indexOf("</value>", start);
      const block = xml.slice(start, end);
      if (!block.includes("<isActive>false</isActive>")) {
        return true;
      }
      const reactivated = block.replace(/\s*<isActive>false<\/isActive>/, "");
      fs.writeFileSync(file, xml.slice(0, start) + reactivated + xml.slice(end), "utf8");
    } else {
      const value =
        `            <value>
                <fullName>${step.value}</fullName>
                <default>false</default>
` +
        `                <label>${step.value}</label>
            </value>
`;
      const at = xml.lastIndexOf("        </valueSetDefinition>");
      if (at < 0) {
        return false;
      }
      fs.writeFileSync(file, xml.slice(0, at) + value + xml.slice(at), "utf8");
    }
    return run("sf", ["project", "deploy", "start", "--source-dir", "force-app", "--target-org", alias, "--ignore-conflicts"], { cwd: dir, quiet: true, capture: true }).code === 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function countRecords(alias) {
  const q = (soql) => {
    const res = runJson("sf", ["data", "query", "--query", soql, "--target-org", alias, "--json"]);
    return res && res.result ? res.result.totalSize : null;
  };
  const installations = q("SELECT Id FROM Installation__c");
  if (installations === null) {
    return null;
  }
  return {
    installations,
    batches: q("SELECT Id FROM Panel_Batch__c"),
    accounts: q("SELECT Id FROM Account")
  };
}
