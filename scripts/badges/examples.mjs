#!/usr/bin/env node
/**
 * Writes the example badges the home page shows, one per level, for a learner
 * who does not exist: Marc B. Re-run it whenever badges/_template.svg changes.
 *
 *   node scripts/badges/examples.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { renderSvg } from "./badge-svg.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "..", "..", "labs", "_assets", "badges");
fs.mkdirSync(OUT, { recursive: true });
for (const level of [1, 2, 3]) {
  const file = path.join(OUT, `example-level-${level}.svg`);
  fs.writeFileSync(file, renderSvg({ level, handle: "marc-b", fullName: "Marc B", trailblazer: "marcb", date: "2026-09-19" }), "utf8");
  console.log(path.relative(process.cwd(), file));
}
