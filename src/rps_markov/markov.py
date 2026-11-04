"""Counts N and the transition matrices built from it, all over k = 1 (move, outcome) states."""
from functools import cached_property
from pathlib import Path

import numpy as np
import pandas as pd

from rps_markov.count import MOVES, OUTCOMES, TOKENS
from rps_markov.matrix import Matrix
from rps_markov.payoff import PayoffMatrix


class Counts:
    """N from any N_<name>.csv-shaped frame: rows R, P, S; columns TOKENS; read-only ints."""

    def __init__(self, frame: pd.DataFrame) -> None:
        if list(frame.index) != MOVES:
            raise ValueError(f"rows must be {MOVES}, got {list(frame.index)}")
        if list(frame.columns) != TOKENS:
            raise ValueError(f"columns must be {TOKENS}, got {list(frame.columns)}")
        self.states = TOKENS
        self.values = frame.to_numpy(dtype=int, copy=True)
        self.values.setflags(write=False)

    @classmethod
    def load(cls, path: str | Path) -> "Counts":
        """Read an N_<name>.csv written by python -m rps_markov.count."""
        return cls(pd.read_csv(path, index_col="move"))


def _smoothed(counts: np.ndarray, alpha: float) -> np.ndarray:
    """(counts + alpha) / column sums: column-stochastic, and an all-zero column becomes uniform."""
    shifted = counts + alpha
    return shifted / shifted.sum(axis=0)


class TransitionMatrix(Matrix):
    """Column-stochastic P: rows = next move, columns = states."""

    @property
    def states(self) -> list[str]:
        """The state labels: the same list as columns."""
        return self.columns

    @property
    def P(self) -> np.ndarray:
        """The transition probabilities: the same array as values."""
        return self.values

    def column(self, state: str) -> np.ndarray:
        """P @ e_j for the state's column j; KeyError on an unknown label."""
        if state not in self.states:
            raise KeyError(state)
        return self.P[:, self.states.index(state)]

    def predict(self, x: np.ndarray) -> np.ndarray:
        """P @ x for a belief x over the states."""
        return self.P @ np.asarray(x)


class OutcomeTransitionMatrix(TransitionMatrix):
    """3 x 9: next move given the previous (move, outcome) token; P = (N + alpha) / column sums."""

    def __init__(self, counts: Counts, alpha: float = 1.0) -> None:
        self.rows = MOVES
        self.columns = counts.states
        self.alpha = alpha
        self._counts = counts.values

    @cached_property
    def values(self) -> np.ndarray:
        return _smoothed(self._counts, self.alpha)


class SquareTransitionMatrix(TransitionMatrix):
    """A TransitionMatrix whose rows are its states, so it is a Markov chain with eigenvalues and a steady state."""

    @cached_property
    def _eig(self) -> tuple[np.ndarray, np.ndarray]:
        """Eigenvalues (complex) and eigenvectors, sorted by eigenvalue modulus, largest first."""
        eigenvalues, eigenvectors = np.linalg.eig(self.P)
        order = np.argsort(-np.abs(eigenvalues), kind="stable")
        return eigenvalues[order].astype(complex), eigenvectors[:, order]

    @cached_property
    def eigenvalues(self) -> np.ndarray:
        """Eigenvalues of P, complex, sorted by modulus, largest (1) first."""
        return self._eig[0]

    @cached_property
    def stationary(self) -> np.ndarray:
        """Steady state pi: the eigenvalue-1 eigenvector, real, summing to 1; ValueError if eigenvalue 1 is repeated."""
        eigenvalues, eigenvectors = self._eig
        ones = np.flatnonzero(np.abs(eigenvalues - 1) < 1e-9)
        if len(ones) > 1:
            raise ValueError(f"eigenvalue 1 has multiplicity {len(ones)}, so the steady state is not unique")
        pi = np.real(eigenvectors[:, np.argmin(np.abs(eigenvalues - 1))])
        return pi / pi.sum()


class BasicTransitionMatrix(SquareTransitionMatrix):
    """3 x 3: next move given the previous move; P = (M + alpha) / column sums."""

    def __init__(self, counts: Counts, alpha: float = 1.0) -> None:
        self.rows = MOVES
        self.columns = MOVES
        self.alpha = alpha
        # column m of M = N's columns mW + mL + mT (sum out the previous outcome)
        self._counts = counts.values.reshape(len(MOVES), len(MOVES), -1).sum(axis=2)

    @cached_property
    def values(self) -> np.ndarray:
        return _smoothed(self._counts, self.alpha)


class BotMatchTransitionMatrix(SquareTransitionMatrix):
    """9 x 9 chain over tokens: one human (an OutcomeTransitionMatrix) against the bot that plays best_move in every state."""

    def __init__(self, outcome_matrix: OutcomeTransitionMatrix, payoff: PayoffMatrix) -> None:
        if not isinstance(outcome_matrix, OutcomeTransitionMatrix):
            raise TypeError(f"outcome_matrix must be an OutcomeTransitionMatrix, got {type(outcome_matrix).__name__}")
        self.rows = TOKENS
        self.columns = TOKENS
        self.outcome_matrix = outcome_matrix
        self.payoff = payoff

    @cached_property
    def values(self) -> np.ndarray:
        human = self.outcome_matrix.P
        # human outcome letter by bot score: the bot winning (+1) is the human's L
        letter_by_bot_score = {1: OUTCOMES["lose"], 0: OUTCOMES["tie"], -1: OUTCOMES["win"]}
        P = np.zeros((len(TOKENS), len(TOKENS)))
        for state in range(len(TOKENS)):
            bot = MOVES.index(self.payoff.best_move(human[:, state]))
            for move_index, move in enumerate(MOVES):
                letter = letter_by_bot_score[self.payoff.A[bot, move_index]]
                P[TOKENS.index(move + letter), state] = human[move_index, state]
        return P

    @cached_property
    def outcome_rates(self) -> dict[str, float]:
        """Long-run win, lose and tie rates from the human's side: stationary summed over the *W, *L, *T tokens."""
        pi = self.stationary
        return {outcome: float(sum(pi[j] for j, t in enumerate(TOKENS) if t.endswith(letter)))
                for outcome, letter in OUTCOMES.items()}
