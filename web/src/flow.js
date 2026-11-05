// One round's steps over a Game: the host picks the bot's move, the guest throws, the round plays, then next.
// No DOM, React or Node built-ins, so the relay server and the browser both run it.

import { newGame, playRound } from "./game.js";

function freezeFlow(flow) {
  return Object.freeze(flow);
}

// A new match in phase "think", before round 1.
export function newFlow(bot, bestOf) {
  return freezeFlow({ game: newGame(bot, bestOf), phase: "think", pick: null, thrown: null });
}

// An Error whose `code` is "move", "phase" or "wrong", so callers can tell bad input from a bad moment.
function flowError(code, message) {
  return Object.assign(new Error(message), { code });
}

function checkMove(flow, move) {
  if (!flow.game.bot.moves.includes(move)) throw flowError("move", `unknown move: ${move}`);
}

function checkPhase(flow, ok, action) {
  if (!ok) throw flowError("phase", `cannot ${action} in phase ${flow.phase}`);
}

// Plays the round once both the pick and the throw are in; otherwise keeps waiting.
function settle(flow) {
  if (flow.pick !== null && flow.thrown !== null) {
    return freezeFlow({ ...flow, game: playRound(flow.game, flow.thrown, flow.pick), phase: "result" });
  }
  return freezeFlow({ ...flow, phase: flow.pick !== null ? "reveal" : "think" });
}

// The host picks the bot's move; only the recommended move is accepted.
export function pickMove(flow, move) {
  checkMove(flow, move);
  checkPhase(flow, flow.phase === "think", "pick");
  if (move !== flow.game.decision.move) {
    throw flowError("wrong", `pick ${move} is not the recommended move ${flow.game.decision.move}`);
  }
  return settle({ ...flow, pick: move });
}

// The human's move, from the guest or the host's fallback; one throw per round, before or after the pick.
export function throwMove(flow, move) {
  checkMove(flow, move);
  checkPhase(flow, (flow.phase === "think" || flow.phase === "reveal") && flow.thrown === null, "throw");
  return settle({ ...flow, thrown: move });
}

// After a result, the next round starts fresh; refused once the match has a winner.
export function nextRound(flow) {
  checkPhase(flow, flow.phase === "result" && flow.game.winner === null, "start the next round");
  return freezeFlow({ ...flow, phase: "think", pick: null, thrown: null });
}

// What the projector gets: the whole game but the bot JSON, and only whether the guest has thrown.
export function hostView(flow) {
  const { bot, ...game } = flow.game;
  return { phase: flow.phase, pick: flow.pick, thrown: flow.thrown !== null, game };
}

// What the guest gets: never the decision, the pick, the history or any bot matrix.
export function playerView(flow) {
  const { game } = flow;
  let phase = "open";
  if (flow.phase === "result") phase = "result";
  else if (flow.thrown !== null) phase = "locked";
  const played = game.history.at(-1);
  const last = played
    ? { round: played.round, botMove: played.botMove, humanMove: played.humanMove, outcome: played.outcome }
    : null;
  return {
    phase, thrown: flow.thrown, bestOf: game.bestOf, target: game.target, round: game.round,
    tally: game.tally, winner: game.winner, opponent: game.bot.opponent, last,
  };
}
