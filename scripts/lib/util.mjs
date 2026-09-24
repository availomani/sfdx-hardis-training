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
    // The panel gets the line too: what the child prints goes to an output
    // channel nobody has open, so without this a deploy or a scratch org is
    // several silent minutes in a panel that looks stuck.
    panel.log(`$ ${pretty}`, "log");
  }
  // On Windows the Salesforce CLI and the GitHub CLI are .cmd shims, which only
  // run through a shell. Node deprecates passing an argument array together with
  // shell:true, so the line is quoted here and handed over as a single string.
  const spawnCommand = WINDOWS ? [quoteArg(command), ...args.map(quoteArg)].join(" ") : command;
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
  const spawnCommand = WINDOWS ? [quoteArg(command), ...args.map(quoteArg)].join(" ") : command;
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

/**
 * The same as run(), streaming what the child prints to the panel as well as to
 * the console, line by line.
 *
 * run() hands the child the console this process has. In a terminal that is
 * exactly right. In the Command Runner panel it goes to an output channel
 * nobody has open, so a command whose output the learner has to read, like the
 * one-time code of the GitHub sign-in, comes through here instead.
 *
 * stdin is /dev/null on purpose: there is no terminal behind the panel, and a
 * child that asks a question there would wait for ever instead of failing.
 */
export function runStreamed(command, args, options = {}) {
  if (!options.quiet) {
    console.log(c.dim(`    $ ${command} ${args.join(" ")}`));
  }
  const spawnCommand = WINDOWS ? [quoteArg(command), ...args.map(quoteArg)].join(" ") : command;
  const spawnArgs = WINDOWS ? [] : args;
  return new Promise((resolve) => {
    const child = spawn(spawnCommand, spawnArgs, {
      cwd: options.cwd || ROOT,
      shell: WINDOWS,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    let pending = "";
    const emit = (line) => {
      // eslint-disable-next-line no-control-regex
      const clean = line.replace(/\u001b\[[0-9;]*m/g, "").trimEnd();
      if (clean.trim() === "") {
        return;
      }
      panel.log(clean, "log");
      if (options.onLine) {
        options.onLine(clean);
      }
    };
    const consume = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      lines.forEach(emit);
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    child.on("error", (error) => resolve({ code: 1, output: output + error.message }));
    child.on("close", (code) => {
      emit(pending);
      pending = "";
      resolve({ code: code === null ? 1 : code, output });
    });
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

/**
 * The extension started this command in its Command Runner panel, not in a
 * terminal. There is a stdin, because that is what spawn() gives a child, but
 * nobody ever writes to it: a readline on it waits for ever, and the learner
 * watches a panel that has stopped for no visible reason. So when the command
 * comes from the panel, the panel is the only place a question can go.
 */
const FROM_PANEL = Boolean(process.env.SFDX_HARDIS_WEBSOCKET);

function isInteractive() {
  if (process.env.TRAINING_NO_PROMPT === "true") {
    return false;
  }
  if (FROM_PANEL) {
    return panel.isActive();
  }
  return process.stdin.isTTY && !process.env.CI;
}

/** Started from the panel, and the panel is not listening any more. */
function panelGone() {
  return FROM_PANEL && !panel.isActive() && process.env.TRAINING_NO_PROMPT !== "true";
}

/** Stops on a question nothing can display, rather than on a stdin nothing answers. */
function abortPanelGone(message) {
  abort(
    `This question has nowhere to go: ${String(message).replace(/\s+/g, " ").trim()}`,
    "The panel closed, or VS Code was reloaded while it was open. Click the command again in the Training menu."
  );
}

async function ask(question) {
  if (FROM_PANEL) {
    // Every caller asks the panel first, so this is only ever reached once the
    // panel is gone. Reading stdin here would hang the command for ever.
    abortPanelGone(question);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim();
}

/**
 * Numbered list selection. Plain readline, so it works in the VS Code terminal,
 * in Git Bash, in PowerShell and over SSH without a prompt library.
 */
export async function select(message, choices, preselected, flag) {
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
    if (panelGone()) {
      abortPanelGone(message);
    }
    // Naming the answers this very question accepts, rather than an example
    // from another command that does not apply here. And naming the flag: a list
    // of values nobody can pass is a loop, not an error message.
    const values = knownValues().join(", ");
    abort(
      `${message} needs an answer, and this terminal cannot ask for one.`,
      flag
        ? `Pass it on the command line instead:  --${flag} <value>
    Values: ${values}`
        : `Pass one of these on the command line instead: ${values}`
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
  if (FROM_PANEL) {
    // The panel was listening when the question was asked and is not any more
    abortPanelGone(message);
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
    if (panelGone()) {
      abortPanelGone(message);
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
  if (FROM_PANEL) {
    abortPanelGone(message);
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
    if (panelGone()) {
      // Never silently: the answer decides whether the command acts at all
      abortPanelGone(message);
    }
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
  if (FROM_PANEL) {
    abortPanelGone(message);
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

/** True when gh already holds a GitHub account. */
function ghSignedIn() {
  return run("gh", ["auth", "status"], { capture: true, quiet: true }).code === 0;
}

/** The page the device sign-in asks for, and the shape of the code it prints. */
const GH_DEVICE_URL = "https://github.com/login/device";
const GH_ONE_TIME_CODE = /\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/;

/**
 * The web sign-in of gh, run so that the panel can carry it.
 *
 * gh with a terminal prints the one-time code there and opens the browser
 * itself. Started from the panel it has no terminal: it still prints the code
 * and then waits for the browser, but the code lands in an output channel the
 * learner is not looking at, so the panel looks frozen on a question nobody can
 * see. The code is lifted out of its output and shown in the panel instead, and
 * the page is opened here.
 */
async function ghAuthLogin() {
  const args = ["auth", "login", "--hostname", "github.com", "--git-protocol", "https", "--web"];
  if (!panel.isActive()) {
    info(c.dim("    A browser window opens. Answer GitHub.com, HTTPS, and sign in there."));
    info("");
    return run("gh", args).code;
  }
  let shown = false;
  const res = await runStreamed("gh", args, {
    quiet: true,
    onLine: (line) => {
      const match = line.match(GH_ONE_TIME_CODE);
      if (!match || shown) {
        return;
      }
      shown = true;
      warn(`Your one-time code is ${c.bold(match[1])}`);
      info("  A browser opens on GitHub. Type that code there and approve the sign-in,");
      info("  then come back here: this command carries on by itself.");
      info(`  If the browser did not open: ${c.cyan(GH_DEVICE_URL)}`);
      openUrl(GH_DEVICE_URL);
    }
  });
  if (!shown) {
    warn("GitHub did not give a sign-in code.");
  }
  return res.code;
}

/**
 * gh, installed and signed in. Both are worth telling apart: the fixes differ.
 *
 * Signing in happens here rather than in a message telling somebody to type a
 * command: this course never sends anybody to a terminal.
 */
export async function ensureGh() {
  if (!hasGh()) {
    abort(
      "The GitHub CLI (gh) is not installed.",
      [
        "Install it from https://cli.github.com/, then click this command again.",
        "Lab 1.2 shows which download to take."
      ].join("\n  ")
    );
  }
  if (ghSignedIn()) {
    return;
  }

  info("");
  info("You are not signed in to GitHub yet, so let us do that first.");
  const code = await ghAuthLogin();
  if (code !== 0 || !ghSignedIn()) {
    abort(
      "The GitHub sign-in did not finish.",
      "Click the command again: a new code is given, and the sign-in starts over."
    );
  }
  // gh only offers to hand git its credentials when it has a terminal to ask in.
  // Without this, the first push of the course stops on a password nobody typed,
  // which is not something a Source Control panel can answer.
  run("gh", ["auth", "setup-git", "--hostname", "github.com"], { capture: true, quiet: true });
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

/** A date and minute for branch names: 2026-09-24-0930, local time. */
export function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Opens a Pull Request of the fork with gh, and returns its address, or null.
 *
 * Retried three times, two seconds apart: right after a push, GitHub has not
 * always registered the new branch, and the first gh pr create fails with "No
 * commits between" or "head ref not found". The body goes through a file, which
 * is removed whatever happens.
 */
export function openPullRequest({ slug, base, branch, title, body }) {
  if (!slug || !hasGh()) {
    return null;
  }
  const bodyFile = path.join(ROOT, ".training-pr-body.md");
  fs.writeFileSync(bodyFile, body, "utf8");
  let url = null;
  try {
    for (let attempt = 1; attempt <= 3 && !url; attempt++) {
      // Captured: the address of the Pull Request is what the learner opens
      // next, and what gh prints goes nowhere they can see in the panel
      const pr = run("gh", ["pr", "create", "--repo", slug, "--base", base, "--head", branch, "--title", title, "--body-file", bodyFile], {
        capture: true,
        quiet: true
      });
      if (pr.code === 0) {
        url = (pr.stdout || "").match(/https:\/\/\S+\/pull\/\d+/)?.[0] || `https://github.com/${slug}/pulls`;
      } else if (attempt < 3) {
        run(process.execPath, ["-e", "const t = Date.now(); while (Date.now() - t < 2000) {}"], { quiet: true });
      }
    }
  } finally {
    fs.rmSync(bodyFile, { force: true });
  }
  return url;
}
