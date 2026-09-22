/**
 * The badge picture, in its two versions.
 *
 * badges/_template.svg is the full badge, filled in for one learner and one
 * level: used by render.mjs when a claim passes, and by examples.mjs for the
 * home page. badges/_template-banner.svg is the same award drawn for a Trailhead
 * banner, where it is one of twenty at about fifty pixels: no name, no handle,
 * no date, and the level in two letters. Nothing in it is personal, so one file
 * serves every holder of a level.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, "..", "..", "badges", "_template.svg");
const BANNER_TEMPLATE = path.resolve(HERE, "..", "..", "badges", "_template-banner.svg");

/**
 * One entry per level, and the colours the template paints it with.
 *
 * The ramp deepens as the level rises, in the course's own colours: Cloudity
 * blue, then Cloudity purple, then the midnight the site's dark scheme uses,
 * rimmed and chipped in gold. `hue` stays the level's one representative colour,
 * for anything that needs a single value.
 *
 *   top, deep   the colour field, top to bottom
 *   lite        the second cloud of the Cloudity mark on that field
 *   rim         the edge, which has to read on a white page and on #0A0620
 *   pill, ink   the LEVEL chip, inverted at level 3 so gold carries the top rank
 *   superbadge  Release Manager only: it is earned on top of the two others and
 *               the records say so, the way Trailhead separates a superbadge
 *               from a badge, so a banner can draw it apart
 */
export const LEVELS = {
  1: {
    name: "sfdx-hardis Contributor Basics",
    blurb: "Delivers a User Story through a Pull Request, end to end.",
    hue: "#0053FF",
    top: "#2E7BFF",
    deep: "#0032A8",
    lite: "#9DC0FF",
    rim: "#0053FF",
    pill: "#FFFFFF",
    ink: "#0053FF"
  },
  2: {
    name: "sfdx-hardis Contributor Advanced",
    blurb: "Solves deployment errors, declares deployment actions, resolves conflicts.",
    hue: "#660FF2",
    top: "#8A3DFF",
    deep: "#3D078F",
    lite: "#CDB0FF",
    rim: "#660FF2",
    pill: "#FFFFFF",
    ink: "#660FF2"
  },
  3: {
    name: "sfdx-hardis Release Manager",
    blurb: "Owns the pipeline, the releases, the hotfixes and the monitoring.",
    superbadge: true,
    hue: "#1B0A3F",
    top: "#2C1263",
    deep: "#0A0620",
    lite: "#FFC96B",
    rim: "#FFB020",
    pill: "#FFB020",
    ink: "#1B0A3F"
  }
};

/**
 * What a level is called when there is no room to say it.
 *
 * A banner draws the badge at about fifty pixels, where "Contributor Basics" is
 * a grey smudge and two letters are still two shapes. The full name stays on the
 * full badge and on the page the banner links to.
 */
export const SHORT_LABELS = { 1: "C1", 2: "C2", 3: "RM" };

/**
 * The banner version of a level: the Cloudity mark, sfdx-hardis, and C1, C2 or
 * RM on a band of the level's own colour.
 */
export function renderBannerSvg(level) {
  const def = LEVELS[level];
  if (!def) {
    throw new Error(`No such level: ${level}`);
  }
  return fs
    .readFileSync(BANNER_TEMPLATE, "utf8")
    .replace(/\{\{HUE_TOP\}\}/g, def.top)
    .replace(/\{\{HUE_DEEP\}\}/g, def.deep)
    .replace(/\{\{HUE_LITE\}\}/g, def.lite)
    .replace(/\{\{HUE_RIM\}\}/g, def.rim)
    // The gold band of level 3 needs dark letters; the other two carry white
    .replace(/\{\{SHORT_INK\}\}/g, level === 3 ? def.ink : "#FFFFFF")
    .replace(/\{\{SHORT\}\}/g, escapeXml(SHORT_LABELS[level] || String(level)))
    .replace(/\{\{NAME\}\}/g, escapeXml(def.name));
}

export function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[ch]);
}

// Long names get a smaller font rather than running off the face of the badge
function fitSize(text, max, width, min = 10) {
  return Math.max(min, Math.min(max, Math.floor(width / (String(text).length * 0.56))));
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
    .replace(/\{\{HUE_TOP\}\}/g, def.top)
    .replace(/\{\{HUE_DEEP\}\}/g, def.deep)
    .replace(/\{\{HUE_LITE\}\}/g, def.lite)
    .replace(/\{\{HUE_RIM\}\}/g, def.rim)
    .replace(/\{\{PILL_FILL\}\}/g, def.pill)
    .replace(/\{\{PILL_INK\}\}/g, def.ink)
    .replace(/\{\{HUE\}\}/g, def.hue)
    .replace(/\{\{LEVEL\}\}/g, String(level))
    .replace(/\{\{NAME\}\}/g, escapeXml(def.name))
    .replace(/\{\{SHORT_NAME\}\}/g, escapeXml(shortName))
    .replace(/\{\{NAME_SIZE\}\}/g, String(fitSize(shortName, 19, 232)))
    // Functions, not strings, for what a learner typed: a string replacement expands
    // $& and $' patterns, and a name holding one would rewrite the badge
    .replace(/\{\{FULLNAME\}\}/g, () => escapeXml(name))
    .replace(/\{\{FULLNAME_SIZE\}\}/g, String(fitSize(name, 19, 190)))
    .replace(/\{\{HANDLE\}\}/g, () => escapeXml(handle))
    // The hexagon narrows towards its foot, so each line gets the width the
    // shape has at its height: 150px for the Trailblazer line, 115px for the
    // handle. Below 7px nothing is readable anyway, and the template cuts the
    // block to the hexagon, so a username longer than anyone has is trimmed
    // instead of hanging outside the badge.
    .replace(/\{\{HANDLE_SIZE\}\}/g, String(fitSize(`@${handle}`, 10.5, 115, 7)))
    .replace(/\{\{TRAILBLAZER_SIZE\}\}/g, String(fitSize(trailblazer ? `Trailblazer ${trailblazer}` : "", 10.5, 150, 7)))
    .replace(/\{\{TRAILBLAZER_LINE\}\}/g, () => (trailblazer ? `Trailblazer ${escapeXml(trailblazer)}` : ""))
    .replace(/\{\{DATE\}\}/g, date);
}
