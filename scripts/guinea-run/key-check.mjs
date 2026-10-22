#!/usr/bin/env node
/**
 * Checks that the key the game rebuilds from its modules (core/tally.js) is the
 * key the GUINEA_RUN_KEYS secret holds under the same id (TALLY_SET).
 *
 *   GUINEA_RUN_KEYS='{"1":"<base64>"}' node scripts/guinea-run/key-check.mjs
 *
 * A mismatch means every submission sent from the published game is refused.
 * Nothing about a key is ever printed. An empty secret skips the check.
 */
import { TALLY_SET, stamp, recordText, hmac } from "../../site-theme/javascripts/guinea-run/core/tally.js";

const MISMATCH = "The game's key pieces and the GUINEA_RUN_KEYS secret disagree.";
const text = process.env.GUINEA_RUN_KEYS || "";
if (!text.trim()) {
  console.log("GUINEA_RUN_KEYS is empty: nothing to check.");
  process.exit(0);
}
let keys;
try {
  keys = JSON.parse(text);
} catch {
  console.error("GUINEA_RUN_KEYS is not readable JSON.");
  process.exit(1);
}
const encoded = keys && keys[String(TALLY_SET)];
if (!encoded) {
  console.error(`${MISMATCH} The secret has no key ${TALLY_SET}, the id the game signs with.`);
  process.exit(1);
}
const probe = { w: 0, sc: 1234, st: 2, bm: 45678, at: Date.UTC(2026, 0, 1), v: "key-check", k: TALLY_SET };
const fromGame = await stamp(probe);
const fromSecret = await hmac(Buffer.from(String(encoded), "base64"), recordText(probe));
if (!fromGame || fromGame !== fromSecret) {
  console.error(`${MISMATCH} Key id ${TALLY_SET}.`);
  process.exit(1);
}
console.log(`The game and the secret agree on key ${TALLY_SET}.`);
