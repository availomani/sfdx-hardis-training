#!/usr/bin/env node
/**
 * Proves, in a throwaway git repository, everything Lab 3.10 claims about its
 * five teammate stories, before anybody walks it against real orgs:
 *
 *   - the five scenarios of scripts/simulate/ apply in the merge order the lab
 *     gives, and US-059 refuses to be built before US-058 is merged (basedOn);
 *   - cherry-picking the three selected stories onto preprod conflicts on
 *     US-059 alone, on exactly the Panel Batch layout and the manager permission
 *     set, and the other two apply cleanly;
 *   - the resolution the lab prints (keep Supplier, leave Warranty Years out)
 *     gives well-formed XML with no duplicate entry;
 *   - after the merge, preprod holds the three promoted stories and not the two
 *     held back, with no conflict marker left;
 *   - merging uat whole into preprod straight away conflicts again on the same
 *     two files, which is why step 9 retrofits preprod into integration first;
 *   - after that retrofit, integration to uat and uat to preprod both merge
 *     cleanly, and preprod ends up with all five stories;
 *   - the audit rule of Lab 3.10 fails before the promotion, with markers left,
 *     and before the retrofit, and passes after the retrofit and after the
 *     capstone merge; the rule of Lab 3.11 passes once main carries the week.
 *
 *   node scripts/verify/prove-promotion-conflict.mjs [--keep]
 *
 * --keep leaves the repository behind and prints its path, to look at it.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { loadScenarios, planPatches, writePlanned, applyFiles, scenarioIsApplied } from "../training/simulate.mjs";
import { makeContext, findRule } from "./rules.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const KEEP = process.argv.includes("--keep");

// The lab's merge order into integration, oldest first, which is what makes the
// uat window read, top to bottom: US-061 selected, US-060 not, US-059 selected,
// US-057 selected, US-058 not.
const MERGE_ORDER = ["us-058-warranty-term", "us-057-awaiting-parts", "us-059-supplier", "us-060-scaffolding", "us-061-gate-code"];
const SELECTED = ["us-057-awaiting-parts", "us-059-supplier", "us-061-gate-code"];
const CONFLICTING = "us-059-supplier";
const LAYOUT = "force-app/main/default/layouts/Panel_Batch__c-Panel Batch Layout.layout-meta.xml";
const PERMSET = "force-app/main/default/permissionsets/Helios_Delivery_Manager.permissionset-meta.xml";
const CONFLICT_FILES = [LAYOUT, PERMSET].sort();
const PROMOTION_BRANCH = "promotion/uat/preprod/2026-09-24-0930";
const FIRST_PR = 61;

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};
const assert = (cond, msg) => (cond ? ok(msg) : bad(msg));
const step = (msg) => console.log(`\n${msg}`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-promotion-proof-"));
const git = (args, options = {}) => {
  const res = spawnSync("git", args, { cwd: dir, encoding: "utf8", shell: false, ...options });
  return { status: res.status, out: (res.stdout || "").trim(), err: (res.stderr || "").trim() };
};
const gitOk = (args) => {
  const res = git(args);
  if (res.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${res.err || res.out}`);
  }
  return res.out;
};
const read = (file) => fs.readFileSync(path.join(dir, file), "utf8");
const readOn = (ref, file) => git(["show", `${ref}:${file}`]).out;
const hasMarkers = (text) => /^(<<<<<<< |=======$|>>>>>>> )/m.test(text);

// ---------------------------------------------------------------- 1. base
step("1. A repository holding the Helios app on preprod, integration and uat");
for (const item of ["force-app", "config", "manifest", "sfdx-project.json"]) {
  fs.cpSync(path.join(ROOT, item), path.join(dir, item), { recursive: true });
}
// What the walked forks had before Lab 3.10: the status an admin added in production,
// retrofitted down and promoted back up, so every branch shares it
const statusFile = "force-app/main/default/objects/Installation__c/fields/Status__c.field-meta.xml";
fs.writeFileSync(
  path.join(dir, statusFile),
  read(statusFile).replace(
    "        </valueSetDefinition>",
    "            <value>\n                <fullName>Needs Reinspection</fullName>\n                <default>false</default>\n                <label>Needs Reinspection</label>\n            </value>\n        </valueSetDefinition>"
  )
);
// ...and the Lab 3.7 hotfix, live in production and retrofitted since
const ruleFile = "force-app/main/default/objects/Installation__c/validationRules/Installation_Date_Not_Past.validationRule-meta.xml";
fs.writeFileSync(
  path.join(dir, ruleFile),
  read(ruleFile).replace(
    "  NOT(ISPICKVAL(Status__c, &quot;Completed&quot;))\n",
    "  NOT(ISPICKVAL(Status__c, &quot;Completed&quot;)),\n  NOT(ISPICKVAL(Status__c, &quot;Cancelled&quot;))\n"
  )
);
gitOk(["init", "-q", "-b", "preprod"]);
gitOk(["config", "user.email", "release.manager@heliostraining.invalid"]);
gitOk(["config", "user.name", "You"]);
gitOk(["config", "core.autocrlf", "false"]);
gitOk(["add", "-A"]);
gitOk(["commit", "-q", "-m", "Release 2026-09-18 (Lab 3.7 hotfix included)"]);
gitOk(["branch", "integration"]);
gitOk(["branch", "uat"]);
gitOk(["branch", "main"]);
// integration is one config change ahead of preprod, as after Lab 3.8
gitOk(["checkout", "-q", "integration"]);
fs.appendFileSync(path.join(dir, "config/.sfdx-hardis.yml"), "\nmonitoringRepository: https://github.com/you/sfdx-hardis-training-monitoring\n");
gitOk(["commit", "-q", "-am", "Lab 3.8: monitoring repository"]);
gitOk(["checkout", "-q", "uat"]);
gitOk(["merge", "-q", "--no-ff", "integration", "-m", "Merge pull request #60 from you/integration\n\nPromotion integration to uat"]);
ok(`built in ${dir}`);

// -------------------------------------------------- 2. the five stories
step("2. The five teammate Pull Requests, squash merged into integration in the lab's order");
const scenarios = loadScenarios();
const byId = (id) => {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) {
    throw new Error(`No scenario ${id} in scripts/simulate/`);
  }
  return scenario;
};
const squashCommits = new Map();
for (const [index, id] of MERGE_ORDER.entries()) {
  const scenario = byId(id);
  const number = FIRST_PR + index;
  gitOk(["checkout", "-q", "integration"]);
  if (scenario.basedOn) {
    // What the learner sees when they take the stories out of order
    gitOk(["checkout", "-q", "preprod"]);
    assert(!scenarioIsApplied(byId(scenario.basedOn), dir), `${scenario.id}: basedOn ${scenario.basedOn} is reported missing on a branch without it`);
    gitOk(["checkout", "-q", "integration"]);
    assert(scenarioIsApplied(byId(scenario.basedOn), dir), `${scenario.id}: basedOn ${scenario.basedOn} is reported present once merged into integration`);
  }
  gitOk(["checkout", "-q", "-b", scenario.branch]);
  const planned = planPatches(scenario, dir);
  applyFiles(scenario, dir);
  writePlanned(planned, dir);
  gitOk(["add", "-A"]);
  gitOk(["-c", `user.name=${scenario.author.name}`, "-c", `user.email=${scenario.author.email}`, "commit", "-q", "-m", scenario.commitMessage]);
  gitOk(["checkout", "-q", "integration"]);
  gitOk(["merge", "-q", "--squash", scenario.branch]);
  gitOk(["-c", `user.name=${scenario.author.name}`, "-c", `user.email=${scenario.author.email}`, "commit", "-q", "-m", `${scenario.prTitle} (#${number})`]);
  squashCommits.set(id, { hash: gitOk(["rev-parse", "HEAD"]), number, scenario });
  assert(scenarioIsApplied(scenario, dir), `#${number} ${scenario.prTitle} merged into integration`);
}
gitOk(["checkout", "-q", "uat"]);
gitOk(["merge", "-q", "--no-ff", "integration", "-m", "Merge pull request #66 from you/integration\n\nPromotion integration to uat"]);
const window = gitOk(["log", "--first-parent", "--format=%s", "integration", "-5"]).split("\n");
assert(
  window.join("|") === [...MERGE_ORDER].reverse().map((id) => `${squashCommits.get(id).scenario.prTitle} (#${squashCommits.get(id).number})`).join("|"),
  `the uat window lists, newest first: ${window.map((s) => s.split(" ")[0]).join(", ")}`
);
const uatTreeAfterStories = gitOk(["rev-parse", "uat^{tree}"]);

// ------------------------------------------------ 3. the promotion branch
step("3. The promotion branch: three cherry-picks, one conflict");
const auditStates = [];
const snapshot = (label, prepare) => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "helios-promotion-audit-"));
  fs.cpSync(dir, copy, { recursive: true });
  if (prepare) {
    prepare(copy);
  }
  auditStates.push({ label, dir: copy });
};
snapshot("before the promotion", null);

gitOk(["checkout", "-q", "preprod"]);
gitOk(["checkout", "-q", "-b", PROMOTION_BRANCH]);
let conflictMarkers = {};
for (const id of SELECTED) {
  const { hash, number, scenario } = squashCommits.get(id);
  const res = git(["cherry-pick", "-x", hash]);
  if (id !== CONFLICTING) {
    assert(res.status === 0, `#${number} ${scenario.prTitle}: cherry-pick applies cleanly`);
    continue;
  }
  assert(res.status !== 0, `#${number} ${scenario.prTitle}: cherry-pick conflicts`);
  const conflicted = gitOk(["diff", "--name-only", "--diff-filter=U"]).split("\n").sort();
  assert(conflicted.join("|") === CONFLICT_FILES.join("|"), `conflicts on exactly: ${conflicted.join(", ")}`);
  // What the recommended answer does: commit the story with its markers
  gitOk(["add", "-A"]);
  gitOk(["-c", "core.editor=true", "cherry-pick", "--continue"]);
  for (const file of CONFLICT_FILES) {
    conflictMarkers[file] = read(file);
    assert(hasMarkers(conflictMarkers[file]), `${path.basename(file)} committed with its conflict markers`);
  }
}
const promotionTip = gitOk(["rev-parse", "HEAD"]);
snapshot("promotion merged with its markers left", (copy) => {
  spawnSync("git", ["update-ref", "refs/heads/preprod", promotionTip], { cwd: copy, shell: false });
});

console.log("\n  --- conflict blocks, as the learner sees them ---");
for (const file of CONFLICT_FILES) {
  const lines = conflictMarkers[file].split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("<<<<<<< "));
  const end = lines.findIndex((l) => l.startsWith(">>>>>>> "));
  console.log(`  ${file}`);
  lines.slice(Math.max(0, start - 4), end + 5).forEach((l) => console.log(`    ${l}`));
}

// ---------------------------------------------------- 4. the resolution
step("4. The resolution the lab prints: keep Supplier, leave Warranty Years out");
const WARRANTY_LAYOUT_ITEM = /[ \t]*<layoutItems>\r?\n[ \t]*<behavior>Edit<\/behavior>\r?\n[ \t]*<field>Warranty_Years__c<\/field>\r?\n[ \t]*<\/layoutItems>\r?\n/;
const WARRANTY_PERMISSION = /[ \t]*<fieldPermissions>\r?\n[ \t]*<editable>true<\/editable>\r?\n[ \t]*<field>Panel_Batch__c\.Warranty_Years__c<\/field>\r?\n[ \t]*<readable>true<\/readable>\r?\n[ \t]*<\/fieldPermissions>\r?\n/;
function resolve(text, warrantyBlock) {
  // Accept Incoming Change on every block (the HEAD side is empty here), then
  // delete the Warranty Years block the incoming side brought along
  const accepted = text.replace(/<<<<<<< [^\n]*\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\n]*\r?\n/g, (_m, ours, theirs) => {
    if (ours.trim() !== "") {
      throw new Error("the HEAD side of the conflict is not empty: the lab's resolution assumes it is");
    }
    return theirs;
  });
  return accepted.replace(warrantyBlock, "");
}
const resolvedLayout = resolve(read(LAYOUT), WARRANTY_LAYOUT_ITEM);
const resolvedPermset = resolve(read(PERMSET), WARRANTY_PERMISSION);
fs.writeFileSync(path.join(dir, LAYOUT), resolvedLayout);
fs.writeFileSync(path.join(dir, PERMSET), resolvedPermset);

function wellFormed(label, text, opens) {
  assert(!hasMarkers(text), `${label}: no conflict marker left`);
  for (const tag of opens) {
    const open = (text.match(new RegExp(`<${tag}>`, "g")) || []).length;
    const close = (text.match(new RegExp(`</${tag}>`, "g")) || []).length;
    assert(open === close && open > 0, `${label}: ${open} <${tag}> and ${close} </${tag}>`);
  }
  assert(/^<\?xml version="1.0" encoding="UTF-8"\?>/.test(text), `${label}: XML declaration kept`);
  const fields = [...text.matchAll(/<field>([^<]+)<\/field>/g)].map((m) => m[1]);
  assert(new Set(fields).size === fields.length, `${label}: no duplicate <field> entry (${fields.length} entries)`);
}
wellFormed("layout", resolvedLayout, ["layoutItems", "layoutColumns", "layoutSections"]);
wellFormed("permission set", resolvedPermset, ["fieldPermissions", "objectPermissions"]);
assert(!/Warranty_Years__c/.test(resolvedLayout) && !/Warranty_Years__c/.test(resolvedPermset), "Warranty Years is in neither file");
assert(
  /<field>Cost__c<\/field>\r?\n[ \t]*<\/layoutItems>\r?\n[ \t]*<layoutItems>\r?\n[ \t]*<behavior>Edit<\/behavior>\r?\n[ \t]*<field>Supplier__c<\/field>/.test(resolvedLayout),
  "layout: Supplier sits right after Cost, where Warranty Years would have been"
);
assert(
  /Panel_Batch__c\.Serial_Prefix__c<\/field>\r?\n[ \t]*<readable>true<\/readable>\r?\n[ \t]*<\/fieldPermissions>\r?\n[ \t]*<fieldPermissions>\r?\n[ \t]*<editable>true<\/editable>\r?\n[ \t]*<field>Panel_Batch__c\.Supplier__c<\/field>/.test(resolvedPermset),
  "permission set: Supplier is granted right after Serial Prefix"
);
assert(git(["diff", "--check"]).status === 0, "git diff --check is clean");
gitOk(["add", "-A"]);
gitOk(["commit", "-q", "-m", [
  `fix: solve cherry-pick conflicts of ${PROMOTION_BRANCH}`,
  "",
  `${LAYOUT} (#${squashCommits.get(CONFLICTING).number}): preprod has no Warranty Years item; the story added Supplier under it; kept Supplier after Cost, left Warranty Years out (US-058 is not promoted)`,
  `${PERMSET} (#${squashCommits.get(CONFLICTING).number}): preprod has no Warranty Years grant; the story added the Supplier grant next to it; kept Supplier, left Warranty Years out`
].join("\n")]);

// ------------------------------------------------- 5. merged into preprod
step("5. The promotion merged into preprod: three stories there, two not, no marker");
gitOk(["checkout", "-q", "preprod"]);
gitOk(["merge", "-q", "--no-ff", PROMOTION_BRANCH, "-m", `Merge pull request #67 from you/${PROMOTION_BRANCH}\n\nPromotion uat to preprod (2026-09-24-0930)`]);
const preprodHolds = (id) => scenarioIsApplied(byId(id), dir);
for (const id of SELECTED) {
  assert(preprodHolds(id), `preprod carries ${squashCommits.get(id).scenario.prTitle.split(" ")[0]}`);
}
for (const id of MERGE_ORDER.filter((s) => !SELECTED.includes(s))) {
  assert(!preprodHolds(id), `preprod does not carry ${squashCommits.get(id).scenario.prTitle.split(" ")[0]}`);
}
assert(!fs.existsSync(path.join(dir, "force-app/main/default/objects/Panel_Batch__c/fields/Warranty_Years__c.field-meta.xml")), "preprod has no Warranty_Years__c field file");
assert(git(["grep", "-l", "-e", "^<<<<<<< ", "-e", "^>>>>>>> ", "preprod", "--", "force-app"]).out === "", "no conflict marker in the metadata of preprod");
snapshot("promotion merged, not retrofitted", null);

// ----------------------------------------- 6. why the retrofit is needed
step("6. Merging uat whole into preprod straight away conflicts again on the same files");
gitOk(["checkout", "-q", "-b", "proof/capstone-without-retrofit", "preprod"]);
const early = git(["merge", "--no-ff", "--no-commit", "uat"]);
const earlyConflicts = gitOk(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean).sort();
assert(early.status !== 0 && earlyConflicts.join("|") === CONFLICT_FILES.join("|"), `without the retrofit, uat into preprod conflicts on: ${earlyConflicts.join(", ")}`);
git(["merge", "--abort"]);
gitOk(["checkout", "-q", "preprod"]);
gitOk(["branch", "-q", "-D", "proof/capstone-without-retrofit"]);

// ------------------------------------------------------- 7. the retrofit
step("7. The retrofit of step 9: preprod into integration, the integration side wins");
const integrationTreeBefore = gitOk(["rev-parse", "integration^{tree}"]);
gitOk(["checkout", "-q", "-b", "retrofit/US-059-promotion", "integration"]);
const retro = git(["merge", "--no-ff", "preprod"]);
const retroConflicts = gitOk(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean).sort();
assert(retro.status !== 0 && retroConflicts.join("|") === CONFLICT_FILES.join("|"), `the retrofit merge conflicts on: ${retroConflicts.join(", ")}`);
for (const file of CONFLICT_FILES) {
  const text = read(file);
  const block = text.match(/<<<<<<< [^\n]*\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> [^\n]*\r?\n/);
  assert(block && block[2].trim() === "" && /Warranty_Years__c/.test(block[1]), `${path.basename(file)}: the conflict is Warranty Years on the integration side against nothing on the preprod side`);
}
gitOk(["checkout", "--ours", "--", ...CONFLICT_FILES]);
gitOk(["add", "-A"]);
gitOk(["-c", "core.editor=true", "commit", "-q", "--no-edit"]);
gitOk(["checkout", "-q", "integration"]);
gitOk(["merge", "-q", "--no-ff", "retrofit/US-059-promotion", "-m", "Merge pull request #68 from you/retrofit/US-059-promotion\n\nRetrofit: the promotion of US-057, US-059 and US-061 back down into integration"]);
assert(gitOk(["rev-parse", "integration^{tree}"]) === integrationTreeBefore, "the retrofit changes no file of integration: it only records that preprod was merged");
assert(git(["merge-base", "--is-ancestor", "preprod", "integration"]).status === 0, "preprod is now an ancestor of integration");
snapshot("promotion merged and retrofitted", null);

// ------------------------------------------------------- 8. the capstone
step("8. The capstone: US-055 into integration, integration to uat, uat to preprod, preprod to main, all clean");
gitOk(["checkout", "-q", "-b", "training/mate-us-055-install-date-help", "integration"]);
const us055 = byId("us-055-install-date-help");
applyFiles(us055, dir);
writePlanned(planPatches(us055, dir), dir);
gitOk(["add", "-A"]);
gitOk(["-c", `user.name=${us055.author.name}`, "-c", `user.email=${us055.author.email}`, "commit", "-q", "-m", us055.commitMessage]);
gitOk(["checkout", "-q", "integration"]);
gitOk(["merge", "-q", "--squash", "training/mate-us-055-install-date-help"]);
gitOk(["commit", "-q", "-m", `${us055.prTitle} (#69)`]);
gitOk(["checkout", "-q", "uat"]);
const wed = git(["merge", "--no-ff", "integration", "-m", "Merge pull request #70 from you/integration\n\nPromotion integration to uat"]);
assert(wed.status === 0, "Wednesday: integration into uat merges cleanly");
gitOk(["checkout", "-q", "preprod"]);
const thu = git(["merge", "--no-ff", "uat", "-m", "Merge pull request #71 from you/uat\n\nPromotion uat to preprod"]);
assert(thu.status === 0, "Thursday: uat into preprod merges cleanly, the exception ends");
for (const id of MERGE_ORDER) {
  assert(preprodHolds(id), `preprod now carries ${squashCommits.get(id).scenario.prTitle.split(" ")[0]}`);
}
assert(git(["grep", "-l", "-e", "^<<<<<<< ", "-e", "^>>>>>>> ", "preprod", "--", "force-app"]).out === "", "no conflict marker in the metadata of preprod after the capstone");
for (const file of CONFLICT_FILES) {
  assert(readOn("preprod", file) === readOn("integration", file), `${path.basename(file)}: preprod and integration agree`);
  const fields = [...readOn("preprod", file).matchAll(/<field>([^<]+)<\/field>/g)].map((m) => m[1]);
  assert(new Set(fields).size === fields.length, `${path.basename(file)}: no duplicate entry after the capstone`);
}
gitOk(["checkout", "-q", "main"]);
const release = git(["merge", "--no-ff", "preprod", "-m", "Merge pull request #72 from you/preprod\n\nRelease 2026-10-01"]);
assert(release.status === 0, "Thursday: preprod into main merges cleanly");
gitOk(["checkout", "-q", "integration"]);
snapshot("after the capstone", null);

// --------------------------------------------------- 9. the audit rules
step("9. The audit rule of Lab 3.10 in every state, and Lab 3.11 after the capstone");
const rule310 = findRule(3, 10);
const expectations = {
  "before the promotion": false,
  "promotion merged with its markers left": false,
  "promotion merged, not retrofitted": false,
  "promotion merged and retrofitted": true,
  "after the capstone": true
};
for (const state of auditStates) {
  const result = rule310.check(makeContext(state.dir));
  const expected = expectations[state.label];
  assert(result.ok === expected, `3.10 ${expected ? "passes" : "fails"} ${state.label}: ${result.detail}`);
  if (!result.ok) {
    console.log(`        where: ${result.where}`);
  }
}
const last = auditStates[auditStates.length - 1];
const result311 = findRule(3, 11).check(makeContext(last.dir));
assert(result311.ok, `3.11 passes after the capstone: ${result311.detail}`);
const beforeCapstone = auditStates.find((s) => s.label === "promotion merged and retrofitted");
const early311 = findRule(3, 11).check(makeContext(beforeCapstone.dir));
assert(!early311.ok && /US-058 and US-060/.test(early311.detail) === false, `3.11 fails before the capstone on US-055 first: ${early311.detail}`);

// --------------------------------------------------------------- summary
console.log("");
for (const state of auditStates) {
  if (!KEEP) {
    fs.rmSync(state.dir, { recursive: true, force: true });
  }
}
if (KEEP) {
  console.log(`Repository kept at ${dir}`);
  auditStates.forEach((s) => console.log(`  ${s.label}: ${s.dir}`));
} else {
  fs.rmSync(dir, { recursive: true, force: true });
}
if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("Every claim of Lab 3.10 holds on the synthetic repository.");
