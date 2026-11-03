"""PayoffMatrix: the fixed 3 x 3 RPS payoff A and the bot's best move against a predicted human move."""
from functools import cached_property

import numpy as np

from rps_markov.count import MOVES
from rps_markov.matrix import Matrix


class PayoffMatrix(Matrix):
    """A: rows = bot move, columns = human move, both R, P, S; +1 bot wins, 0 tie, -1 bot loses."""

    def __init__(self) -> None:
        self.rows = MOVES
        self.columns = MOVES

    @cached_property
    def values(self) -> np.ndarray:
        return np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]])

    @property
    def A(self) -> np.ndarray:
        """The payoff: the same array as values."""
        return self.values

    def scores(self, q: np.ndarray) -> np.ndarray:
        """A @ q: the bot's expected score for each move against a human move distribution q."""
        return self @ q

    def best_move(self, q: np.ndarray) -> str:
        """The bot move with the highest score against q; the first in R, P, S wins a tie."""
        return self.rows[int(np.argmax(self.scores(q)))]
