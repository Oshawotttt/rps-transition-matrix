"""Bot: one human's matrices and the bot's decision in each round, every panel number computed here; CLI writes it as JSON."""
import argparse
import json
from dataclasses import dataclass, fields
from functools import cached_property
from pathlib import Path

import numpy as np

from rps_markov.count import MOVES, TOKENS
from rps_markov.markov import (BasicTransitionMatrix, BotMatchTransitionMatrix, Counts, OutcomeTransitionMatrix,
                               SquareTransitionMatrix)
from rps_markov.payoff import PayoffMatrix


@dataclass(frozen=True, eq=False)
class Decision:
    """One bot choice with its working: belief x, predicted human move q, scores A q, the move, and panel numbers."""

    state: str | None
    x: np.ndarray
    q: np.ndarray
    scores: np.ndarray
    move: str
    source: str
    counter_move: str
    splits: np.ndarray
    expected_score: float

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Decision):
            return NotImplemented
        return all(np.array_equal(getattr(self, f.name), getattr(other, f.name)) for f in fields(self))

    def to_dict(self) -> dict:
        """The same fields, JSON-safe: arrays as lists of floats, splits as a list of 3 rows."""
        return {"state": self.state, "x": _floats(self.x), "q": _floats(self.q), "scores": _floats(self.scores),
                "move": self.move, "source": self.source, "counter_move": self.counter_move,
                "splits": _floats(self.splits), "expected_score": float(self.expected_score)}


def _floats(a: np.ndarray) -> list:
    """An array as (nested) lists of Python floats."""
    return np.asarray(a, dtype=float).tolist()


def _chain_dict(chain: SquareTransitionMatrix) -> dict:
    """The JSON-safe numbers of a square chain; stationary is None when it is not unique."""
    unique = chain.eigenvalue_one_multiplicity == 1
    return {"P": _floats(chain.P),
            "eigenvalues": [[float(v.real), float(v.imag)] for v in chain.eigenvalues],
            "moduli": _floats(chain.moduli),
            "eigenvalue_one_multiplicity": int(chain.eigenvalue_one_multiplicity),
            "has_unit_cycle": bool(chain.has_unit_cycle),
            "rounds_to_fade": chain.rounds_to_fade(0.1),
            "stationary": _floats(chain.stationary) if unique else None,
            "closed_groups": chain.closed_groups,
            "transient_states": chain.transient_states}


def _decide(payoff: PayoffMatrix, state: str | None, x: np.ndarray, q: np.ndarray, source: str) -> Decision:
    """The Decision for belief x and predicted human move q: scores, best move and panel numbers from payoff."""
    scores = payoff.scores(q)
    move = payoff.best_move(q)
    likely = int(np.argmax(q))
    # rows bot move; columns win, tie, lose from the bot's side: q summed where A[b, m] = +1, 0, -1
    splits = np.array([[q[payoff.A[b] == score].sum() for score in (1, 0, -1)] for b in range(len(MOVES))])
    return Decision(state=state, x=x, q=q, scores=scores, move=move, source=source,
                    counter_move=MOVES[int(np.argmax(payoff.A[:, likely] == 1))], splits=splits,
                    expected_score=float(scores[MOVES.index(move)]))


class Bot:
    """The bot for one human's counts: fixed matrices, no memory between rounds; get_move(s) depends only on s."""

    def __init__(self, counts: Counts, alpha: float = 1.0, name: str | None = None) -> None:
        self._name = name
        # constructing the matrices computes no values; each computes on first access
        self._outcome = OutcomeTransitionMatrix(counts, alpha)
        self._basic = BasicTransitionMatrix(counts, alpha)
        self._payoff = PayoffMatrix()
        self._match = BotMatchTransitionMatrix(self._outcome, self._payoff)

    @property
    def name(self) -> str | None:
        """The opponent's display name, or None when not given."""
        return self._name

    @property
    def outcome(self) -> OutcomeTransitionMatrix:
        """3 x 9 P: next human move given the previous token."""
        return self._outcome

    @property
    def basic(self) -> BasicTransitionMatrix:
        """3 x 3 P: next human move given the previous move."""
        return self._basic

    @property
    def payoff(self) -> PayoffMatrix:
        """A: rows bot move, columns human move."""
        return self._payoff

    @property
    def match(self) -> BotMatchTransitionMatrix:
        """9 x 9 M: the human against this bot."""
        return self._match

    def get_move(self, state: str) -> Decision:
        """The decision after the human's previous token state (human's side, e.g. "RL"); KeyError on an unknown token."""
        q = self.outcome.column(state)
        x = np.zeros(len(TOKENS))
        x[TOKENS.index(state)] = 1
        return _decide(self.payoff, state, x, q, "state")

    @cached_property
    def opening(self) -> Decision:
        """The round-1 decision: q = P pi of the 9 x 9 chain, or the 3 x 3 steady state when that pi is not unique or the chain cycles."""
        if self.match.eigenvalue_one_multiplicity > 1 or self.match.has_unit_cycle:
            pi = self.basic.stationary
            return _decide(self.payoff, None, pi, pi, "basic")
        pi = self.match.stationary
        return _decide(self.payoff, None, pi, self.outcome.predict(pi), "match")

    def to_dict(self) -> dict:
        """Everything the frontend shows for this bot, JSON-safe; see docs/CONTRACTS.md, Bot JSON file."""
        match = self.match
        unique = match.eigenvalue_one_multiplicity == 1
        decisions = {s: self.get_move(s) for s in TOKENS}
        B = np.array([[float(m == decisions[s].move) for s in TOKENS] for m in MOVES])
        look_ahead = {}
        for j, s in enumerate(TOKENS):
            rows = match.look_ahead(np.eye(len(TOKENS))[j])
            look_ahead[s] = {"rows": _floats(rows), "stopped_at": len(rows) - 1}
        return {
            "opponent": self.name,
            "tokens": TOKENS,
            "moves": MOVES,
            "alpha": float(self.outcome.alpha),
            "payoff": {"A": self.payoff.A.astype(int).tolist()},
            "outcome": {"P": _floats(self.outcome.P)},
            "basic": _chain_dict(self.basic),
            "match": {**_chain_dict(match),
                      "outcome_rates": match.outcome_rates if unique else None,
                      "edge": match.edge if unique else None,
                      "edge_check": match.edge_check if unique else None,
                      "group_stationary": [_floats(pi) for pi in match.group_stationary],
                      "group_outcome_rates": match.group_outcome_rates},
            "opening": self.opening.to_dict(),
            "decisions": {s: d.to_dict() for s, d in decisions.items()},
            "policy": {"S": _floats(self.payoff.A @ self.outcome.P), "B": _floats(B)},
            "look_ahead": look_ahead,
        }


def main(argv: list[str] | None = None) -> None:
    """Write the bot JSON file (everything the frontend shows) for one N_<name>.csv."""
    parser = argparse.ArgumentParser(prog="python -m rps_markov.bot", description=main.__doc__,
                                     allow_abbrev=False)
    parser.add_argument("--counts", required=True, type=Path, help="an N_<name>.csv from python -m rps_markov.count")
    parser.add_argument("--out", required=True, type=Path, help="output JSON file")
    parser.add_argument("--alpha", type=float, default=1.0, help="smoothing (default 1.0)")
    parser.add_argument("--name", help="opponent name in the JSON (default <name> from N_<name>.csv)")
    args = parser.parse_args(argv)
    name = args.name if args.name is not None else args.counts.stem.removeprefix("N_")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    bot = Bot(Counts.load(args.counts), args.alpha, name)
    args.out.write_text(json.dumps(bot.to_dict(), allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    main()
