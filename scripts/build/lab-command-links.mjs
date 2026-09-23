#!/usr/bin/env node
/**
 * Links every sfdx-hardis command an "Under the hood" block names to its
 * reference page on sfdx-hardis.cloudity.com.
 *
 * The blocks name the command the button ran, printed as an indented code
 * block. A reader who wants the flags, the prompts or the exact behaviour has
 * nowhere to go from there: the product documentation has a page per command,
 * and nothing in the course pointed at it.
 *
 * So each block ends with one generated line listing the commands it names,
 * each linked to its page. The line lives between markers, is rewritten in
 * place, and is the same in every locale except for its lead-in.
 *
 *   node scripts/build/lab-command-links.mjs [--check]
 *
 * --check writes nothing and exits non-zero when a file is out of date, which
 * is what CI needs.
 *
 * What it links, and what it leaves alone:
 *
 *   - "sf hardis:work:new" or "hardis:work:new" inside an Under the hood block
 *   - a wildcard such as "sf hardis:org:diagnose:*"   -> skipped, no page
 *   - a command named outside such a block            -> left alone
 *   - the order of the list                           -> first mention first
 *
 * When ../sfdx-hardis is checked out next to this repository, every command it
 * is about to link is verified against docs/hardis/, and an unknown one fails
 * the run rather than shipping a link to a 404. CI has no sibling clone, so
 * the check is a developer-time one and the generated text does not depend on
 * it.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS_ROOT = path.join(ROOT, "labs");
const SIBLING_DOCS = path.resolve(ROOT, "..", "sfdx-hardis", "docs", "hardis");
const CHECK = process.argv.includes("--check");

const DOC_BASE = "https://sfdx-hardis.cloudity.com";
const START = "<!-- command-links:start -->";
const END = "<!-- command-links:end -->";

/**
 * How each locale introduces the list.
 *
 * The command name itself is never translated: it is what the reader types and
 * what the product documentation is indexed under. Only the lead-in differs,
 * and a locale missing from here fails the run rather than shipping English
 * into a translated page.
 */
const LOCALES = {
  en: { one: "Command documentation:", many: "Command documentation:" },
  fr: {
    one: "Documentation de la commande :",
    many: "Documentation des commandes :"
  }
};

/** The heading of an Under the hood block, in every locale it has one. */
const UNDER_THE_HOOD = /<details[^>]*>\s*<summary>(?:(?!<\/summary>).)*?(?:Under the hood|Sous le capot)(?:(?!<\/summary>).)*?<\/summary>([\s\S]*?)<\/details>/g;

/** "sf hardis:work:new" and "hardis:work:new", with or without backticks. */
const COMMAND = /\bhardis:[a-z0-9]+(?::[a-z0-9-]+)+/g;

/** The reference page of a command, as mkdocs serves it. */
function docUrl(command) {
  return `${DOC_BASE}/${command.split(":").join("/")}/`;
}

/** True when the sibling clone has a page for this command. */
function hasDocPage(command) {
  const file = path.join(SIBLING_DOCS, ...command.split(":").slice(1)) + ".md";
  return fs.existsSync(file);
}

/**
 * The commands one block names, in the order it names them, without the ones
 * that cannot have a page: a wildcard, or a name cut short by the prose.
 */
function commandsOf(block) {
  const found = [];
  for (const match of block.matchAll(COMMAND)) {
    const command = match[0];
    // "sf hardis:org:diagnose:*" names a family, not a command
    if (/^:?\*/.test(block.slice(match.index + command.length))) {
      continue;
    }
    if (!found.includes(command)) {
      found.push(command);
    }
  }
  return found;
}

/** The generated line, markers included, or "" when there is nothing to link. */
function linkBlock(commands, locale) {
  if (commands.length === 0) {
    return "";
  }
  const words = LOCALES[locale];
  const lead = commands.length === 1 ? words.one : words.many;
  const links = commands.map((command) => `[${command}](${docUrl(command)})`);
  return `${START}\n${lead} ${links.join(", ")}\n${END}`;
}

/** Drops a previously generated line, so the block can be rebuilt from scratch. */
function stripPrevious(block) {
  const pattern = new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n*`, "g");
  return block.replace(pattern, "\n\n");
}

function rewrite(text, locale, unknown) {
  return text.replace(UNDER_THE_HOOD, (whole, body) => {
    const clean = stripPrevious(body);
    const commands = commandsOf(clean);
    for (const command of commands) {
      if (fs.existsSync(SIBLING_DOCS) && !hasDocPage(command)) {
        unknown.add(command);
      }
    }
    const generated = linkBlock(commands, locale);
    const trimmed = clean.replace(/\s*$/, "");
    const tail = generated ? `\n\n${generated}\n\n` : "\n\n";
    const head = whole.slice(0, whole.indexOf(body));
    return `${head}${trimmed}${tail}</details>`;
  });
}

const present = fs
  .readdirSync(LABS_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const missing = present.filter((locale) => !LOCALES[locale]);
if (missing.length > 0) {
  console.error(
    `No lead-in for locale(s) ${missing.join(", ")}. Add them to LOCALES in scripts/build/lab-command-links.mjs.`
  );
  process.exit(1);
}

const changed = [];
const pending = [];
const unknown = new Set();
let total = 0;
for (const locale of present) {
  const labsDir = path.join(LABS_ROOT, locale);
  for (const levelDir of fs.readdirSync(labsDir)) {
    const dir = path.join(labsDir, levelDir);
    if (!fs.statSync(dir).isDirectory()) {
      continue;
    }
    for (const file of fs.readdirSync(dir)) {
      if (!/^\d+-\d+-[a-z0-9-]+\.md$/.test(file)) {
        continue;
      }
      total += 1;
      const full = path.join(dir, file);
      const original = fs.readFileSync(full, "utf8");
      const eol = original.includes("\r\n") ? "\r\n" : "\n";
      const updated = rewrite(original.split("\r\n").join("\n"), locale, unknown)
        .split("\n")
        .join(eol);
      if (updated === original) {
        continue;
      }
      changed.push(path.relative(ROOT, full).split(path.sep).join("/"));
      pending.push([full, updated]);
    }
  }
}

if (unknown.size > 0) {
  console.error(
    `No page in ../sfdx-hardis/docs/hardis for: ${[...unknown].sort().join(", ")}.`
  );
  console.error("Fix the command name in the lab, or the link would 404.");
  // Nothing has been written yet: a bad link never reaches a lab, and a second
  // run after the fix starts from the files as they were.
  process.exit(1);
}

if (!CHECK) {
  for (const [file, content] of pending) {
    fs.writeFileSync(file, content, "utf8");
  }
}

if (CHECK) {
  if (changed.length > 0) {
    console.error(
      `${changed.length} lab(s) name a command without linking its documentation. Run: node scripts/build/lab-command-links.mjs`
    );
    changed.forEach((file) => console.error(`  ${file}`));
    process.exit(1);
  }
  console.log(
    `${total} lab(s) checked in ${present.length} locale(s): every Under the hood block links the commands it names.`
  );
} else {
  console.log(`${changed.length} lab(s) updated, of ${total} in ${present.length} locale(s).`);
  changed.forEach((file) => console.log(`  ${file}`));
}
