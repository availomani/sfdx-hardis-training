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
import { rankGeneral, rankWorld, rankOf } from "../../site-theme/javascripts/guinea-run/core/hof.js";
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
  assert.match(message, /| 2. Retrieve and commit| 0. Get set up\*\*#2\*\* of 2 overall, with 4100 points and 4 stars/);
  // Worlds are numbered from 0, as in the game
  assert.match(message, /\| 0\. Get set up \| 4000 \| #2 of 2 \|/);
  assert.match(message, /\| 2\. Retrieve and commit \| 100 \| #1 of 1 \|/);
  assert.match(message, /| 2. Retrieve and commit| 0. Get set uphall-of-fame\//);
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
