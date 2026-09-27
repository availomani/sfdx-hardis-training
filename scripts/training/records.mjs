/**
 * Training > Create my lab records.
 *
 * Some labs need records in an org before the part they are about can start:
 * Lab 2.4 exports twelve Crew Capacity records into a data workspace, and typing
 * twelve records by hand teaches nothing the lab is about. This creates them, and
 * the lab asks the learner to look at them instead.
 *
 * Each entry of LAB_RECORDS names the lab, the object, its external id and a CSV
 * under scripts/lab-records/. The load is an upsert on the external id, so running
 * it twice leaves the same records, and it never deletes anything.
 */
import fs from "fs";
import os from "os";
import path from "path";
import {
  ROOT, c, title, info, ok, abort, run, runJson,
  select, confirm, connectedOrgs, orgChoices
} from "../lib/util.mjs";

const LAB_RECORDS = [
  {
    id: "lab-2-4",
    label: "Lab 2.4 - the 12 Crew Capacity records",
    object: "Crew_Capacity__c",
    objectLabel: "Crew Capacity",
    externalId: "External_Id__c",
    fields: ["External_Id__c", "Crew_Type__c", "Roof_Type__c", "Panels_Per_Day__c"],
    file: "scripts/lab-records/lab-2-4/Crew_Capacity__c.csv",
    org: "helios-dev",
    missingHint: "Create the Crew Capacity object and its four fields first: Lab 2.4, step 1."
  }
];

export default async function records(args) {
  title("Create my lab records");

  const id = await select(
    "Which lab are the records for?",
    LAB_RECORDS.map((r) => ({ value: r.id, label: r.label, hint: r.org })),
    args.lab,
    "lab"
  );
  const entry = LAB_RECORDS.find((r) => r.id === id);

  const orgs = connectedOrgs().filter((o) => o.connected);
  const suggested = orgs.filter((o) => o.alias === entry.org || (o.aliases || []).includes(entry.org));
  if (suggested.length === 0) {
    abort(`${entry.org} is not connected.`, `Connect it in the Orgs Manager panel, then run this again.`);
  }
  const target = await select("Which org should get them?", orgChoices(suggested), args.org, "org");

  // The object and its fields are what the learner built in the lab: a load
  // before that fails on every row, with an error that names none of it
  title(`1 of 3  Checking that ${entry.objectLabel} is in ${target}`);
  const describe = runJson("sf", ["sobject", "describe", "--sobject", entry.object, "--target-org", target, "--json"]);
  const present = new Set(((describe && describe.result && describe.result.fields) || []).map((f) => f.name));
  if (present.size === 0) {
    abort(`There is no ${entry.objectLabel} object in ${target} yet.`, entry.missingHint);
  }
  const missing = entry.fields.filter((f) => !present.has(f));
  if (missing.length > 0) {
    abort(`${entry.objectLabel} in ${target} has no ${missing.join(", ")} field yet.`, entry.missingHint);
  }
  ok(`${entry.objectLabel} and its fields are there`);

  info("");
  info(`  This creates the records of ${c.bold(entry.label.split(" - ")[0])} in ${c.bold(target)}, or updates them if they exist.`);
  const sure = args.yes === true || (await confirm("Create them?", true));
  if (!sure) {
    info("Nothing was created.");
    return;
  }

  title("2 of 3  Creating the records");
  const load = run(
    "sf",
    [
      "data", "upsert", "bulk",
      "--sobject", entry.object,
      "--file", path.join(ROOT, entry.file),
      "--external-id", entry.externalId,
      "--line-ending", "LF",
      "--wait", "10",
      "--target-org", target
    ],
    { capture: true }
  );
  if (load.code !== 0) {
    info(c.dim(`${load.stderr || load.stdout}`.trim().split(/\r?\n/).slice(-8).join("\n")));
    abort(
      `The records could not be created in ${target}.`,
      "The most common cause is a field you cannot edit: check that the four fields are visible to your profile, then run this again."
    );
  }
  ok("Records created");
  if (ensureAllListView(target, entry)) {
    ok(`The ${entry.objectLabel} list shows every record`);
  }

  title("3 of 3  What is in the org now");
  const query = `SELECT ${entry.fields.join(", ")} FROM ${entry.object} ORDER BY ${entry.externalId}`;
  const result = runJson("sf", ["data", "query", "--query", query, "--target-org", target, "--json"]);
  const rows = (result && result.result && result.result.records) || [];
  rows.forEach((row) => info(`    ${entry.fields.map((f) => String(row[f] ?? "")).join("  ")}`));
  ok(`${rows.length} ${entry.objectLabel} record(s) in ${target}`);

  // Built from the instance URL rather than with `sf org open --url-only`, whose
  // address carries a session token that must not end up in a log. The object has
  // no tab, and its list view still opens at this address.
  const display = runJson("sf", ["org", "display", "--target-org", target, "--json"]);
  const instanceUrl = display && display.result && display.result.instanceUrl;
  if (instanceUrl) {
    info("");
    info(`  See them in the org: ${c.cyan(`${instanceUrl}/lightning/o/${entry.object}/list?filterName=All`)}`);
  }
}

/**
 * Makes sure the object has an "All" list view, which the link at the end opens.
 *
 * An object created in Setup gets one, but an object that arrived by deployment,
 * as in the orgs the course seeds, has none, and the link then opens a page that
 * says the resource does not exist. Deployed only when missing, so a learner's
 * own list view is never touched. Returns false when it could not be checked or
 * made: the records are there all the same.
 */
export function ensureAllListView(target, entry) {
  const existing = runJson("sf", [
    "data", "query", "--target-org", target, "--json",
    "--query", `SELECT Id FROM ListView WHERE SobjectType = '${entry.object}' AND DeveloperName = 'All'`
  ]);
  if (existing && existing.result && existing.result.totalSize > 0) {
    return true;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-listview-"));
  try {
    fs.writeFileSync(
      path.join(dir, "sfdx-project.json"),
      JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }], sourceApiVersion: "64.0" }),
      "utf8"
    );
    const listViews = path.join(dir, "force-app", "main", "default", "objects", entry.object, "listViews");
    fs.mkdirSync(listViews, { recursive: true });
    const columns = ["NAME", ...entry.fields].map((f) => `    <columns>${f}</columns>`).join("\n");
    fs.writeFileSync(
      path.join(listViews, "All.listView-meta.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<ListView xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>All</fullName>
${columns}
    <filterScope>Everything</filterScope>
    <label>All</label>
</ListView>
`,
      "utf8"
    );
    return run("sf", ["project", "deploy", "start", "--source-dir", "force-app", "--target-org", target, "--ignore-conflicts"], { cwd: dir, quiet: true, capture: true }).code === 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
