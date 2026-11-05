"""Counts N and the transition matrices built from it, all over k = 1 (move, outcome) states."""
import math
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


# how close an eigenvalue or modulus must be to 1 to count as 1
EIGEN_TOL = 1e-9


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
    def moduli(self) -> np.ndarray:
        """The modulus of each eigenvalue, in the same order."""
        return np.abs(self.eigenvalues)

    @cached_property
    def eigenvalue_one_multiplicity(self) -> int:
        """How many eigenvalues are within 1e-9 of 1."""
        return int(np.sum(np.abs(self.eigenvalues - 1) < EIGEN_TOL))

    @cached_property
    def has_unit_cycle(self) -> bool:
        """Some eigenvalue has modulus 1 but is not 1 (within 1e-9), so the chain cycles and never settles."""
        on_circle = np.abs(self.moduli - 1) < EIGEN_TOL
        return bool(np.any(on_circle & (np.abs(self.eigenvalues - 1) >= EIGEN_TOL)))

    @cached_property
    def stationary(self) -> np.ndarray:
        """Steady state pi: the eigenvalue-1 eigenvector, real, summing to 1; ValueError if eigenvalue 1 is repeated."""
        if self.eigenvalue_one_multiplicity > 1:
            raise ValueError(f"eigenvalue 1 has multiplicity {self.eigenvalue_one_multiplicity}, "
                             "so the steady state is not unique")
        return _eigenvalue_one_vector(*self._eig)

    @cached_property
    def eigenvectors(self) -> np.ndarray | None:
        """Eigenvectors as columns, same order as eigenvalues; None when P is not diagonalisable (within 1e-9).

        An eigenvector for eigenvalue 1 is real; when its entries do not sum to 0 it is scaled to sum to 1, so the first
        is pi when pi is unique. Every other one is scaled to length 1 with its largest entry real and positive, which
        fixes NumPy's free sign (for eigenvalues other than 1 the entries always sum to 0).
        """
        eigenvalues, vectors = self._eig
        if np.linalg.cond(vectors) > 1 / EIGEN_TOL:
            return None
        out = np.empty_like(vectors, dtype=complex)
        for k, value in enumerate(eigenvalues):
            v = vectors[:, k].astype(complex)
            if abs(value - 1) < EIGEN_TOL and abs(np.real(v).sum()) > EIGEN_TOL:
                v = np.real(v) / np.real(v).sum()
            else:
                big = v[np.argmax(np.abs(v))]
                v = v / np.linalg.norm(v) * (abs(big) / big)
            out[:, k] = v
        return out

    def coefficients(self, x: np.ndarray) -> np.ndarray | None:
        """c with x = sum of c_k v_k over the eigenvectors (columns of eigenvectors); None when there are none.

        Then P^t x = sum of c_k lambda_k^t v_k; c_1 = 1 for any x summing to 1 when pi is unique.
        """
        if self.eigenvectors is None:
            return None
        return np.linalg.solve(self.eigenvectors, np.asarray(x, dtype=complex))

    def look_ahead(self, x: np.ndarray, tol: float = 0.01, max_steps: int = 100) -> np.ndarray:
        """Rows x, P x, P^2 x, ...; stops at the first row whose summed absolute change from the last is below tol, or at max_steps."""
        rows = [np.asarray(x, dtype=float)]
        for _ in range(max_steps):
            rows.append(self.P @ rows[-1])
            if np.abs(rows[-1] - rows[-2]).sum() < tol:
                break
        return np.array(rows)

    def rounds_to_fade(self, fraction: float = 0.1) -> int | None:
        """Smallest t with |lambda_2|^t < fraction; 0 when lambda_2 = 0; None when |lambda_2| is 1 (within 1e-9)."""
        modulus = self.moduli[1]
        if modulus >= 1 - EIGEN_TOL:
            return None
        if modulus == 0:
            return 0
        return math.ceil(math.log(fraction) / math.log(modulus))

    @cached_property
    def _reach(self) -> np.ndarray:
        """reach[i, j]: state j can be reached from state i in zero or more steps (from the nonzero pattern of P)."""
        reach = (self.P.T > 0) | np.eye(len(self.states), dtype=bool)
        while True:
            wider = (reach.astype(int) @ reach.astype(int)) > 0
            if (wider == reach).all():
                return reach
            reach = wider

    @cached_property
    def _closed_indices(self) -> list[list[int]]:
        """Index lists of the closed communicating classes, each in state order, sorted by first index."""
        reach = self._reach
        groups = []
        for i in range(len(self.states)):
            group = [j for j in range(len(self.states)) if reach[i, j] and reach[j, i]]
            # closed: every state reachable from i reaches back to i
            if group[0] == i and all(reach[j, i] for j in np.flatnonzero(reach[i])):
                groups.append(group)
        return groups

    @cached_property
    def closed_groups(self) -> list[list[str]]:
        """The closed groups (closed communicating classes): state labels the chain never leaves once in them."""
        return [[self.states[j] for j in group] for group in self._closed_indices]

    @cached_property
    def group_stationary(self) -> list[np.ndarray]:
        """Per closed group, its own steady state over all states: zero outside the group, summing to 1."""
        out = []
        for group in self._closed_indices:
            pi = np.zeros(len(self.states))
            pi[group] = _eigenvalue_one_vector(*np.linalg.eig(self.P[np.ix_(group, group)]))
            out.append(pi)
        return out

    @cached_property
    def transient_states(self) -> list[str]:
        """States in no closed group: the long run never returns to them."""
        closed = {j for group in self._closed_indices for j in group}
        return [s for j, s in enumerate(self.states) if j not in closed]


def _eigenvalue_one_vector(eigenvalues: np.ndarray, eigenvectors: np.ndarray) -> np.ndarray:
    """The real eigenvector for the eigenvalue nearest 1, scaled to sum to 1."""
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
        return _rates(self.stationary)

    @cached_property
    def group_outcome_rates(self) -> list[dict[str, float]]:
        """Per closed group, win, lose and tie rates from its group_stationary, like outcome_rates."""
        return [_rates(pi) for pi in self.group_stationary]

    @cached_property
    def edge(self) -> float:
        """The bot's long-run expected score per round: the human's lose rate minus their win rate."""
        return self.outcome_rates["lose"] - self.outcome_rates["win"]

    @cached_property
    def edge_check(self) -> float:
        """edge computed the other way: the bot's best score in each state, weighted by stationary."""
        human = self.outcome_matrix.P
        best = [self.payoff.scores(human[:, j]).max() for j in range(len(TOKENS))]
        return float(self.stationary @ np.array(best))


def _rates(pi: np.ndarray) -> dict[str, float]:
    """Win, lose and tie rates from the human's side: pi summed over the *W, *L, *T tokens."""
    return {outcome: float(sum(pi[j] for j, t in enumerate(TOKENS) if t.endswith(letter)))
            for outcome, letter in OUTCOMES.items()}
