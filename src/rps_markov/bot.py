"""Bot: one human's matrices and the bot's decision in each round, every panel number computed here."""
from dataclasses import dataclass, fields
from functools import cached_property

import numpy as np

from rps_markov.count import MOVES, TOKENS
from rps_markov.markov import BasicTransitionMatrix, BotMatchTransitionMatrix, Counts, OutcomeTransitionMatrix
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

    def __init__(self, counts: Counts, alpha: float = 1.0) -> None:
        # constructing the matrices computes no values; each computes on first access
        self._outcome = OutcomeTransitionMatrix(counts, alpha)
        self._basic = BasicTransitionMatrix(counts, alpha)
        self._payoff = PayoffMatrix()
        self._match = BotMatchTransitionMatrix(self._outcome, self._payoff)

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
