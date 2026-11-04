import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_BOT_URL, loadBot, newGame, outcomeOf, playRound, validateBot } from "../src/game.js";

const MOVES = ["R", "P", "S"];
const TOKENS = ["RW", "RL", "RT", "PW", "PL", "PT", "SW", "SL", "ST"];

// a decision whose move and scores differ per index, so a test can tell which one was used
function decision(state, move, scores) {
  const expected = scores[MOVES.indexOf(move)];
  return { state, x: [], q: [0.2, 0.3, 0.5], scores, move, source: state ? "state" : "match",
           counter_move: move, splits: [], expected_score: expected };
}

function handBot() {
  const decisions = {};
  TOKENS.forEach((t, j) => {
    const scores = [j / 100, (j + 1) / 100 + 0.5, -j / 100];
    decisions[t] = decision(t, MOVES[j % 3], scores);
  });
  return {
    tokens: [...TOKENS],
    moves: [...MOVES],
    payoff: { A: [[0, -1, 1], [1, 0, -1], [-1, 1, 0]] },
    opening: decision(null, "P", [0.1, 0.2, -0.3]),
    decisions,
  };
}

test("outcomeOf covers all pairs", () => {
  // PRESENTATION-FLOW 2.4: rows bot move, columns human move, entry the bot's score
  const table = { R: { R: 0, P: -1, S: 1 }, P: { R: 1, P: 0, S: -1 }, S: { R: -1, P: 1, S: 0 } };
  const human = { 1: ["lose", "L"], 0: ["tie", "T"], "-1": ["win", "W"] };
  const bot = handBot();
  for (const b of MOVES) {
    for (const h of MOVES) {
      const score = table[b][h];
      assert.deepEqual(outcomeOf(bot, b, h),
        { botScore: score, outcome: human[score][0], token: h + human[score][1] }, `${b} vs ${h}`);
    }
  }
  assert.deepEqual(outcomeOf(bot, "P", "R"), { botScore: 1, outcome: "lose", token: "RL" });
});

test("unknown move throws", () => {
  const bot = handBot();
  assert.throws(() => outcomeOf(bot, "X", "R"), Error);
  assert.throws(() => outcomeOf(bot, "R", "r"), Error);
  const game = newGame(bot, 3);
  assert.throws(() => playRound(game, "X", "P"), Error);
  assert.throws(() => playRound(game, "R", "X"), Error);
});

test("newGame", () => {
  const bot = handBot();
  const game = newGame(bot, 3);
  assert.equal(game.bot, bot);
  assert.equal(game.bestOf, 3);
  assert.equal(game.target, 2);
  assert.equal(game.round, 1);
  assert.equal(game.state, null);
  assert.equal(game.decision, bot.opening);
  assert.deepEqual(game.history, []);
  assert.deepEqual(game.tally, { win: 0, lose: 0, tie: 0 });
  assert.equal(game.winner, null);
  assert.equal(game.expectedTotal, 0);
  assert.equal(game.actualTotal, 0);
  assert.equal(newGame(bot, 5).target, 3);
  assert.throws(() => newGame(bot, 4), Error);
});

test("playRound uses the token for the next decision", () => {
  const bot = handBot();
  const game = playRound(newGame(bot, 3), "R", "P");
  assert.equal(game.state, "RL");
  assert.equal(game.decision, bot.decisions.RL);
  assert.equal(game.round, 2);
  assert.equal(game.history.length, 1);
  const round = game.history[0];
  assert.equal(round.decision, bot.opening);
  assert.deepEqual({ ...round, decision: null }, {
    round: 1, decision: null, botMove: "P", recommendedMove: "P", recommended: true, humanMove: "R",
    botScore: 1, outcome: "lose", token: "RL", expectedScore: 0.2, recommendedExpectedScore: 0.2,
    expectedTotal: 0.2, actualTotal: 1,
  });
  assert.deepEqual(game.tally, { win: 0, lose: 1, tie: 0 });
  assert.equal(game.expectedTotal, 0.2);
  assert.equal(game.actualTotal, 1);
  assert.equal(game.winner, null);
  assert.equal(game.bot, bot);
  assert.equal(game.bestOf, 3);
  assert.equal(game.target, 2);
});

test("chosen move versus recommended move", () => {
  const bot = handBot();
  const followed = playRound(newGame(bot, 3), "S", "P").history[0];
  assert.equal(followed.recommended, true);
  assert.equal(followed.expectedScore, followed.recommendedExpectedScore);
  assert.equal(followed.expectedScore, 0.2);

  // the opening recommends P (score 0.2); the frontend plays R (score 0.1) instead
  const chosen = playRound(newGame(bot, 3), "S", "R");
  const round = chosen.history[0];
  assert.equal(round.recommended, false);
  assert.equal(round.botMove, "R");
  assert.equal(round.recommendedMove, "P");
  assert.equal(round.botScore, 1);
  assert.equal(round.outcome, "lose");
  assert.equal(round.token, "SL");
  assert.equal(round.expectedScore, 0.1);
  assert.equal(round.recommendedExpectedScore, 0.2);
  assert.equal(chosen.state, "SL");
  assert.equal(chosen.decision, bot.decisions.SL);
});

// plays [humanMove, botMove] pairs from a new game
function play(bot, bestOf, rounds) {
  return rounds.reduce((game, [human, chosen]) => playRound(game, human, chosen), newGame(bot, bestOf));
}

test("totals are running sums", () => {
  const game = play(handBot(), 5, [["R", "R"], ["R", "P"], ["P", "R"], ["S", "S"]]);
  // expected scores per round: opening R 0.1, RT P 0.53, RL R 0.01, PW S -0.03
  const scores = [0.1, 0.53, 0.01, -0.03];
  assert.deepEqual(game.history.map((r) => r.outcome), ["tie", "lose", "win", "tie"]);
  assert.deepEqual(game.history.map((r) => r.expectedScore), scores);
  assert.deepEqual(game.history.map((r) => r.botScore), [0, 1, -1, 0]);
  assert.deepEqual(game.tally, { win: 1, lose: 1, tie: 2 });
  let expected = 0;
  let actual = 0;
  game.history.forEach((r, k) => {
    expected += scores[k];
    actual += r.botScore;
    assert.ok(Math.abs(r.expectedTotal - expected) < 1e-12, `round ${k + 1}`);
    assert.equal(r.actualTotal, actual);
    assert.equal(r.round, k + 1);
  });
  assert.ok(Math.abs(game.expectedTotal - 0.61) < 1e-12);
  assert.equal(game.actualTotal, 0);
  assert.equal(game.round, 5);
});

test("match ends at target", () => {
  const bot = handBot();
  // ties don't count
  assert.equal(play(bot, 3, [["R", "R"], ["P", "P"], ["S", "S"]]).winner, null);

  const botOnce = play(bot, 3, [["R", "P"], ["R", "R"]]);
  assert.equal(botOnce.winner, null);
  const botWins = playRound(botOnce, "S", "R");
  assert.equal(botWins.winner, "bot");
  assert.throws(() => playRound(botWins, "R", "R"), Error);

  const humanOnce = play(bot, 3, [["P", "R"], ["R", "P"]]);
  assert.equal(humanOnce.winner, null);
  const humanWins = playRound(humanOnce, "S", "P");
  assert.equal(humanWins.winner, "human");
  assert.deepEqual(humanWins.tally, { win: 2, lose: 1, tie: 0 });
  assert.throws(() => playRound(humanWins, "R", "R"), Error);

  const twoEach = play(bot, 5, [["P", "R"], ["P", "R"], ["R", "P"], ["R", "P"]]);
  assert.equal(twoEach.winner, null);
  assert.equal(playRound(twoEach, "P", "R").winner, "human");
  assert.equal(playRound(twoEach, "R", "P").winner, "bot");
});

test("playRound is immutable", () => {
  const bot = handBot();
  const before = playRound(newGame(bot, 3), "R", "P");
  const snapshot = JSON.stringify(before);
  const after = playRound(before, "P", "P");

  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(before.history.length, 1);
  assert.notEqual(after, before);
  assert.ok(Object.isFrozen(after));
  assert.ok(Object.isFrozen(after.history));
  assert.ok(after.history.every((r) => Object.isFrozen(r)));
  assert.ok(Object.isFrozen(newGame(bot, 3)));
  assert.ok(!Object.isFrozen(bot));
});

test("validateBot rejects bad shapes", () => {
  const good = handBot();
  assert.equal(validateBot(good), good);

  // [the key the message must name, how to break the bot]
  const cases = [
    ["moves", (b) => { b.moves = ["P", "R", "S"]; }],
    ["moves", (b) => { delete b.moves; }],
    ["tokens", (b) => { b.tokens = [...TOKENS].reverse(); }],
    ["tokens", (b) => { b.tokens = TOKENS.slice(0, 8); }],
    ["payoff.A", (b) => { delete b.payoff; }],
    ["payoff.A", (b) => { b.payoff.A = b.payoff.A.slice(0, 2); }],
    ["payoff.A", (b) => { b.payoff.A[1] = [1, 0]; }],
    ["payoff.A", (b) => { b.payoff.A[2][0] = "-1"; }],
    ["payoff.A", (b) => { b.payoff.A[0][0] = 0.5; }],
    ["payoff.A", (b) => { b.payoff.A[0][0] = Infinity; }],
    ["opening", (b) => { delete b.opening; }],
    ["opening", (b) => { b.opening = []; }],
    ["opening.move", (b) => { b.opening.move = "X"; }],
    ["opening.scores", (b) => { b.opening.scores = [0, 0]; }],
    ["opening.scores", (b) => { b.opening.scores = ["a", "b", "c"]; }],
    ["opening.q", (b) => { delete b.opening.q; }],
    ["opening.expected_score", (b) => { b.opening.expected_score = "0.2"; }],
    ["opening.expected_score", (b) => { b.opening.expected_score = NaN; }],
    ["decisions", (b) => { delete b.decisions; }],
    ["decisions", (b) => { b.decisions = []; }],
    ["decisions.ST", (b) => { delete b.decisions.ST; }],
    ["decisions.PL.move", (b) => { delete b.decisions.PL.move; }],
    ["decisions.RW.scores", (b) => { b.decisions.RW.scores = [0, 0, 0, 0]; }],
    ["decisions.SW.q", (b) => { b.decisions.SW.q = [1]; }],
    ["decisions.SW.q", (b) => { b.decisions.SW.q = [0.2, null, 0.5]; }],
    ["decisions.RT.expected_score", (b) => { b.decisions.RT.expected_score = null; }],
  ];
  for (const [key, breakIt] of cases) {
    const bot = handBot();
    breakIt(bot);
    assert.throws(() => validateBot(bot), { name: "Error", message: `bad bot JSON: ${key}` }, key);
  }
  for (const data of [null, [], "bot"]) {
    assert.throws(() => validateBot(data), { name: "Error", message: "bad bot JSON: (root)" }, String(data));
  }
});

test("loadBot", async () => {
  const bot = handBot();
  const calls = [];
  const stub = (body, init = { ok: true, status: 200 }) => async (url) => {
    calls.push(url);
    return { ...init, json: async () => body };
  };

  assert.deepEqual(await loadBot("bots/a.json", stub(bot)), bot);
  assert.equal(calls.at(-1), "bots/a.json");

  await assert.rejects(loadBot("bots/missing.json", stub(null, { ok: false, status: 404 })),
    (err) => err instanceof Error && err.message.includes("404"));

  await loadBot(undefined, stub(bot));
  assert.equal(calls.at(-1), DEFAULT_BOT_URL);
  assert.equal(DEFAULT_BOT_URL, "bots/bot_rps_human_combined.json");

  const broken = handBot();
  delete broken.opening;
  await assert.rejects(loadBot("bots/a.json", stub(broken)), /opening/);
});
