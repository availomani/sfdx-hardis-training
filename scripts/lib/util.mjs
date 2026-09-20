/**
 * Shared helpers for every training script.
 *
 * Zero dependencies on purpose: a learner clones this repository and runs the
 * Training menu straight away, with no npm install and no node_modules.
 */
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import * as panel from "./panel.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// ------------------------------------------------------------------ colors
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (useColor ? `[${code}m${s}[0m` : s);
export const c = {
  bold: wrap("1"),
  dim: wrap("2"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36")
};

export function title(text) {
  console.log("");
  console.log(c.cyan(c.bold(text)));
  console.log(c.cyan("-".repeat(text.length)));
  panel.log(text, "action");
}

export function info(text) {
  console.log(text);
  panel.log(text, "log");
}
export function ok(text) {
  console.log(`${c.green("OK")}  ${text}`);
  panel.log(text, "success");
}
export function warn(text) {
  console.log(`${c.yellow("!")}   ${text}`);
  panel.log(text, "warning");
}
export function fail(text) {
  console.log(`${c.red("X")}   ${text}`);
  panel.log(text, "error");
}

/** Stops with a readable message rather than a stack trace. */
export function abort(message, hint) {
  console.log("");
  fail(message);
  if (hint) {
    console.log(`    ${c.dim(hint)}`);
    panel.log(hint, "log");
  }
  panel.close("error");
  process.exit(1);
}

// ------------------------------------------------------------------ universe
let universeCache = null;
export function universe() {
  if (!universeCache) {
    universeCache = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));
  }
  return universeCache;
}

// ------------------------------------------------------------------ commands
/**
 * Runs a command and streams its output, the way a learner expects to see it.
 * Returns the exit code instead of throwing, so callers decide what a failure means.
 */
const WINDOWS = process.platform === "win32";

/** Quotes one argument for the platform shell, so a path with a space survives. */
function quoteArg(arg) {
  const value = String(arg);
  if (value.length > 0 && !/[\s"'&|<>^()%!]/.test(value)) {
    return value;
  }
  return WINDOWS ? `"${value.replace(/"/g, '""')}"` : `'${value.replace(/'/g, "'\\''")}'`;
}

export function run(command, args, options = {}) {
  const pretty = `${command} ${args.join(" ")}`;
  if (!options.quiet) {
    console.log(c.dim(`    $ ${pretty}`));
  }
  // On Windows the Salesforce CLI and the GitHub CLI are .cmd shims, which only
  // run through a shell. Node deprecates passing an argument array together with
  // shell:true, so the line is quoted here and handed over as a single string.
  const spawnCommand = WINDOWS ? [command, ...args.map(quoteArg)].join(" ") : command;
  const spawnArgs = WINDOWS ? [] : args;
  const res = spawnSync(spawnCommand, spawnArgs, {
    cwd: options.cwd || ROOT,
    stdio: options.capture ? "pipe" : "inherit",
    shell: WINDOWS,
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) }
  });
  return {
    code: res.status === null ? 1 : res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || ""
  };
}

/**
 * The same as run(), without blocking, and always captured.
 *
 * For the few steps that are slow and independent, like creating three scratch
 * orgs: running them one after the other would triple a wait that is already
 * the longest part of the setup. Output is captured rather than streamed,
 * because three commands writing to one terminal at once is unreadable.
 */
export function runAsync(command, args, options = {}) {
  const spawnCommand = WINDOWS ? [command, ...args.map(quoteArg)].join(" ") : command;
  const spawnArgs = WINDOWS ? [] : args;
  return new Promise((resolve) => {
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: options.cwd || ROOT,
      shell: WINDOWS,
      env: { ...process.env, ...(options.env || {}) }
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: stderr + error.message }));
    child.on("close", (code) => resolve({ code: code === null ? 1 : code, stdout, stderr }));
  });
}

/** Parses the JSON a command printed, ignoring any warning written before it. */
export function parseJsonOutput(text) {
  const start = (text || "").indexOf("{");
  if (start < 0) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

/** Runs a command, captures stdout, and parses it as JSON. Returns null on any problem. */
export function runJson(command, args, options = {}) {
  const res = run(command, args, { ...options, capture: true, quiet: true });
  return parseJsonOutput(res.stdout.trim());
}

export function git(args, options = {}) {
  return run("git", args, { ...options });
}

export function gitOut(args) {
  return run("git", args, { capture: true, quiet: true }).stdout.trim();
}

// ------------------------------------------------------------------ prompts
/** The learner dismissed the question in the panel: stop where the CLI stops. */
function cancelled(message) {
  info(`${message} (cancelled)`);
  panel.close("cancelled");
  process.exit(1);
}

function isInteractive() {
  if (process.env.TRAINING_NO_PROMPT === "true") {
    return false;
  }
  // The panel asks the question in VS Code, so no terminal is needed
  return panel.isActive() || (process.stdin.isTTY && !process.env.CI);
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim();
}

/**
 * Numbered list selection. Plain readline, so it works in the VS Code terminal,
 * in Git Bash, in PowerShell and over SSH without a prompt library.
 */
export async function select(message, choices, preselected) {
  const knownValues = () => [...new Set(choices.flatMap((ch) => [ch.value, ...(ch.aliases || [])]))];
  if (preselected) {
    // An org answers to several names: its aliases and its username. Match any of
    // them, or a value passed on the command line is refused for no good reason.
    const found =
      choices.find((ch) => ch.value === preselected) ||
      choices.find((ch) => (ch.aliases || []).includes(preselected));
    if (found) {
      info(`${message} ${c.green(found.label)}`);
      return found.value;
    }
    abort(`"${preselected}" is not one of: ${knownValues().join(", ")}`);
  }
  if (choices.length === 1) {
    info(`${message} ${c.green(choices[0].label)} ${c.dim("(the only one available)")}`);
    return choices[0].value;
  }
  if (!isInteractive()) {
    // Naming the answers this very question accepts, rather than an example
    // from another command that does not apply here
    abort(
      `${message} needs an answer, and this terminal cannot ask for one.`,
      `Pass one of these on the command line instead: ${knownValues().join(", ")}`
    );
  }
  if (panel.isActive()) {
    const picked = await panel.ask({
      type: "select",
      name: "value",
      message,
      choices: choices.map((ch) => ({
        title: ch.label,
        value: ch.value,
        description: ch.hint || undefined
      }))
    });
    if (picked === panel.CANCELLED) {
      cancelled(message);
    }
    if (picked !== undefined) {
      const chosen = choices.find((ch) => ch.value === picked);
      info(`${message} ${chosen ? chosen.label : picked}`);
      return picked;
    }
  }
  console.log("");
  console.log(c.bold(message));
  choices.forEach((ch, i) => {
    console.log(`  ${c.cyan(String(i + 1))}. ${ch.label}${ch.hint ? c.dim(`  ${ch.hint}`) : ""}`);
  });
  for (;;) {
    const answer = await ask(c.bold("\n  Your choice (number): "));
    const index = Number.parseInt(answer, 10);
    if (Number.isInteger(index) && index >= 1 && index <= choices.length) {
      return choices[index - 1].value;
    }
    warn(`Type a number between 1 and ${choices.length}.`);
  }
}

/** A free text answer. Enter accepts the value in brackets. */
export async function input(message, initial = "") {
  if (!isInteractive()) {
    if (initial) {
      info(`${message} ${c.green(initial)}`);
      return initial;
    }
    abort(`${message} needs an answer, and this terminal cannot ask for one.`);
  }
  if (panel.isActive()) {
    const typed = await panel.ask({ type: "text", name: "value", message, initial: initial || undefined });
    if (typed === panel.CANCELLED) {
      cancelled(message);
    }
    if (typed !== undefined && String(typed).trim() !== "") {
      info(`${message} ${String(typed).trim()}`);
      return String(typed).trim();
    }
    if (typed !== undefined && initial) {
      return initial;
    }
  }
  for (;;) {
    const answer = await ask(c.bold(message) + (initial ? c.dim(` [${initial}] `) : " "));
    if (answer) {
      return answer;
    }
    if (initial) {
      return initial;
    }
    warn("Type an answer, it cannot be empty.");
  }
}

export async function confirm(message, defaultYes = false) {
  if (!isInteractive()) {
    return defaultYes;
  }
  if (panel.isActive()) {
    const answered = await panel.ask({ type: "confirm", name: "value", message, initial: defaultYes });
    if (answered === panel.CANCELLED) {
      cancelled(message);
    }
    if (answered !== undefined) {
      info(`${message} ${answered ? "yes" : "no"}`);
      return answered === true || answered === "true";
    }
  }
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await ask(c.bold(message + suffix))).toLowerCase();
  if (!answer) {
    return defaultYes;
  }
  return answer === "y" || answer === "yes";
}

// ------------------------------------------------------------------ orgs
/**
 * Every alias the Salesforce CLI knows, grouped by username.
 *
 * One org can carry several aliases, and `sf org list` only ever reports one of
 * them. That bites as soon as anything aliases an org a second time: the CI
 * authentication of Level 1 aliases your integration org as "integration", and
 * from then on "helios-integration" is invisible to `sf org list`.
 */
function aliasesByUsername() {
  const data = runJson("sf", ["alias", "list", "--json"]);
  const map = new Map();
  for (const entry of (data && data.result) || []) {
    const username = entry.value;
    const alias = entry.alias;
    if (!username || !alias) {
      continue;
    }
    if (!map.has(username)) {
      map.set(username, []);
    }
    map.get(username).push(alias);
  }
  return map;
}

/** Every org the Salesforce CLI knows about, with every alias each one carries. */
export function connectedOrgs() {
  const data = runJson("sf", ["org", "list", "--json"]);
  if (!data || !data.result) {
    return [];
  }
  const aliasMap = aliasesByUsername();
  const buckets = ["nonScratchOrgs", "devHubs", "sandboxes", "scratchOrgs", "other"];
  const seen = new Set();
  const orgs = [];
  for (const bucket of buckets) {
    for (const org of data.result[bucket] || []) {
      if (!org.username || seen.has(org.username)) {
        continue;
      }
      seen.add(org.username);
      const known = aliasMap.get(org.username) || [];
      const reported = [org.alias, ...(Array.isArray(org.aliases) ? org.aliases : [])].filter(Boolean);
      const aliases = [...new Set([...known, ...reported])];
      const isScratch = bucket === "scratchOrgs" || org.isScratch === true;
      // A scratch org reports a lifecycle status rather than a connection
      // status, and an expired one still sits in the list until it is cleaned
      const expired = isScratch && (org.isExpired === true || (org.status && org.status !== "Active"));
      orgs.push({
        alias: aliases[0] || "",
        aliases,
        username: org.username,
        instanceUrl: org.instanceUrl,
        isScratch,
        isDevHub: org.isDevHub === true,
        devHubUsername: org.devHubUsername || null,
        expirationDate: org.expirationDate || null,
        connected: !expired && (org.connectedStatus === "Connected" || (isScratch && org.status === "Active"))
      });
    }
  }
  return orgs;
}

export function orgChoices(orgs) {
  return orgs.map((org) => ({
    value: org.alias || org.username,
    // Every name this org answers to, so picking it by any of them works
    aliases: [...(org.aliases || []), org.username].filter(Boolean),
    label: org.alias ? `${org.alias}  ${c.dim(org.username)}` : org.username,
    hint: org.connected ? "" : "(not connected)"
  }));
}

// ------------------------------------------------------------------ progress
const PROGRESS_FILE = ".training-progress.json";

export function readProgress() {
  const p = path.join(ROOT, PROGRESS_FILE);
  if (!fs.existsSync(p)) {
    return { receipts: [], orgs: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { receipts: [], orgs: {} };
  }
}

export function writeProgress(progress) {
  fs.writeFileSync(path.join(ROOT, PROGRESS_FILE), JSON.stringify(progress, null, 2) + "\n", "utf8");
}

export function recordReceipt(receipt) {
  const progress = readProgress();
  progress.receipts = (progress.receipts || []).filter((r) => r.id !== receipt.id);
  progress.receipts.push(receipt);
  progress.receipts.sort((a, b) => a.id.localeCompare(b.id));
  writeProgress(progress);
}

// ------------------------------------------------------------------ args
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(token);
    }
  }
  return out;
}

/** The learner GitHub handle, read from the origin remote of their fork. */
export function githubHandle() {
  const url = gitOut(["remote", "get-url", "origin"]);
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  return match ? match[1] : null;
}

export function repoSlug() {
  const url = gitOut(["remote", "get-url", "origin"]);
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function hasGh() {
  return run("gh", ["--version"], { capture: true, quiet: true }).code === 0;
}

/**
 * gh, installed and signed in. Both are worth telling apart: the fixes differ.
 *
 * Signing in happens here rather than in a message telling somebody to type a
 * command: this course never sends anybody to a terminal.
 */
export function ensureGh() {
  if (!hasGh()) {
    abort(
      "The GitHub CLI (gh) is not installed.",
      [
        "Install it from https://cli.github.com/, then click this command again.",
        "Lab 1.2 shows which download to take."
      ].join("\n  ")
    );
  }
  if (run("gh", ["auth", "status"], { capture: true, quiet: true }).code === 0) {
    return;
  }

  info("");
  info("You are not signed in to GitHub yet, so let us do that first.");
  info(c.dim("    A browser window opens. Answer GitHub.com, HTTPS, and sign in there."));
  info("");
  const login = run("gh", ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"]);
  if (login.code !== 0 || run("gh", ["auth", "status"], { capture: true, quiet: true }).code !== 0) {
    abort(
      "The GitHub sign-in did not finish.",
      "Click the command again and complete the sign-in in the browser it opens."
    );
  }
  ok("Signed in to GitHub.");
}

/** Opens a page in the default browser, and always prints it in case it does not. */
export function openUrl(url) {
  const opener = WINDOWS
    ? { command: "cmd", args: ["/c", "start", "", url] }
    : process.platform === "darwin"
      ? { command: "open", args: [url] }
      : { command: "xdg-open", args: [url] };
  const res = run(opener.command, opener.args, { capture: true, quiet: true });
  return res.code === 0;
}
