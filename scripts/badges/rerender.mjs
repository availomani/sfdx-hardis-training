#!/usr/bin/env node
/**
 * Redraws every badge that was already awarded, from the records that hold it.
 *
 *   node scripts/badges/rerender.mjs
 *
 * A badge image is a committed file, written once when the claim passed, so a
 * change to badges/_template.svg leaves every existing holder in the old artwork
 * until this runs. Nothing else changes: the records, the file names and the
 * URLs they publish stay exactly as they were, only the pictures are rewritten.
 *
 * It also redraws what is made of those badges: the banner version of each
 * level, the card a share of a badge page shows, the square picture a badge page
 * offers to attach to a post, the card of the course, and the icon of the site.
 * Run it after any
 * template change, together with scripts/badges/examples.mjs, which does the
 * same for the three examples the home page shows.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderSvg } from "./badge-svg.mjs";
import { writeCards, writeIcon } from "./social.mjs";
import { stampRecords, writeBanners } from "./banners.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BADGES = path.resolve(HERE, "..", "..", "badges");

if (!fs.existsSync(BADGES)) {
  console.log("No badges directory: nothing to redraw.");
  process.exit(0);
}

let count = 0;
for (const file of fs.readdirSync(BADGES)) {
  if (!file.endsWith(".json") || file.startsWith("_")) {
    continue;
  }
  const record = JSON.parse(fs.readFileSync(path.join(BADGES, file), "utf8"));
  const key = record.trailblazer || file.replace(/\.json$/, "");
  const handle = record.recipient || key;
  // The same order the claim used: the Trailblazer profile name first, then the
  // GitHub display name, then the handle
  const fullName = record.trailblazerName || record.name || handle;
  for (const badge of record.badges || []) {
    const image = path.join(BADGES, "img", `${key}-level-${badge.level}.svg`);
    fs.writeFileSync(
      image,
      renderSvg({ level: badge.level, handle, fullName, trailblazer: key, date: badge.issuedOn }),
      "utf8"
    );
    console.log(path.relative(process.cwd(), image));
    count++;
  }
}
console.log(`${count} badge image(s) redrawn.`);

for (const file of writeBanners()) {
  console.log(file);
}
const stamped = stampRecords();
console.log(`Banner badges redrawn, ${stamped.length} record(s) updated.`);

console.log(`Icon: ${writeIcon()}`);
console.log("Cards:");
const written = await writeCards();
console.log(`${written} card(s) redrawn.`);
