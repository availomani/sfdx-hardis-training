#!/usr/bin/env node
/**
 * Keeps every lab on the step template (scripts/lib/lab-template.mjs).
 *
 *   node scripts/verify/check-lab-template.mjs          every locale
 *   node scripts/verify/check-lab-template.mjs fr       one locale
 *
 * It fails on:
 *
 *   - a numbered step whose first line is not its Goal
 *   - a numbered step with no "You should now see" block, or one followed by
 *     another block, a Careful box or an Under the hood block
 *   - a note, tip, info or danger box: a lab has Careful (warning) and the
 *     blocks of the template, nothing else. One exception: a tip nested inside
 *     a task of a Do block, indented 2 spaces, for what only some learners need
 *     (another IDE, an older version, a way back after a mistake). Numbered, it
 *     would read as a task for everybody; after the list, it would come too late.
 *     A tip at the top level is also fine outside the numbered steps (The
 *     situation, Check your work, Claim your badge) and right after the text of
 *     a Why block, for an aside about some learners only
 *   - a code fence without an allowed title, or with the Under the hood title
 *     outside an Under the hood block
 *   - a bold run that is a sentence (it ends with a full stop, an exclamation
 *     mark or a colon). Bold is what the learner sees on a screen. The symptoms of
 *     "If it goes wrong" and the three lines at the top of a lab are left alone.
 *
 * The bold rule is a heuristic: it catches a rule written in bold, not every
 * bold word that is not a button. Review does the rest.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LAB_TEMPLATE, templateWords, blockKind, lineKey, markFences, proseBoldRuns } from "../lib/lab-template.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const LABS = path.join(ROOT, "labs");

// The "If it goes wrong" heading per locale, as scripts/build/site.mjs folds it
const TROUBLESHOOTING = { en: "If it goes wrong", fr: "En cas de problème" };

const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const locales = Object.keys(LAB_TEMPLATE).filter((locale) => fs.existsSync(path.join(LABS, locale)) && (wanted.length === 0 || wanted.includes(locale)));

function labFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      labFiles(full, out);
    } else if (/^\d+-\d+-.*\.md$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The problems of one lab page, as "line: message". */
export function checkLab(content, locale) {
  const words = templateWords(locale);
  const problems = [];
  const lines = markFences(content.split(/\r?\n/));
  const report = (index, message) => problems.push(`${index + 1}: ${message}`);

  // Steps, blocks and boxes, line by line
  let step = null;
  let block = null;
  let inDetails = false;
  let fence = null;
  const closeStep = () => {
    if (!step) {
      return;
    }
    if (!step.goal) {
      report(step.line, `step "${step.title}" does not start with "${words.goal}:"`);
    }
    if (step.checkLine === null) {
      report(step.line, `step "${step.title}" has no "#### ${words.check}" block`);
    } else if (step.afterCheck) {
      report(step.afterCheck, `"#### ${words.check}" of step "${step.title}" is not the last block of the step`);
    }
    step = null;
  };

  lines.forEach(({ line, code }, index) => {
    if (code) {
      const open = line.match(/^\s*(```+|~~~+)(.*)$/);
      if (open && !fence) {
        fence = open[1];
        const title = (open[2].match(/title="([^"]*)"/) || [])[1];
        if (!title) {
          report(index, "code fence without a title: " + words.codeTitles.map((t) => `title="${t}"`).join(", "));
        } else if (!words.codeTitles.includes(title)) {
          report(index, `code fence titled "${title}", which is not one of: ${words.codeTitles.join(", ")}`);
        } else if (words.underTheHoodOnly.includes(title) && !inDetails) {
          report(index, `"${title}" belongs inside an Under the hood block`);
        }
      } else if (fence && line.trim().startsWith(fence[0].repeat(fence.length)) && line.trim().replace(/[`~]/g, "") === "") {
        fence = null;
      }
      if (step && step.checkLine !== null && !step.afterCheck) {
        // a fence inside the check block is fine
      }
      return;
    }
    if (/^<details/.test(line)) {
      inDetails = true;
      if (step && step.checkLine !== null && !step.afterCheck) {
        step.afterCheck = index;
      }
    }
    if (/<\/details>/.test(line)) {
      inDetails = false;
    }
    const nested = line.match(/^ +(!!!|\?\?\?\+?) (\w+)/);
    if (nested && nested[2] !== "warning") {
      if (nested[2] !== "tip") {
        report(index, `"${nested[1]} ${nested[2]}" box: inside a task, only a tip`);
      } else if (block !== "do" || !/^ {2}!!! tip "[^"]+"\s*$/.test(line)) {
        // mdx_truly_sane_lists reads a task's blocks at 2 spaces: any other indent prints "!!! tip" as text
        report(index, `nested tip: it goes inside a task of a "#### ${words.do}" block, as '  !!! tip "Title"' (2 spaces, body at 6)`);
      }
    }
    const box = line.match(/^(!!!|\?\?\?\+?) (\w+)/);
    if (box) {
      // a tip at the top level is fine outside the numbered steps, and right after the text of a Why
      // block; anywhere else it would split a Do list or land between blocks
      const tipAllowed = box[2] === "tip" && (!step || block === "why");
      if (["note", "tip", "info", "danger"].includes(box[2]) && !tipAllowed) {
        const hint = box[2] === "tip" ? `nest it inside the task it belongs to, indented 2 spaces, or put it after the text of the "#### ${words.why}" block` : "use a Do, Why or Careful block (warning) instead";
        report(index, `"${box[1]} ${box[2]}" box: ${hint}`);
      }
      block = null;
      if (step && step.checkLine !== null && !step.afterCheck) {
        step.afterCheck = index;
      }
    }
    const heading = line.match(/^(#{1,4}) (.*)$/);
    if (heading) {
      const level = heading[1].length;
      block = level === 4 && step ? blockKind(heading[2], words) : null;
      if (level <= 3) {
        closeStep();
      }
      if (level === 3 && /^\d+\.\s/.test(heading[2])) {
        step = { title: heading[2], line: index, goal: false, firstLineSeen: false, checkLine: null, afterCheck: null };
        return;
      }
      if (level === 4 && step) {
        const kind = blockKind(heading[2], words);
        if (step.checkLine !== null && !step.afterCheck) {
          step.afterCheck = index;
        }
        if (kind === "check") {
          step.checkLine = index;
          step.afterCheck = null;
        }
      }
      return;
    }
    if (step && !step.firstLineSeen && line.trim() !== "") {
      step.firstLineSeen = true;
      step.goal = lineKey(line, words.goal) !== null;
    }
  });
  closeStep();

  // Bold that is a sentence, outside the troubleshooting section and the top lines
  const troubleshooting = TROUBLESHOOTING[locale];
  const allLines = content.split(/\r?\n/);
  const troubleStart = allLines.findIndex((line) => line === `## ${troubleshooting}`);
  const troubleEnd = troubleStart < 0 ? -1 : allLines.findIndex((line, i) => i > troubleStart && /^## /.test(line));
  const metaKeys = new Set(words.meta);
  for (const run of proseBoldRuns(content)) {
    const lineIndex = run.line - 1;
    if (troubleStart >= 0 && lineIndex > troubleStart && (troubleEnd < 0 || lineIndex < troubleEnd)) {
      continue;
    }
    const text = run.text.replace(/\s+/g, " ").trim();
    if (metaKeys.has(text) || /^\(\d+\)$/.test(text)) {
      continue;
    }
    // "Git: Merge..." is the name of a command, its dots are part of it, and an answer such as
    // "I'm hardcore, I don't need an org !" ends with a spaced exclamation mark on the screen
    if (/[.!:]$/.test(text) && !/(\.\.\.|…| !)$/.test(text)) {
      report(lineIndex, `bold sentence "${text.slice(0, 60)}": bold is for what a screen shows; write it plain, or make it a Careful block`);
    }
  }
  return problems;
}

let failures = 0;
let pages = 0;
for (const locale of locales) {
  for (const file of labFiles(path.join(LABS, locale))) {
    pages++;
    const problems = checkLab(fs.readFileSync(file, "utf8"), locale);
    if (problems.length) {
      failures += problems.length;
      console.log(path.relative(ROOT, file).split(path.sep).join("/"));
      problems.forEach((problem) => console.log("   " + problem));
    }
  }
}
console.log(`${pages} lab page(s) checked, ${failures} problem(s).`);
process.exit(failures ? 1 : 0);
