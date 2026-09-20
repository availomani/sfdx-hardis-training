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

const REMOVE = [
  ["CustomApplication", ["Helios_Delivery"]],
  ["CustomTab", ["Installation__c", "Panel_Batch__c"]],
  ["FlexiPage", ["Installation_Record_Page"]],
  ["Flow", ["Installation_Assign_Crew", "Installation_Close_Check", "Installation_Crew_Warning"]],
  ["LightningComponentBundle", ["installationTimeline"]],
  ["ApexClass", ["InstallationSchedulerTest", "InstallationScheduler"]],
  ["PermissionSet", ["Helios_Delivery_Crew", "Helios_Delivery_Manager"]],
  ["Profile", ["Helios Crew"]],
  ["RemoteSiteSetting", ["Helios_Warehouse"]],
  ["CustomObject", ["Panel_Batch__c", "Installation__c"]]
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
  const target = await select("Which org do you want to clean up?", orgChoices(suggested), args.org);

  info("");
  warn(`This deletes the Helios Delivery app and every record it created in ${c.bold(target)}.`);
  info(c.dim("    Anything you built yourself on those objects goes with them."));
  const sure = args.yes === true || (await confirm(`Delete the Helios app and data from ${target}?`, false));
  if (!sure) {
    info("Nothing was deleted.");
    return;
  }

  title("1 of 2  Deleting the accounts, contacts and opportunities");
  const apexFile = path.join(os.tmpdir(), `helios-teardown-${Date.now()}.apex`);
  fs.writeFileSync(apexFile, deleteStandardApex(), "utf8");
  const apex = run("sf", ["apex", "run", "--file", apexFile, "--target-org", target]);
  fs.rmSync(apexFile, { force: true });
  if (apex.code !== 0) {
    warn("The records could not all be deleted. The metadata removal below still runs.");
  } else {
    ok("Standard records are gone");
  }

  title("2 of 2  Removing the Helios metadata");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-destroy-"));
  fs.writeFileSync(path.join(dir, "package.xml"), emptyPackage(), "utf8");
  fs.writeFileSync(path.join(dir, "destructiveChangesPost.xml"), destructivePackage(), "utf8");
  const deploy = run("sf", [
    "project", "deploy", "start",
    "--metadata-dir", dir,
    "--target-org", target,
    "--test-level", "NoTestRun",
    "--ignore-warnings",
    "--wait", "60"
  ]);
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
