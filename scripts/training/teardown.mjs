/**
 * Training > Clean up a training org.
 *
 * Removes what the seed put in: the Helios metadata, and the standard records
 * it created. This is an approximation of a fresh org, not a reset: it cannot
 * undo a feature you switched on or a licence you assigned.
 */
import fs from "fs";
import os from "os";
import path from "path";
import {
  ROOT, c, title, info, ok, warn, abort, run, select, confirm,
  connectedOrgs, orgChoices, universe
} from "../lib/util.mjs";

// Everything the course puts in an org, across all three levels. A name that is
// not in the org is not an error: a destructive deploy ignores it. A name that
// is missing from here is, because whatever it is holds Installation__c and the
// object can then never be deleted. The Level 2 classes and objects were the
// ones missing, and they are why this command used to fail on any org that had
// got past Level 1.
const REMOVE = [
  ["CustomApplication", ["Helios_Delivery"]],
  ["CustomTab", ["Installation__c", "Panel_Batch__c", "Crew_Capacity__c", "Handover_Item__c"]],
  ["FlexiPage", ["Installation_Record_Page"]],
  ["Flow", ["Installation_Assign_Crew", "Installation_Close_Check", "Installation_Crew_Warning"]],
  ["LightningComponentBundle", ["installationTimeline"]],
  [
    "ApexClass",
    [
      "InstallationSchedulerTest",
      "InstallationScheduler",
      "CrewCapacityBatchTest",
      "CrewCapacityBatch",
      "CrewSizeBackfillBatchTest",
      "CrewSizeBackfillBatch"
    ]
  ],
  ["PermissionSet", ["Helios_Delivery_Crew", "Helios_Delivery_Manager"]],
  ["Profile", ["Helios Crew"]],
  ["RemoteSiteSetting", ["Helios_Warehouse"]],
  ["CustomObject", ["Panel_Batch__c", "Handover_Item__c", "Crew_Capacity__c", "Installation__c"]]
];

// The seeded accounts are found by name, read from the seed file itself.
// Description would be the obvious marker, and SOQL cannot filter on a long
// text area.
function deleteStandardApex() {
  const csv = fs.readFileSync(path.join(ROOT, "scripts", "data", "HeliosBaseline", "Account.csv"), "utf8");
  const names = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",")[0].trim())
    .filter(Boolean)
    .map((name) => `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`);
  return `
Set<String> names = new Set<String>{ ${names.join(", ")} };
List<Account> accounts = [SELECT Id FROM Account WHERE Name IN :names];
List<Opportunity> opportunities = [SELECT Id FROM Opportunity WHERE AccountId IN :accounts];
delete opportunities;
List<Contact> contacts = [SELECT Id FROM Contact WHERE Email LIKE '%@helios-training.demo'];
delete contacts;
delete accounts;
System.debug('Removed ' + opportunities.size() + ' opportunities, ' + contacts.size() + ' contacts, ' + accounts.size() + ' accounts');
`;
}

/**
 * A destructive deploy cannot unassign a permission set, deactivate a Flow or
 * deactivate a Lightning page, and the Helios app needs all three let go of
 * before any of it can be deleted. Without this step the deploy below always
 * fails on an org that was actually used, which is every org this command is
 * ever pointed at:
 *
 *   PermissionSet Helios_Delivery_Manager   assigned to one or more users
 *   Flow Installation_*                     insufficient access rights (active)
 *   FlexiPage Installation_Record_Page      you can't delete an active Lightning page
 *   CustomObject Installation__c            used by another feature: Flow Version
 *   LightningComponentBundle installationTimeline  referenced by the Lightning page
 *
 * The last two go on their own once the first three are dealt with. Every call
 * here is allowed to fail: an org that never had the thing is not a problem.
 */
function releaseHolds(target) {
  // The permission sets, unassigned from whoever holds them
  const apexFile = path.join(os.tmpdir(), `helios-unassign-${Date.now()}.apex`);
  fs.writeFileSync(
    apexFile,
    `List<PermissionSetAssignment> psa = [
  SELECT Id FROM PermissionSetAssignment
  WHERE PermissionSet.Name IN ('Helios_Delivery_Crew','Helios_Delivery_Manager')
];
delete psa;
System.debug('Unassigned ' + psa.size() + ' permission set assignment(s)');
`,
    "utf8"
  );
  const unassigned = run("sf", ["apex", "run", "--file", apexFile, "--target-org", target], { quiet: true });
  fs.rmSync(apexFile, { force: true });
  info(unassigned.code === 0 ? "  Permission sets unassigned" : c.dim("  No permission set assignment to remove"));

  // The scheduled jobs. Lab 2.4 schedules CrewCapacityBatch nightly, and a
  // scheduled job holds its class, which holds both custom objects. Salesforce
  // reports it as "This apex class is referenced elsewhere in Salesforce ... :
  // Scheduled Jobs", which names no job you can find without looking.
  const jobsFile = path.join(os.tmpdir(), `helios-unschedule-${Date.now()}.apex`);
  fs.writeFileSync(
    jobsFile,
    `List<CronTrigger> jobs = [
  SELECT Id FROM CronTrigger
  WHERE CronJobDetail.Name LIKE 'Helios%' OR CronJobDetail.Name LIKE '%Crew%'
];
for (CronTrigger job : jobs) { System.abortJob(job.Id); }
System.debug('Aborted ' + jobs.size() + ' scheduled job(s)');
`,
    "utf8"
  );
  const unscheduled = run("sf", ["apex", "run", "--file", jobsFile, "--target-org", target], { quiet: true });
  fs.rmSync(jobsFile, { force: true });
  info(unscheduled.code === 0 ? "  Scheduled jobs aborted" : c.dim("  No scheduled job to abort"));

  // The flows, deactivated. An active flow refuses to be deleted, and says so
  // with "insufficient access rights on cross-reference id", which reads like a
  // permission problem and is not one.
  let deactivated = 0;
  for (const flow of ["Installation_Assign_Crew", "Installation_Close_Check", "Installation_Crew_Warning"]) {
    const found = run(
      "sf",
      ["data", "query", "--use-tooling-api", "-q", `SELECT Id FROM FlowDefinition WHERE DeveloperName = '${flow}'`,
        "--target-org", target, "--json"],
      { capture: true, quiet: true }
    );
    let id = null;
    try {
      id = JSON.parse(found.stdout).result.records[0].Id;
    } catch {
      continue;
    }
    const off = run(
      "sf",
      ["api", "request", "rest", `services/data/v64.0/tooling/sobjects/FlowDefinition/${id}`,
        "--method", "PATCH", "--body", '{"Metadata":{"activeVersionNumber":null}}', "--target-org", target],
      { quiet: true }
    );
    if (off.code === 0) {
      deactivated++;
    }
  }
  info(deactivated > 0 ? `  ${deactivated} flow(s) deactivated` : c.dim("  No active flow to deactivate"));

  // The record page, put back to the standard one. A Lightning page assigned as
  // an object's record page is "active", and an active page cannot be deleted.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-deactivate-"));
  fs.mkdirSync(path.join(dir, "objects"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types><members>Installation__c</members><name>CustomObject</name></types>
    <version>64.0</version>
</Package>
`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, "objects", "Installation__c.object"),
    // A CustomObject deploy is refused without these, even when the only thing
    // being changed is the action override: "Must specify a non-empty label".
    `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOverrides>
        <actionName>View</actionName>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <formFactor>Large</formFactor>
        <type>Default</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <formFactor>Small</formFactor>
        <type>Default</type>
    </actionOverrides>
    <deploymentStatus>Deployed</deploymentStatus>
    <label>Installation</label>
    <nameField>
        <displayFormat>INST-{00000}</displayFormat>
        <label>Installation Number</label>
        <type>AutoNumber</type>
    </nameField>
    <pluralLabel>Installations</pluralLabel>
    <sharingModel>ReadWrite</sharingModel>
</CustomObject>
`,
    "utf8"
  );
  const page = run(
    "sf",
    ["project", "deploy", "start", "--metadata-dir", dir, "--target-org", target,
      "--test-level", "NoTestRun", "--ignore-warnings", "--wait", "30"],
    { quiet: true }
  );
  fs.rmSync(dir, { recursive: true, force: true });
  info(page.code === 0 ? "  The Installation record page is back to the standard one" : c.dim("  No Lightning record page to deactivate"));
}

export default async function teardown(args) {
  title("Clean up a training org");

  const orgs = connectedOrgs().filter((o) => o.connected);
  if (orgs.length === 0) {
    abort("No connected org was found.", "Connect the org in the Orgs Manager panel first.");
  }
  // An org answers to several names, and this command deletes an app and every
  // record it created: only the orgs of the course are ever offered, matched on
  // any of their aliases. Falling back to "every connected org" would put the
  // learner's employer sandbox one click away, and a list of one is not even
  // asked about.
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
  const target = await select("Which org do you want to clean up?", orgChoices(suggested), args.org, "org");

  info("");
  warn(`This deletes the Helios Delivery app and every record it created in ${c.bold(target)}.`);
  info(c.dim("    Anything you built yourself on those objects goes with them."));
  const sure = args.yes === true || (await confirm(`Delete the Helios app and data from ${target}?`, false));
  if (!sure) {
    info("Nothing was deleted.");
    return;
  }

  title("1 of 3  Deleting the accounts, contacts and opportunities");
  const apexFile = path.join(os.tmpdir(), `helios-teardown-${Date.now()}.apex`);
  fs.writeFileSync(apexFile, deleteStandardApex(), "utf8");
  const apex = run("sf", ["apex", "run", "--file", apexFile, "--target-org", target]);
  fs.rmSync(apexFile, { force: true });
  if (apex.code !== 0) {
    warn("The records could not all be deleted. The metadata removal below still runs.");
  } else {
    ok("Standard records are gone");
  }

  title("2 of 3  Letting go of what holds the metadata");
  releaseHolds(target);

  title("3 of 3  Removing the Helios metadata");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-destroy-"));
  fs.writeFileSync(path.join(dir, "package.xml"), emptyPackage(), "utf8");
  fs.writeFileSync(path.join(dir, "destructiveChangesPost.xml"), destructivePackage(), "utf8");
  // Twice, because one destructive deploy is one pass: the Lightning page cannot
  // go while the app that carries it is still there, and the object cannot go
  // while the page does. The first pass takes the app, the tabs and the classes,
  // the second takes what they were holding. A second pass on an org that is
  // already empty deletes nothing and succeeds, so it costs a minute at worst.
  let deploy = { code: 1 };
  for (let pass = 1; pass <= 2; pass++) {
    deploy = run("sf", [
      "project", "deploy", "start",
      "--metadata-dir", dir,
      "--target-org", target,
      "--test-level", "NoTestRun",
      "--ignore-warnings",
      "--wait", "60"
    ]);
    if (deploy.code === 0) {
      break;
    }
    if (pass === 1) {
      info(c.dim("  Some of it was still held. Second pass, now that what held it is gone..."));
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  if (deploy.code !== 0) {
    abort(
      `The metadata could not be removed from ${target}.`,
      "Salesforce refuses to delete metadata that something else still references. Read the errors above, remove that reference by hand in Setup, and run this again."
    );
  }
  ok("The Helios Delivery app is gone");

  title("Done");
  info(`  ${target} is close to how it was before you started.`);
  info(c.dim("  Feature switches and licence assignments are not undone: a teardown is not a fresh org."));
}

function emptyPackage() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <version>64.0</version>
</Package>
`;
}

function destructivePackage() {
  const types = REMOVE.map(([name, members]) => {
    const lines = members.map((m) => `        <members>${m}</members>`).join("\n");
    return `    <types>\n${lines}\n        <name>${name}</name>\n    </types>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
${types}
    <version>64.0</version>
</Package>
`;
}
