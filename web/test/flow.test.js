import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { newGame } from "../src/game.js";
import { hostView, newFlow, nextRound, pickMove, playerView, throwMove } from "../src/flow.js";

const BOT = JSON.parse(readFileSync(new URL("./fixtures/bot_synthetic.json", import.meta.url), "utf-8"));

test("newFlow starts in think with nothing picked or thrown", () => {
  const flow = newFlow(BOT, 3);
  assert.equal(flow.phase, "think");
  assert.equal(flow.pick, null);
  assert.equal(flow.thrown, null);
  assert.deepEqual(flow.game, newGame(BOT, 3));
});

test("pick then throw plays the round", () => {
  const start = newFlow(BOT, 3);
  const pick = start.game.decision.move;
  const picked = pickMove(start, pick);
  assert.equal(picked.phase, "reveal");
  assert.equal(picked.pick, pick);
  const played = throwMove(picked, "R");
  assert.equal(played.phase, "result");
  assert.equal(played.game.history.length, 1);
  assert.equal(played.game.history[0].botMove, pick);
  assert.equal(played.game.history[0].humanMove, "R");
});

test("throw then pick plays the round", () => {
  const start = newFlow(BOT, 3);
  const thrown = throwMove(start, "S");
  assert.equal(thrown.phase, "think");
  assert.equal(thrown.thrown, "S");
  assert.equal(thrown.game.history.length, 0);
  const pick = start.game.decision.move;
  const played = pickMove(thrown, pick);
  assert.equal(played.phase, "result");
  assert.equal(played.game.history.length, 1);
  assert.equal(played.game.history[0].botMove, pick);
  assert.equal(played.game.history[0].humanMove, "S");
});

// one full round: the host picks the recommended move, then the guest throws
function playOne(flow, humanMove) {
  return throwMove(pickMove(flow, flow.game.decision.move), humanMove);
}

// the human move that beats the bot's recommended move this round, read from A
function winningThrow(flow) {
  const { bot, decision } = flow.game;
  const b = bot.moves.indexOf(decision.move);
  return bot.moves[bot.payoff.A[b].indexOf(-1)];
}

function otherMove(move) {
  return ["R", "P", "S"].find((m) => m !== move);
}

function code(fn) {
  try {
    fn();
  } catch (e) {
    return e.code;
  }
  return "no error";
}

test("wrong pick and unknown moves", () => {
  const start = newFlow(BOT, 3);
  assert.equal(code(() => pickMove(start, otherMove(start.game.decision.move))), "wrong");
  assert.equal(code(() => pickMove(start, "X")), "move");
  assert.equal(code(() => throwMove(start, "X")), "move");
  assert.equal(code(() => throwMove(start, "r")), "move");
});

test("calls outside their phase", () => {
  const start = newFlow(BOT, 3);
  const pick = start.game.decision.move;
  // a second throw in one round, before and after the pick
  assert.equal(code(() => throwMove(throwMove(start, "R"), "P")), "phase");
  // pick outside "think": in "reveal" and in "result"
  const picked = pickMove(start, pick);
  assert.equal(code(() => pickMove(picked, pick)), "phase");
  const result = throwMove(picked, "R");
  assert.equal(code(() => pickMove(result, pick)), "phase");
  // throw in "result"
  assert.equal(code(() => throwMove(result, "R")), "phase");
  // next outside "result"
  assert.equal(code(() => nextRound(start)), "phase");
  assert.equal(code(() => nextRound(picked)), "phase");
  // next once the match is won
  let flow = start;
  flow = nextRound(playOne(flow, winningThrow(flow)));
  flow = playOne(flow, winningThrow(flow));
  assert.equal(flow.game.winner, "human");
  assert.equal(code(() => nextRound(flow)), "phase");
});

test("nextRound after a non-final result", () => {
  const result = playOne(newFlow(BOT, 3), "R");
  assert.equal(result.game.winner, null);
  const next = nextRound(result);
  assert.equal(next.phase, "think");
  assert.equal(next.pick, null);
  assert.equal(next.thrown, null);
  assert.equal(next.game, result.game);
});

function isDeepFrozen(flow) {
  return Object.isFrozen(flow) && Object.isFrozen(flow.game) && Object.isFrozen(flow.game.history);
}

test("every function leaves its input unchanged and returns a frozen Flow", () => {
  const start = newFlow(BOT, 3);
  assert.ok(isDeepFrozen(start));
  const pick = start.game.decision.move;
  const steps = [
    [start, (f) => pickMove(f, pick)],
    [start, (f) => throwMove(f, "P")],
    [pickMove(start, pick), (f) => throwMove(f, "P")],
    [throwMove(start, "P"), (f) => pickMove(f, pick)],
    [playOne(start, "P"), nextRound],
  ];
  for (const [input, step] of steps) {
    const before = structuredClone({ ...input, game: { ...input.game, bot: null } });
    const output = step(input);
    assert.notEqual(output, input);
    assert.ok(isDeepFrozen(output));
    assert.deepEqual({ ...input, game: { ...input.game, bot: null } }, before);
  }
});

const PLAYER_KEYS = ["bestOf", "last", "opponent", "phase", "round", "tally", "target", "thrown", "winner"];

test("playerView keys and phases", () => {
  const start = newFlow(BOT, 3);
  const pick = start.game.decision.move;
  const cases = [
    [start, "open", null],
    [pickMove(start, pick), "open", null],
    [throwMove(start, "R"), "locked", "R"],
    [playOne(start, "R"), "result", "R"],
    [nextRound(playOne(start, "R")), "open", null],
  ];
  for (const [flow, phase, thrown] of cases) {
    const view = playerView(flow);
    assert.deepEqual(Object.keys(view).sort(), PLAYER_KEYS);
    assert.equal(view.phase, phase);
    assert.equal(view.thrown, thrown);
    assert.equal(view.bestOf, 3);
    assert.equal(view.target, 2);
    assert.equal(view.round, flow.game.round);
    assert.deepEqual(view.tally, flow.game.tally);
    assert.equal(view.winner, null);
    assert.equal(view.opponent, null);
  }
});

test("playerView last round", () => {
  const start = newFlow(BOT, 3);
  assert.equal(playerView(start).last, null);
  assert.equal(playerView(throwMove(start, "R")).last, null);
  const result = playOne(start, "R");
  const round = result.game.history[0];
  const expected = { round: 1, botMove: start.game.decision.move, humanMove: "R", outcome: round.outcome };
  assert.deepEqual(playerView(result).last, expected);
  // still the last played round once the next one opens
  assert.deepEqual(playerView(nextRound(result)).last, expected);
});

test("playerView in reveal holds none of the decision's numbers", () => {
  const start = newFlow(BOT, 3);
  const { q, scores } = start.game.decision;
  const text = JSON.stringify(playerView(pickMove(start, start.game.decision.move)));
  for (const v of [...q, ...scores]) assert.ok(!text.includes(String(v)), `found ${v}`);
});

test("hostView", () => {
  const start = newFlow(BOT, 3);
  const thrown = throwMove(start, "R");
  const view = hostView(thrown);
  assert.equal(view.phase, "think");
  assert.equal(view.pick, null);
  assert.equal(view.thrown, true);
  assert.equal(hostView(start).thrown, false);
  assert.ok(!("bot" in view.game));
  const { bot, ...rest } = thrown.game;
  assert.deepEqual(view.game, rest);
});
