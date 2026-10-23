/**
 * node --test scripts/guinea-run/pinball.test.mjs
 *
 * Pipeline Pinball, the bonus table, without a browser: its physics (nothing
 * passes through a wall, no ball gets stuck, the plunger and the ramps do
 * what the table promises), its rules, and its saved game.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createPhysics, MAX_SPEED } from "../../site-theme/javascripts/guinea-run/worlds/pinball/physics.js";
import { buildTable, TABLE } from "../../site-theme/javascripts/guinea-run/worlds/pinball/layout.js";
import { createRules, BALLS_PER_GAME } from "../../site-theme/javascripts/guinea-run/worlds/pinball/rules.js";
import { createAutoplay } from "../../site-theme/javascripts/guinea-run/worlds/pinball/autoplay.js";

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function quietOut(log) {
  return {
    say: (kind, key) => log && log.push(key),
    sound() {},
    event: (name, data) => log && log.push(name + (data && data.id !== undefined ? ":" + data.id : "")),
    text: (key) => key,
    onBeat: () => true
  };
}

test("the fastest ball never passes through a thin wall", () => {
  for (let i = 0; i < 60; i++) {
    const p = createPhysics();
    p.capsule(-60, 5, 60, 5, { r: 0.06 });
    p.setGravity(0);
    const angle = -Math.PI / 2 + ((i / 59) - 0.5) * 2.6;
    const ball = p.addBall(0, 8, Math.cos(angle) * MAX_SPEED, Math.sin(angle) * MAX_SPEED, 0);
    for (let k = 0; k < 120; k++) {
      p.advance(1 / 240);
      assert.ok(ball.y > 5, "the ball crossed the wall at angle " + angle.toFixed(2));
    }
  }
});

test("a flipper sends a ball resting on it up the table, fast", () => {
  const table = buildTable();
  const p = table.physics;
  const ball = p.addBall(-1.4, 3.6, 0, -2, 0);
  p.advance(0.25);
  table.parts.flippers.left.held = true;
  let top = 0;
  let up = 0;
  for (let k = 0; k < 30; k++) {
    p.advance(1 / 240);
    top = Math.max(top, Math.hypot(ball.vx, ball.vy));
    up = Math.max(up, ball.vy);
  }
  assert.ok(top > 60, "the flip gave " + top.toFixed(1));
  assert.ok(up > 40, "up the table: " + up.toFixed(1));
});

test("random play: no ball escapes the table, none stays stuck", () => {
  const random = seeded(7);
  for (let run = 0; run < 120; run++) {
    const table = buildTable();
    const p = table.physics;
    table.parts.productionGate.enabled = random() < 0.5;
    for (const admin of table.parts.admins) {
      admin.enabled = random() < 0.3;
    }
    const bot = createAutoplay(table, random);
    const ball = p.addBall(TABLE.plunger.x, TABLE.plunger.y + 0.55, 0, 0, 0);
    let still = 0;
    for (let t = 0; t < 60 && ball.active; t += 1 / 60) {
      bot.step(1 / 60, { press() {}, release() {}, launched() {} });
      p.advance(1 / 60);
      p.readEvents((e) => {
        if (e.type === "enter") {
          if (e.tag === "release") {
            p.sendOnPath(e.ball, table.parts.paths.release, 6);
          } else {
            p.release(e.ball, 4.4, -12.4);
          }
        } else if (e.type === "cross" && e.tag === "upperDrain" && e.value > 0) {
          p.sendOnPath(e.ball, table.parts.paths.down, 4);
        }
      });
      const flipping = Object.values(table.parts.flippers).some((f) => f.held);
      const onPlunger = ball.x > TABLE.laneWall && ball.y < 2;
      still = ball.mode === "table" && !flipping && !onPlunger && Math.hypot(ball.vx, ball.vy) < 0.5 ? still + 1 / 60 : 0;
      assert.ok(still < 3, `run ${run}: stuck at ${ball.x.toFixed(2)},${ball.y.toFixed(2)} on floor ${ball.floor}`);
      if (ball.mode === "table") {
        const out = ball.floor === 0 ? ball.x < TABLE.left - 0.6 || ball.x > TABLE.right + 0.6 || ball.y > TABLE.top + 0.4 : ball.x < TABLE.upperLeft - 0.4 || ball.x > TABLE.upperRight + 0.4 || ball.y > TABLE.upperTop + 0.4;
        assert.ok(!out, `run ${run}: the ball left the table at ${ball.x.toFixed(2)},${ball.y.toFixed(2)}`);
      }
    }
  }
});

test("a middle pull of the plunger drops the ball in a top lane, a full one goes round the orbit", () => {
  const first = (pull) => {
    const table = buildTable();
    const p = table.physics;
    p.addBall(TABLE.plunger.x, TABLE.plunger.y + 0.55, 0, 0, 0);
    p.advance(0.3);
    p.pullPlunger(pull);
    p.advance(0.3);
    p.releasePlunger();
    let tag = "";
    for (let t = 0; t < 4 && !tag; t += 0.01) {
      p.advance(0.01);
      p.readEvents((e) => {
        if (!tag && e.type === "cross") {
          tag = e.tag;
        }
      });
    }
    return tag;
  };
  assert.equal(first(0.3), "lane2");
  assert.equal(first(0.5), "lane1");
  assert.equal(first(0.7), "lane0");
  assert.equal(first(1), "orbitLeft");
});

test("a ramp shot fast enough makes it, a weak one rolls back", () => {
  const shoot = (speed) => {
    const table = buildTable();
    const p = table.physics;
    p.addBall(-3.0, 12.1, 0, speed, 0);
    const seen = [];
    for (let t = 0; t < 3; t += 0.01) {
      p.advance(0.01);
      p.readEvents((e) => seen.push(e.type + ":" + e.tag));
    }
    return seen;
  };
  assert.ok(shoot(45).includes("rampDone:integration"));
  const weak = shoot(14);
  assert.ok(weak.includes("ramp:integration") && weak.includes("rampBack:integration") && !weak.includes("rampDone:integration"));
});

test("three drains end the game, a ball save gives the ball back", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const p = table.physics;
  const drainAll = () => {
    for (const b of p.balls) {
      if (b.active) {
        p.removeBall(b);
        rules.event({ type: "drain", tag: "", value: 0, ball: b });
      }
    }
  };
  // Saved: the plunger launched it a moment ago
  rules.launched();
  rules.update(0.5);
  drainAll();
  assert.ok(log.includes("pbBallSaved"));
  for (let i = 0; i < 5; i++) {
    rules.update(0.5);
  }
  // Three balls, then the match: a match is one more ball, so drain until the end
  for (let ball = 1; ball <= BALLS_PER_GAME + 2 && !rules.over; ball++) {
    rules.update(20);
    drainAll();
    for (let i = 0; i < 12; i++) {
      rules.update(0.5);
    }
  }
  assert.ok(rules.over, "the game is over after " + BALLS_PER_GAME + " balls");
  assert.ok(log.includes("match"), "the match is drawn at the end");
  assert.ok(log.includes("gameOver"));
});

test("three nudges in a row tilt the table: flippers dead until the next ball", () => {
  const table = buildTable();
  const rules = createRules(table, quietOut([]), seeded(3));
  rules.newGame();
  // Two warnings, then the third tilts
  assert.equal(rules.nudge(), 1);
  assert.equal(rules.nudge(), 1);
  assert.equal(rules.nudge(), 0);
  assert.equal(rules.state.tilted, true);
  assert.equal(table.parts.flippers.left.enabled, false);
  // Tilted, a bumper no longer kicks the ball away
  const p = table.physics;
  const bumper = table.parts.bumpers[0];
  const ball = p.balls.find((b) => b.active);
  ball.x = bumper.ax;
  ball.y = bumper.ay + 0.95;
  ball.vx = 0;
  ball.vy = -6;
  p.advance(0.1);
  assert.ok(Math.hypot(ball.vx, ball.vy) < 10, "a dead bumper only lets the ball bounce off");
});

test("the scoop starts the mission picked with the flippers, and a won mission counts", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  table.physics.hold(ball, TABLE.scoop.x, TABLE.scoop.y);
  rules.event({ type: "enter", tag: "scoop", value: 5, ball });
  // Pick mission 3 with the right flipper, three times
  rules.flip(1);
  rules.flip(1);
  rules.flip(1);
  rules.update(4);
  assert.equal(rules.state.mission.id, 3);
  for (let i = 0; i < 3; i++) {
    rules.event({ type: "rampDone", tag: "integration", value: 30, ball });
  }
  assert.equal(rules.state.done[3], true);
  assert.equal(rules.state.mission, null);
  assert.ok(log.includes("pbMissionDone"));
});

test("Recent Changes light the lock, three locks start Deploy to all orgs", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  // The ball is in play, off the plunger
  ball.x = 0;
  ball.y = 10;
  for (let lock = 0; lock < 3; lock++) {
    for (let i = 0; i < 5; i++) {
      rules.event({ type: "hit", tag: "drop" + i, value: 10, ball });
    }
    assert.equal(rules.state.lockLit, true);
    rules.event({ type: "rampDone", tag: "integration", value: 30, ball });
    rules.update(2);
  }
  assert.ok(rules.state.mb, "multiball started");
  assert.ok(log.includes("pbMultiball"));
  for (let i = 0; i < 10; i++) {
    rules.update(0.5);
  }
  assert.equal(table.physics.activeBalls(), 3);
});

test("the promotion opens production in order only", () => {
  const table = buildTable();
  const rules = createRules(table, quietOut([]), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  rules.event({ type: "rampDone", tag: "uat", value: 30, ball });
  assert.equal(rules.state.promo, 0);
  rules.event({ type: "rampDone", tag: "integration", value: 30, ball });
  rules.event({ type: "rampDone", tag: "uat", value: 30, ball });
  rules.event({ type: "cross", tag: "orbitLeft", value: 20, ball });
  rules.update(0.1);
  assert.equal(rules.state.promo, 3);
  assert.equal(table.parts.productionGate.enabled, false, "the production ramp is open");
});

test("a saved game comes back as it was, and all ten missions lead to Release day then the next level", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  rules.state.score = 1234567;
  rules.state.done = rules.state.done.map((d, i) => i !== 9);
  const saved = rules.snapshot();
  const again = buildTable();
  const restored = createRules(again, quietOut([]), seeded(4));
  restored.restore(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.state.score, 1234567);
  assert.deepEqual(restored.state.done, saved.done);
  assert.equal(again.physics.activeBalls(), 1, "the ball waits on the plunger again");
  // The last mission done, then Release day at the scoop
  restored.state.done[9] = true;
  const ball = again.physics.balls.find((b) => b.active);
  again.physics.hold(ball, TABLE.scoop.x, TABLE.scoop.y);
  restored.event({ type: "enter", tag: "scoop", value: 5, ball });
  restored.update(3);
  assert.equal(restored.state.mission.id, "wizard");
  restored.update(200);
  assert.equal(restored.state.level, 2);
  assert.ok(restored.state.done.every((d) => !d), "a new round of missions");
});

test("a saved game is signed: read back as it was, refused once edited by hand", async () => {
  const store = new Map();
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const { saveCheckpoint, loadCheckpoint, hasCheckpoint, clearCheckpoint } = await import("../../site-theme/javascripts/guinea-run/core/checkpoint.js");
  assert.equal(await loadCheckpoint(), null);
  assert.equal(await saveCheckpoint({ score: 4200, level: 2 }), true);
  assert.equal(hasCheckpoint(), true);
  assert.deepEqual((await loadCheckpoint()).state, { score: 4200, level: 2 });
  const [key, raw] = [...store.entries()][0];
  store.set(key, raw.replace("4200", "9999999"));
  assert.deepEqual(await loadCheckpoint(), { broken: true });
  clearCheckpoint();
  assert.equal(hasCheckpoint(), false);
});

test("a top lane counts whichever way the ball rolls over it, and a replay score gives an extra ball", () => {
  const table = buildTable();
  const rules = createRules(table, quietOut([]), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  // Up out of the bumpers
  rules.event({ type: "cross", tag: "lane0", value: -8, ball });
  rules.update(0.5);
  rules.event({ type: "cross", tag: "lane1", value: 8, ball });
  rules.update(0.5);
  rules.event({ type: "cross", tag: "lane2", value: -8, ball });
  assert.equal(rules.state.bonusX, 2, "the three lanes raise the bonus multiplier");
  rules.state.score = 4999000;
  rules.event({ type: "hit", tag: "bumper0", value: 10, ball });
  assert.equal(rules.state.extraBalls, 1, "passing 5,000,000 gives an extra ball");
});

test("a whole game played by the bot ends: no hole, path or rule keeps a ball forever", () => {
  const random = seeded(11);
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), random);
  const bot = createAutoplay(table, random);
  rules.newGame();
  const dt = 1 / 60;
  let t = 0;
  while (!rules.over && t < 3600) {
    bot.step(dt, { press: (f) => rules.flip(f.side), release() {}, launched: () => rules.launched() });
    table.physics.advance(dt);
    table.physics.readEvents((e) => rules.event(e));
    rules.update(dt);
    t += dt;
  }
  assert.ok(rules.over, "the game ended within an hour of play (" + Math.round(t / 60) + " min, score " + rules.state.score + ")");
});

test("each round of jackpots is worth a step more, and the super jackpot pays the round back", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  ball.x = 0;
  ball.y = 10;
  for (let lock = 0; lock < 3; lock++) {
    for (let i = 0; i < 5; i++) {
      rules.event({ type: "hit", tag: "drop" + i, value: 10, ball });
    }
    rules.event({ type: "rampDone", tag: "integration", value: 30, ball });
    rules.update(2);
  }
  assert.ok(rules.state.mb, "Deploy to all orgs started");
  rules.event({ type: "rampDone", tag: "integration", value: 30, ball });
  rules.event({ type: "rampDone", tag: "uat", value: 30, ball });
  rules.event({ type: "cross", tag: "orbitLeft", value: 20, ball });
  assert.equal(rules.state.mb.collected, 1200000, "three jackpots of the first round");
  rules.event({ type: "rampDone", tag: "production", value: 30, ball });
  assert.ok(log.includes("pbSuperJackpot"));
  assert.equal(rules.state.mb.step, 1, "the next round is a step up");
  rules.event({ type: "rampDone", tag: "uat", value: 30, ball });
  assert.equal(rules.state.mb.collected, 800000, "a jackpot of the second round is worth twice the first");
});

test("orbits one after the other are loops, and the whole pipeline in one go pays", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  rules.event({ type: "cross", tag: "orbitRight", value: 20, ball });
  rules.update(1);
  rules.event({ type: "cross", tag: "orbitLeft", value: 20, ball });
  assert.equal(rules.state.loops, 2);
  assert.ok(log.includes("pbLoops"));
  rules.update(5);
  rules.event({ type: "rampDone", tag: "integration", value: 30, ball });
  rules.update(2);
  rules.event({ type: "rampDone", tag: "uat", value: 30, ball });
  rules.update(2);
  rules.event({ type: "cross", tag: "orbitLeft", value: 20, ball });
  rules.update(2);
  rules.event({ type: "rampDone", tag: "production", value: 30, ball });
  assert.ok(log.includes("pbPipelineCombo"), "integration, uat, preprod and production within a few seconds each");
});

test("back from production, the Hotfix hurry-up loses value every second, and runs out", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  rules.event({ type: "rampDone", tag: "down", value: 5, ball });
  assert.ok(log.includes("pbHurryStart"));
  const first = rules.hud().hurry;
  rules.update(8);
  const later = rules.hud().hurry;
  assert.ok(first === 1000000 && later < first && later > 100000, "the value falls: " + first + " then " + later);
  rules.event({ type: "enter", tag: "hotfix", value: 5, ball });
  assert.ok(log.includes("pbHurryDone"));
  assert.equal(rules.hud().hurry, 0);
  rules.update(3);
  rules.event({ type: "rampDone", tag: "releaseWire", value: 5, ball });
  rules.update(25);
  assert.ok(log.includes("pbHurryMissed"), "a hurry-up not made runs out");
});

test("a soft plunge into the terminal is the secret skill shot", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  const ball = table.physics.balls.find((b) => b.active);
  rules.launched();
  rules.update(1.2);
  table.physics.hold(ball, -1.6, 18.6);
  rules.event({ type: "enter", tag: "terminal", value: 5, ball });
  assert.ok(log.includes("pbSecretSkill"));
});

test("the Code freeze of Release day counts flips, not seconds", () => {
  const table = buildTable();
  const log = [];
  const rules = createRules(table, quietOut(log), seeded(3));
  rules.newGame();
  rules.state.done = rules.state.done.map(() => true);
  const ball = table.physics.balls.find((b) => b.active);
  table.physics.hold(ball, TABLE.scoop.x, TABLE.scoop.y);
  rules.event({ type: "enter", tag: "scoop", value: 5, ball });
  rules.update(3);
  assert.equal(rules.state.mission.id, "wizard");
  for (let i = 0; i < 6; i++) {
    rules.event({ type: "rampDone", tag: i % 2 ? "uat" : "integration", value: 30, ball });
  }
  assert.ok(log.includes("pbCodeFreeze"));
  assert.equal(rules.hud().flips, 40);
  rules.update(300);
  assert.equal(rules.state.mission && rules.state.mission.id, "wizard", "the clock is stopped");
  for (let i = 0; i < 40; i++) {
    rules.flip(i % 2 ? 1 : -1);
  }
  assert.equal(rules.state.mission, null, "out of flips, the release is over");
  assert.ok(log.includes("pbFreezeTip"));
});
