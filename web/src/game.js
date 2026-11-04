// Game logic for the browser: loads the bot JSON and plays one match. No DOM code; the UI only calls it.

// The bot built from all human rounds, relative to the page; Vite serves it from web/public/bots/.
export const DEFAULT_BOT_URL = "bots/bot_rps_human_combined.json";

const MOVES = ["R", "P", "S"];
const TOKENS = ["RW", "RL", "RT", "PW", "PL", "PT", "SW", "SL", "ST"];

// bot score from A -> [outcome, token letter], both from the human's side
const OUTCOMES = { 1: ["lose", "L"], 0: ["tie", "T"], "-1": ["win", "W"] };

function sameList(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((v, k) => v === b[k]);
}

function isNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function check(ok, key) {
  if (!ok) throw new Error(`bad bot JSON: ${key}`);
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isNumbers(v, length) {
  return Array.isArray(v) && v.length === length && v.every(isNumber);
}

function checkDecision(decision, key, moves) {
  check(isObject(decision), key);
  check(moves.includes(decision.move), `${key}.move`);
  check(isNumbers(decision.scores, 3), `${key}.scores`);
  check(isNumbers(decision.q, 3), `${key}.q`);
  check(isNumber(decision.expected_score), `${key}.expected_score`);
}

// Returns data unchanged if it has the shape the game reads; otherwise throws an Error naming the first bad key.
export function validateBot(data) {
  check(isObject(data), "(root)");
  check(sameList(data.moves, MOVES), "moves");
  check(sameList(data.tokens, TOKENS), "tokens");
  const A = data.payoff?.A;
  // every entry is a bot score outcomeOf can read: +1, 0 or -1
  check(Array.isArray(A) && A.length === 3 && A.every((row) => isNumbers(row, 3) && row.every((v) => v in OUTCOMES)),
    "payoff.A");
  checkDecision(data.opening, "opening", data.moves);
  check(isObject(data.decisions), "decisions");
  for (const t of data.tokens) checkDecision(data.decisions[t], `decisions.${t}`, data.moves);
  return data;
}

// Fetches and validates a bot JSON; a non-OK response throws an Error with the status.
export async function loadBot(url = DEFAULT_BOT_URL, fetchFn = fetch) {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`could not load ${url}: HTTP ${response.status}`);
  return validateBot(await response.json());
}

function moveIndex(bot, move) {
  const i = bot.moves.indexOf(move);
  if (i === -1) throw new Error(`unknown move: ${move}`);
  return i;
}

// One round from the bot's move and the human's: the bot's score from A, the outcome and token from the human's side.
export function outcomeOf(bot, botMove, humanMove) {
  const botScore = bot.payoff.A[moveIndex(bot, botMove)][moveIndex(bot, humanMove)];
  const [outcome, letter] = OUTCOMES[botScore];
  return { botScore, outcome, token: humanMove + letter };
}

// A frozen Game; its history array and tally are frozen too, the bot JSON is not.
function freezeGame(game) {
  Object.freeze(game.history);
  Object.freeze(game.tally);
  return Object.freeze(game);
}

// A match of best of 3 or 5 against one loaded bot, before round 1.
export function newGame(bot, bestOf) {
  if (bestOf !== 3 && bestOf !== 5) throw new Error(`bestOf must be 3 or 5, got ${bestOf}`);
  return freezeGame({
    bot, bestOf, target: (bestOf + 1) / 2, round: 1, state: null, decision: bot.opening,
    history: [], tally: { win: 0, lose: 0, tie: 0 }, winner: null, expectedTotal: 0, actualTotal: 0,
  });
}

// Plays one round with the move the frontend chose for the bot; returns a new Game and leaves `game` unchanged.
export function playRound(game, humanMove, botMove) {
  if (game.winner !== null) throw new Error(`the match is over: ${game.winner} won`);
  const { bot, decision } = game;
  const { botScore, outcome, token } = outcomeOf(bot, botMove, humanMove);
  const expectedScore = decision.scores[moveIndex(bot, botMove)];
  const expectedTotal = game.expectedTotal + expectedScore;
  const actualTotal = game.actualTotal + botScore;
  const record = Object.freeze({
    round: game.round, decision, botMove, recommendedMove: decision.move, recommended: botMove === decision.move,
    humanMove, botScore, outcome, token, expectedScore, recommendedExpectedScore: decision.expected_score,
    expectedTotal, actualTotal,
  });
  const tally = { ...game.tally, [outcome]: game.tally[outcome] + 1 };
  let winner = null;
  if (tally.win === game.target) winner = "human";
  else if (tally.lose === game.target) winner = "bot";
  return freezeGame({
    ...game, round: game.round + 1, state: token, decision: bot.decisions[token],
    history: [...game.history, record], tally, winner, expectedTotal, actualTotal,
  });
}
