/**
 * node --test scripts/guinea-run/verify-submission.test.mjs
 *
 * Fixtures are signed with a test key, never the real one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { recordText, submissionText, hmac } from "../../site-theme/javascripts/guinea-run/core/tally.js";
import { verifySubmission, extractField, parseLimits, parseKeys } from "./verify-submission.mjs";

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);
const keys = parseKeys(JSON.stringify({ 3: KEY.toString("base64"), 4: OTHER_KEY.toString("base64") }));
const limits = parseLimits(
  JSON.stringify({ caps: { 0: 5000, 1: 8000 }, legacyCaps: { 0: 1000 }, minBossMs: { 1: 20000 }, rateMinutes: 10 })
);
const CREATED = "2026-11-02T10:30:00Z";
const createdMs = Date.parse(CREATED);
const hour = Math.floor(createdMs / 3600000);

async function result(fields, key = KEY) {
  const r = { w: 0, sc: 4000, st: 3, bm: null, m: "easy", at: createdMs - 60000, v: "2026.10.22", k: 3, ...fields };
  r.sg = await hmac(key, recordText(r));
  return r;
}

async function submission(results, fields = {}, key = KEY) {
  const s = { f: 1, h: "Jane-Doe", hr: hour, k: 3, r: results, ...fields };
  s.sg = await hmac(key, submissionText(s));
  return s;
}

const body = (s) => `### Scores\n\n\`\`\`json\n${typeof s === "string" ? s : JSON.stringify(s)}\n\`\`\`\n`;

function check(s, overrides = {}) {
  return verifySubmission({
    body: body(s),
    author: "jane-doe",
    createdAt: CREATED,
    keys,
    limits,
    board: { banned: [], players: {} },
    issueNumber: 12,
    ...overrides
  });
}

test("the field is read with or without its code fence", () => {
  assert.equal(extractField("### Scores\n\n  {\"a\":1}  \n", "Scores"), '{"a":1}');
  assert.equal(extractField("### Scores\n\n```json\n{\"a\":1}\n```", "Scores"), '{"a":1}');
  assert.equal(extractField("### Other\n\nx", "Scores"), "");
});

test("the limits fall back when the secret is empty, and say so", () => {
  const warnings = [];
  const fallback = parseLimits("", (message) => warnings.push(message));
  assert.equal(fallback.caps[0], 20000);
  assert.equal(fallback.legacyCaps[9], 6000);
  assert.equal(fallback.rateMinutes, 10);
  assert.equal(warnings.length, 1);
});

test("a valid submission is accepted and normalized", async () => {
  const s = await submission([await result({ w: 1, sc: 7000, st: 2, bm: 25000 }), await result({ w: 0 })]);
  const out = await check(s);
  assert.equal(out.valid, true, out.reason);
  assert.equal(out.submission.handle, "jane-doe");
  assert.deepEqual(out.submission.results.map((r) => r.w), [0, 1]);
  assert.equal(out.submission.results[1].bossMs, 25000);
  assert.equal(out.submission.results[0].legacy, false);
});

test("a result signed with another known key is accepted", async () => {
  const s = await submission([await result({ k: 4 }, OTHER_KEY)]);
  assert.equal((await check(s)).valid, true);
});

test("a tampered score is refused", async () => {
  const r = await result({});
  const s = await submission([r]);
  s.r[0].sc = 4999;
  assert.equal((await check(s)).reason, "bad-result-signature");
});

test("a submission from another author is refused", async () => {
  const s = await submission([await result({})]);
  assert.equal((await check(s, { author: "someone-else" })).reason, "handle-mismatch");
});

test("a submission signed hours before the issue is refused", async () => {
  const s = await submission([await result({})], { hr: hour - 2 });
  assert.equal((await check(s)).reason, "stale-hour");
});

test("an unknown key is refused", async () => {
  const s = await submission([await result({})], { k: 99 });
  assert.equal((await check(s)).reason, "unknown-key");
});

test("a bad submission signature is refused", async () => {
  const s = await submission([await result({})], {}, OTHER_KEY);
  assert.equal((await check(s)).reason, "bad-seal");
});

test("a score over the cap of its world is refused", async () => {
  const s = await submission([await result({ sc: 5001 })]);
  assert.equal((await check(s)).reason, "over-cap");
});

test("a boss beaten faster than possible is refused", async () => {
  const s = await submission([await result({ w: 1, sc: 100, bm: 19999 })]);
  assert.equal((await check(s)).reason, "boss-too-fast");
});

test("the same world twice is refused", async () => {
  const s = await submission([await result({}), await result({ sc: 10 })]);
  assert.equal((await check(s)).reason, "duplicate-world");
});

test("a legacy result over its cap is refused", async () => {
  const s = await submission([{ w: 0, sc: 1001, st: 2, legacy: true }]);
  assert.equal((await check(s)).reason, "legacy-over-cap");
});

test("a legacy result within its cap is accepted before the cutoff", async () => {
  const s = await submission([{ w: 0, sc: 900, st: 2, legacy: true }]);
  const out = await check(s);
  assert.equal(out.valid, true, out.reason);
  assert.equal(out.submission.results[0].legacy, true);
});

test("a legacy result after the cutoff is refused", async () => {
  const created = "2027-01-01T00:30:00Z";
  const s = await submission([{ w: 0, sc: 900, st: 2, legacy: true }], { hr: Math.floor(Date.parse(created) / 3600000) });
  assert.equal((await check(s, { createdAt: created })).reason, "legacy-closed");
});

test("a second submission within the rate limit is refused", async () => {
  const s = await submission([await result({})]);
  const board = { banned: [], players: { "jane-doe": { handle: "Jane-Doe", submittedAt: "2026-11-02T10:25:00Z", issue: 11 } } };
  assert.equal((await check(s, { board })).reason, "rate-limited");
  // The same issue, reopened, is not a new submission
  assert.equal((await check(s, { board, issueNumber: 11 })).valid, true);
  const later = { banned: [], players: { "jane-doe": { handle: "Jane-Doe", submittedAt: "2026-11-02T10:15:00Z", issue: 11 } } };
  assert.equal((await check(s, { board: later })).valid, true);
});

test("a banned handle is refused", async () => {
  const s = await submission([await result({})]);
  assert.equal((await check(s, { board: { banned: ["JANE-DOE"], players: {} } })).reason, "banned");
});

test("an empty or broken submission is refused", async () => {
  assert.equal((await check(await submission([]))).reason, "no-results");
  assert.equal((await check("{not json")).reason, "bad-json");
  assert.equal((await check("x".repeat(17000))).reason, "too-large");
});

test("a result in a mode the game does not have is refused", async () => {
  const s = await submission([await result({ m: "insane" })]);
  assert.equal((await check(s)).reason, "bad-mode");
});

test("a result keeps the mode it was played in", async () => {
  const s = await submission([await result({ m: "hard" })]);
  const outcome = await check(s);
  assert.equal(outcome.valid, true);
  assert.equal(outcome.submission.results[0].mode, "hard");
});

test("a mode changed after the game signed the result is refused", async () => {
  const signed = await result({ m: "easy" });
  const s = await submission([{ ...signed, m: "hard" }]);
  assert.equal((await check(s)).reason, "bad-result-signature");
});

test("a world number changed after the game signed the result is refused", async () => {
  const signed = await result({ w: 0 });
  const s = await submission([{ ...signed, w: 5 }]);
  assert.equal((await check(s)).reason, "bad-result-signature");
});
