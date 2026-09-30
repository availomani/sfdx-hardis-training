/**
 * Where this course is published, and where it used to be.
 *
 * The site is built here and published to
 * sfdx-hardis-training/sfdx-hardis-training.github.io, an organization site,
 * which serves at the root of its host rather than under a repository name. That
 * is the base path the custom domain will answer on, so the URLs the course has
 * now are the URLs it keeps.
 *
 * SITE_URL is read from training-universe.json rather than written here, because
 * course.site already generates the badge records, the backlog links and the
 * label on the share cards. A second copy of the same string is a second thing to
 * remember on the day it changes. course-site.yml holds the third and last one,
 * which the theme needs and cannot read from JavaScript; check-site.mjs fails if
 * the two ever disagree.
 *
 * LEGACY_SITE_URL is the project site of this repository, where the course lived
 * until 2026-09-30. It is in the badge records people already hold, in the
 * Trailhead trailmixes, in the sfdx-hardis command descriptions, in the VS Code
 * extension fixtures and in the ticketing configuration of every learner's fork,
 * so it keeps answering: scripts/build/redirect-site.mjs builds what it serves.
 *
 * Neither carries a trailing slash. A base URL that sometimes ends in one and
 * sometimes does not is how a joined path gains a double slash.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const universe = JSON.parse(fs.readFileSync(path.join(ROOT, "training-universe.json"), "utf8"));

/** Where the course is published, from training-universe.json course.site. */
export const SITE_URL = universe.course.site.replace(/\/$/, "");

/** The project site of this repository, which now only redirects here. */
export const LEGACY_SITE_URL = "https://hardisgroupcom.github.io/sfdx-hardis-training";
