/**
 * node --test scripts/guinea-run/hall-of-fame.test.mjs
 *
 * Works on temporary folders, never on the real board or the real badges.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { rankGeneral, rankWorld, rankPinball, rankOf, collectResults, topInvites, pinballTarget, scoresOf } from "../../site-theme/javascripts/guinea-run/core/hof.js";
import { emptyBoard, mergeSubmission, badgeLevel, refreshBadges, banPlayer, removePlayer, ranksMessage, readBoard, writeBoard } from "./hall-of-fame.mjs";

const at = (minute) => `2026-11-02T10:${String(minute).padStart(2, "0")}:00.000Z`;
const world = (w, score, stars, bossMs = null) => ({ w, score, stars, bossMs, legacy: false, at: at(0) });

function send(board, handle, results, minute, badge = 0) {
  return mergeSubmission(board, { handle, results }, { issue: minute, author: handle, at: at(minute), badge });
}

test("each world keeps the best score, and the totals follow", () => {
  const board = emptyBoard();
  send(board, "Jane", [world(0, 4000, 3), world(1, 2000, 2, 30000)], 1);
  // Lower everywhere: nothing goes down
  let entry = send(board, "Jane", [world(0, 100, 1), world(1, 10, 1)], 20);
  assert.equal(entry.worlds["0"].score, 4000);
  assert.equal(entry.worlds["1"].score, 2000);
  // Higher in one world: only that world moves
  entry = send(board, "Jane", [world(0, 100, 1), world(1, 2500, 3, 28000)], 40);
  assert.equal(entry.worlds["0"].score, 4000);
  assert.equal(entry.worlds["1"].score, 2500);
  assert.equal(entry.total, 6500);
  assert.equal(entry.stars, 6);
  assert.equal(entry.submittedAt, at(40));
  assert.ok(entry.firstSubmittedAt && entry.firstSubmittedAt <= entry.submittedAt, "the first submission time is kept for ties");
  assert.equal(entry.issue, 40);
});

test("a tie keeps the shorter boss time", () => {
  const board = emptyBoard();
  send(board, "Jane", [world(1, 2000, 2, 30000)], 1);
  let entry = send(board, "Jane", [world(1, 2000, 2, 35000)], 20);
  assert.equal(entry.worlds["1"].bossMs, 30000);
  entry = send(board, "Jane", [world(1, 2000, 2, 25000)], 40);
  assert.equal(entry.worlds["1"].bossMs, 25000);
});

test("the key is the lowercase handle, and the handle is kept as GitHub types it", () => {
  const board = emptyBoard();
  send(board, "Jane-Doe", [world(0, 10, 1)], 1);
  assert.deepEqual(Object.keys(board.players), ["jane-doe"]);
  assert.equal(board.players["jane-doe"].handle, "Jane-Doe");
  assert.throws(() => mergeSubmission(board, { handle: "other", results: [] }, { issue: 1, author: "Jane-Doe", at: at(1) }));
});

test("the rankings break ties on stars, then who sent first", () => {
  const board = emptyBoard();
  send(board, "late", [world(0, 3000, 2)], 30);
  send(board, "early", [world(0, 3000, 2)], 10);
  send(board, "starry", [world(0, 3000, 3)], 50);
  send(board, "top", [world(0, 3500, 1)], 59);
  assert.deepEqual(rankGeneral(board).map((p) => p.handle), ["top", "starry", "early", "late"]);
  assert.equal(rankOf(rankGeneral(board), "EARLY"), 3);

  const fast = emptyBoard();
  send(fast, "slow", [world(1, 2000, 2, 40000)], 1);
  send(fast, "quick", [world(1, 2000, 2, 30000)], 2);
  send(fast, "noclock", [world(1, 2000, 2, null)], 3);
  assert.deepEqual(rankWorld(fast, 1).map((p) => p.handle), ["quick", "slow", "noclock"]);
});

test("the badge is the highest level of the matching records", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hof-badges-"));
  try {
    fs.writeFileSync(path.join(dir, "jdoe.json"), JSON.stringify({ recipient: "Jane-Doe", badges: [{ level: 1 }, { level: 2 }] }));
    fs.writeFileSync(path.join(dir, "other.json"), JSON.stringify({ recipient: "other", badges: [{ level: 3 }] }));
    fs.writeFileSync(path.join(dir, "_template.json"), JSON.stringify({ recipient: "jane-doe", badges: [{ level: 3 }] }));
    assert.equal(badgeLevel(dir, "jane-doe"), 2);
    assert.equal(badgeLevel(dir, "nobody"), 0);

    const board = emptyBoard();
    send(board, "Jane-Doe", [world(0, 10, 1)], 1);
    send(board, "Other", [world(0, 10, 1)], 2, 3);
    assert.equal(refreshBadges(board, dir, at(5)), true);
    assert.equal(board.players["jane-doe"].badge, 2);
    assert.equal(board.updatedAt, at(5));
    assert.equal(refreshBadges(board, dir, at(9)), false);
    assert.equal(board.updatedAt, at(5));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("remove and ban take a player off, and ban keeps them out of the rankings", () => {
  const board = emptyBoard();
  send(board, "Jane", [world(0, 10, 1)], 1);
  send(board, "Cheat", [world(0, 20000, 3)], 2);
  banPlayer(board, "CHEAT");
  assert.deepEqual(board.banned, ["cheat"]);
  assert.equal(board.players.cheat, undefined);
  banPlayer(board, "cheat");
  assert.deepEqual(board.banned, ["cheat"]);
  assert.equal(removePlayer(board, "jane"), true);
  assert.equal(removePlayer(board, "jane"), false);
});

test("the message gives the overall rank and the rank in each world", () => {
  const board = emptyBoard();
  send(board, "Jane", [world(0, 4000, 3), world(2, 100, 1)], 1);
  send(board, "Bob", [world(0, 5000, 3)], 2);
  const message = ranksMessage(board, "jane");
  assert.match(message, /\*\*#2\*\* of 2 overall, with 4100 points and 4 stars/);
  // Worlds are numbered from 0, as in the game
  assert.match(message, /\| 0\. Get set up \| 4000 \| #2 of 2 \|/);
  assert.match(message, /\| 2\. Retrieve and commit \| 100 \| #1 of 1 \|/);
  assert.match(message, /hall-of-fame\//);
});

test("a board is written as 2-space JSON with a final newline, and read back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hof-board-"));
  try {
    const file = path.join(dir, "hall-of-fame", "hall-of-fame.json");
    assert.deepEqual(readBoard(file), emptyBoard());
    writeBoard(file, emptyBoard());
    const text = fs.readFileSync(file, "utf8");
    assert.equal(text, JSON.stringify(emptyBoard(), null, 2) + "\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the board says which mode earned a score, and its world ranking shows it", () => {
  const board = emptyBoard();
  send(board, "Jane", [{ ...world(2, 3000, 3), mode: "hard" }], 1);
  send(board, "Joe", [world(2, 1000, 1)], 2);
  assert.equal(board.players.jane.worlds["2"].mode, "hard");
  const list = rankWorld(board, 2);
  assert.deepEqual(list.map((p) => [p.handle, p.mode]), [["Jane", "hard"], ["Joe", "easy"]]);
});

test("a Pipeline Pinball game keeps the best one, on its own board, out of the total", () => {
  const board = emptyBoard();
  const game = (score, level, minute) => ({ pinball: true, score, ms: 600000, level, missions: 3, notes: 0, at: at(minute) });
  send(board, "Jane", [world(0, 4000, 3), game(5000000, 2, 1)], 1);
  let entry = send(board, "Jane", [game(3000000, 1, 20)], 20);
  assert.equal(entry.pinball.score, 5000000);
  assert.equal(entry.total, 4000, "the pinball score is not added to the worlds");
  entry = send(board, "Jane", [game(9000000, 3, 40)], 40);
  assert.equal(entry.pinball.level, 3);
  send(board, "Bob", [game(9000000, 4, 50)], 50);
  send(board, "Ann", [world(1, 100, 1)], 51);
  assert.deepEqual(rankPinball(board).map((p) => p.handle), ["Bob", "Jane"]);
  const message = ranksMessage(board, "jane");
  assert.match(message, /\| Bonus\. Pipeline Pinball \| 9000000 \| #2 of 2 \|/);
});

test("the pinball record goes with the results only once it is signed", () => {
  const fake = (bonus) => ({ world: () => ({ best: 0, stars: 0 }), bonus });
  assert.equal(collectResults(fake({ best: 10, record: { pin: 1, sc: 10 } }), 0).length, 0);
  const signed = collectResults(fake({ best: 10, record: { pin: 1, sc: 10, sg: "x" } }), 0);
  assert.deepEqual(signed, [{ pin: 1, sc: 10, sg: "x" }]);
});

// Six players on world 0 (6000 down to 1000), their totals the same, and five on the pinball board
function sixPlayers() {
  const board = emptyBoard();
  const game = (score) => ({ pinball: true, score, ms: 600000, level: 1, missions: 0, notes: 0, at: at(0) });
  ["p6", "p5", "p4", "p3", "p2", "p1"].forEach((handle, i) => {
    send(board, handle, [world(0, (6 - i) * 1000, 1)].concat(i < 5 ? [game((5 - i) * 1000000)] : []), i + 1);
  });
  return board;
}
const none = { worlds: {}, pinball: 0 };

test("a score that beats the fifth of a board is invited, a tie with it is not", () => {
  const board = sixPlayers();
  assert.deepEqual(topInvites(board, { worlds: { 0: 2500 }, pinball: 0 }, none, "", [0, "all"]), [
    { board: 0, rank: 5 },
    { board: "all", rank: 5 }
  ]);
  assert.deepEqual(topInvites(board, { worlds: { 0: 2000 }, pinball: 0 }, none, "", [0, "all"]), [], "a tie goes to whoever was there first");
  assert.deepEqual(topInvites(board, { worlds: { 0: 7000 }, pinball: 0 }, none, "", [0]), [{ board: 0, rank: 1 }]);
  assert.deepEqual(topInvites(board, { worlds: { 0: 1500 }, pinball: 0 }, none, "", [0, "all"]), []);
});

test("a board with fewer than five other players invites any score", () => {
  const board = emptyBoard();
  send(board, "Ann", [world(3, 9000, 3)], 1);
  assert.deepEqual(topInvites(board, { worlds: { 3: 10 }, pinball: 0 }, none, "", [3, "all"]), [
    { board: 3, rank: 2 },
    { board: "all", rank: 2 }
  ]);
  assert.deepEqual(topInvites(board, none, none, "", [3, "all", "pinball"]), [], "nothing to send, nothing to invite");
});

test("a score already on the board or already sent is not invited again, and the player is not their own rival", () => {
  const board = sixPlayers();
  // p2 has 2000 on the board: the same score is not new, a better one ranks among the five others
  assert.deepEqual(topInvites(board, { worlds: { 0: 2000 }, pinball: 0 }, none, "P2", [0, "all"]), []);
  assert.deepEqual(topInvites(board, { worlds: { 0: 4500 }, pinball: 0 }, none, "p2", [0, "all"]), [
    { board: 0, rank: 3 },
    { board: "all", rank: 3 }
  ]);
  // Sent a minute ago, not on the board yet
  assert.deepEqual(topInvites(board, { worlds: { 0: 4500 }, pinball: 0 }, { worlds: { 0: 4500 }, pinball: 0 }, "p2", [0, "all"]), []);
});

test("the overall total adds the best of the board and the new scores, world by world", () => {
  const board = sixPlayers();
  // p1 has 1000 on world 0: 2600 on world 5 makes 3600, behind 6000, 5000 and 4000
  assert.deepEqual(topInvites(board, { worlds: { 5: 2600 }, pinball: 0 }, none, "p1", ["all", 5]), [
    { board: "all", rank: 4 },
    { board: 5, rank: 1 }
  ]);
});

test("Pipeline Pinball is invited on its own board, and flashes past the fifth", () => {
  const board = sixPlayers();
  assert.deepEqual(topInvites(board, { worlds: {}, pinball: 1500000 }, none, "", ["pinball", "all"]), [{ board: "pinball", rank: 5 }]);
  assert.deepEqual(topInvites(board, { worlds: {}, pinball: 1000000 }, none, "", ["pinball"]), [], "a tie with the fifth");
  assert.equal(pinballTarget(board, none, ""), 1000000);
  assert.equal(pinballTarget(board, none, "p6"), 0, "only four others: no flash");
  assert.equal(pinballTarget(board, { worlds: {}, pinball: 3500000 }, ""), 3500000, "past what the player sent already");
  assert.equal(pinballTarget(emptyBoard(), none, ""), 0);
});

test("the scores of results, worlds and pinball", () => {
  assert.deepEqual(scoresOf([{ w: 0, sc: 10 }, { w: 2, sc: 30, legacy: true }, { pin: 1, sc: 99 }]), { worlds: { 0: 10, 2: 30 }, pinball: 99 });
});
