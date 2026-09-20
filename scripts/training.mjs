#!/usr/bin/env node
/**
 * The single entry point behind the Training menu of the VS Code extension.
 *
 *   node scripts/training.mjs init        Set up my training environment
 *   node scripts/training.mjs status      Where am I?
 *   node scripts/training.mjs seed        Set up one of my training orgs
 *   node scripts/training.mjs check       Check my work
 *   node scripts/training.mjs claim       Claim my badge
 *   node scripts/training.mjs simulate    Simulate my teammates
 *   node scripts/training.mjs publish     Publish my pipeline configuration (Level 3)
 *   node scripts/training.mjs reset       Reset this level
 *   node scripts/training.mjs teardown    Clean up a training org
 *
 * Every verb prompts for what it needs, so nothing has to be typed. Flags exist
 * for automation and for the labs that show what happened under the hood.
 */
import { parseArgs, abort, c } from "./lib/util.mjs";
import * as panel from "./lib/panel.mjs";

const VERBS = {
  init: () => import("./training/init.mjs"),
  status: () => import("./training/status.mjs"),
  seed: () => import("./training/seed.mjs"),
  check: () => import("./training/check.mjs"),
  claim: () => import("./training/claim.mjs"),
  simulate: () => import("./training/simulate.mjs"),
  publish: () => import("./training/publish.mjs"),
  reset: () => import("./training/reset.mjs"),
  teardown: () => import("./training/teardown.mjs")
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const verb = args._[0];

  if (!verb || args.help) {
    console.log(`
${c.bold("Salesforce DevOps with sfdx-hardis - training commands")}

  ${c.cyan("init")}       Set up my training environment: forks the repository, creates the scratch orgs, wires the pipeline
  ${c.cyan("status")}     Where am I? The level and lab you reached, and what to do next
  ${c.cyan("seed")}       Set up one of my training orgs: deploys the Helios app and its data
  ${c.cyan("check")}      Check my work: verifies a lab and prints your receipt
  ${c.cyan("claim")}      Claim my badge: checks the whole level, then opens the claim form filled in
  ${c.cyan("simulate")}   Simulate my teammates: creates the branches and Pull Requests a lab needs
  ${c.cyan("publish")}    Publish my pipeline configuration: the release manager's configuration, through a Pull Request into integration
  ${c.cyan("reset")}      Reset this level: puts your repository back to a known state
  ${c.cyan("teardown")}   Clean up a training org: removes the Helios app and its data

Usually you click these on the VS Code Welcome page, under ${c.bold("Training: Level 1")}, ${c.bold("Level 2")} or ${c.bold("Level 3")}.
`);
    process.exit(verb ? 0 : 1);
  }

  const loader = VERBS[verb];
  if (!loader) {
    abort(`"${verb}" is not a training command.`, `Try one of: ${Object.keys(VERBS).join(", ")}`);
  }

  // When the extension runs this in its Command Runner panel, the lesson talks
  // to it the way an sfdx-hardis command does. In a plain terminal this does
  // nothing at all.
  await panel.connect(verb);
  const module = await loader();
  await module.default(args);
  panel.refresh();
  // Several verbs report a failure by setting the exit code rather than
  // throwing: Check my work with a lab that does not pass, Claim my badge on an
  // audit that fails. The panel has to say the same thing the console says.
  panel.close(process.exitCode ? "error" : "success");
}

main().catch((error) => {
  panel.log(`Something went wrong: ${error.message}`, "error");
  panel.close("error");
  console.error("");
  console.error(c.red(`Something went wrong: ${error.message}`));
  if (process.env.TRAINING_DEBUG) {
    console.error(error.stack);
  } else {
    console.error(c.dim("Run again with TRAINING_DEBUG=1 to see the full stack trace."));
  }
  process.exit(1);
});
