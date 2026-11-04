import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { newGame, playRound, validateBot } from "../src/game.js";

// written from Python's Bot.to_dict(); tests/test_bot.py fails when either no longer matches Python
const FILES = {
  fixture: new URL("./fixtures/bot_synthetic.json", import.meta.url),
  "default bot": new URL("../public/bots/bot_rps_human_combined.json", import.meta.url),
};

function read(url) {
  return JSON.parse(readFileSync(url, "utf-8"));
}

// the bot move that gives the human the outcome letter W, L or T against humanMove
function botMoveFor(bot, humanMove, letter) {
  const h = bot.moves.indexOf(humanMove);
  const score = { W: -1, L: 1, T: 0 }[letter];
  return bot.moves[bot.payoff.A.findIndex((row) => row[h] === score)];
}

test("fixture and default bot are valid", () => {
  for (const [name, url] of Object.entries(FILES)) {
    const data = read(url);
    assert.equal(validateBot(data), data, name);
  }
});

test("tokens match the 9 x 9 chain", () => {
  for (const [name, url] of Object.entries(FILES)) {
    const bot = validateBot(read(url));
    for (const [j, t] of bot.tokens.entries()) {
      // round 1 played so that the human's token is t
      const game = playRound(newGame(bot, 5), t[0], botMoveFor(bot, t[0], t[1]));
      assert.equal(game.state, t, `${name} ${t}`);

      const next = bot.moves.map((h) => {
        const after = playRound(game, h, game.decision.move);
        const token = after.history.at(-1).token;
        assert.equal(after.decision, bot.decisions[token], `${name} ${t} ${h}`);
        return token;
      });
      const nonzero = bot.tokens.filter((_, i) => bot.match.P[i][j] !== 0);
      assert.equal(nonzero.length, 3, `${name} column ${t} nonzero entries`);
      assert.deepEqual([...next].sort(), [...nonzero].sort(), `${name} column ${t}`);
    }
  }
});
