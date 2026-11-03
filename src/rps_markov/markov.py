"""Counts N and the transition matrices built from it, all over k = 1 (move, outcome) states."""
from functools import cached_property
from pathlib import Path

import numpy as np
import pandas as pd

from rps_markov.count import MOVES, TOKENS
from rps_markov.matrix import Matrix


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


class TransitionMatrix(Matrix):
    """Column-stochastic P: rows = next move, columns = states."""

    @property
    def states(self) -> list[str]:
        return self.columns

    @property
    def P(self) -> np.ndarray:
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
        smoothed = self._counts + self.alpha
        return smoothed / smoothed.sum(axis=0)


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
        return self._eig[0]

    @cached_property
    def stationary(self) -> np.ndarray:
        """Steady state pi: the eigenvalue-1 eigenvector, real, summing to 1."""
        eigenvalues, eigenvectors = self._eig
        pi = eigenvectors[:, np.argmin(np.abs(eigenvalues - 1))].real
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
        smoothed = self._counts + self.alpha
        return smoothed / smoothed.sum(axis=0)
