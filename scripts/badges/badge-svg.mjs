/**
 * The badge picture: badges/_template.svg filled in for one learner and one level.
 * Used by render.mjs when a claim passes, and by examples.mjs for the home page.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, "..", "..", "badges", "_template.svg");

export const LEVELS = {
  1: { name: "sfdx-hardis Contributor Basics", hue: "#F2994A", blurb: "Delivers a User Story through a Pull Request, end to end." },
  2: { name: "sfdx-hardis Contributor Advanced", hue: "#2D9CDB", blurb: "Solves deployment errors, declares deployment actions, resolves conflicts." },
  3: { name: "sfdx-hardis Release Manager", hue: "#6C5CE7", blurb: "Owns the pipeline, the releases, the hotfixes and the monitoring." }
};

export function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch]);
}

// Long names get a smaller font rather than running off the face of the badge
function fitSize(text, max, width) {
  return Math.max(10, Math.min(max, Math.floor(width / (String(text).length * 0.56))));
}

/**
 * fullName is the GitHub display name, handle the GitHub login, trailblazer the
 * Trailblazer username or nothing.
 */
export function renderSvg({ level, handle, fullName, trailblazer, date }) {
  const def = LEVELS[level];
  const shortName = def.name.replace(/^sfdx-hardis /, "");
  const name = String(fullName || "").trim() || handle;
  return fs
    .readFileSync(TEMPLATE, "utf8")
    .replace(/\{\{HUE\}\}/g, def.hue)
    .replace(/\{\{LEVEL\}\}/g, String(level))
    .replace(/\{\{NAME\}\}/g, escapeXml(def.name))
    .replace(/\{\{SHORT_NAME\}\}/g, escapeXml(shortName))
    .replace(/\{\{NAME_SIZE\}\}/g, String(fitSize(shortName, 17, 210)))
    // Functions, not strings, for what a learner typed: a string replacement expands
    // $& and $' patterns, and a name holding one would rewrite the badge
    .replace(/\{\{FULLNAME\}\}/g, () => escapeXml(name))
    .replace(/\{\{FULLNAME_SIZE\}\}/g, String(fitSize(name, 19, 200)))
    .replace(/\{\{HANDLE\}\}/g, () => escapeXml(handle))
    .replace(/\{\{TRAILBLAZER_LINE\}\}/g, () => (trailblazer ? `Trailblazer ${escapeXml(trailblazer)}` : ""))
    .replace(/\{\{DATE\}\}/g, date);
}
