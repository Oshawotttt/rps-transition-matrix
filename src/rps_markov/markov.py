"""k-Markov transition matrices over (move, outcome) histories of human RPS players."""
import argparse
import itertools
from pathlib import Path

import numpy as np
import pandas as pd

MOVES: list[str] = ["R", "P", "S"]
OUTCOMES: dict[str, str] = {"win": "W", "lose": "L", "tie": "T"}
TOKENS: list[str] = [m + o for m in MOVES for o in OUTCOMES.values()]
REQUIRED_COLUMNS = ["player_id", "round", "move", "outcome"]


def state_labels(k: int) -> list[str]:
    """All 9**k k-state labels: tokens joined by "-", oldest first."""
    return ["-".join(p) for p in itertools.product(TOKENS, repeat=k)]


def load_rounds(path: str | Path) -> pd.DataFrame:
    """Read a CSV in the master format; raise ValueError if a required column is missing."""
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{path}: missing columns {missing}")
    return df


def add_history(df: pd.DataFrame, k: int) -> pd.DataFrame:
    """Copy of df with column "state" (the player's last k tokens), keeping only rows with k gap-free prior rounds."""
    out = df.reset_index(drop=True)
    ordered = out.sort_values(["player_id", "round"])
    by_player = ordered.groupby("player_id")
    token = ordered["move"] + ordered["outcome"].map(OUTCOMES)
    has_history = pd.Series(True, index=ordered.index)
    state = None
    for lag in range(k, 0, -1):  # oldest first
        has_history &= by_player["round"].shift(lag) == ordered["round"] - lag
        lagged = token.groupby(ordered["player_id"]).shift(lag)
        state = lagged if state is None else state + "-" + lagged
    out = out.assign(state=state)
    return out[has_history.reindex(out.index)]


class TransitionMatrix:
    """Counts of next move given the last k (move, outcome) tokens; P is column-stochastic, 3 x 9**k."""

    def __init__(self, k: int = 3, alpha: float = 1.0) -> None:
        self.k = k
        self.alpha = alpha
        self.states = state_labels(k)
        self._index = {s: j for j, s in enumerate(self.states)}
        self.counts = np.zeros((len(MOVES), len(self.states)), dtype=int)

    def fit(self, df: pd.DataFrame) -> "TransitionMatrix":
        """Replace counts with the transitions in every row of df that has a k-history."""
        hist = add_history(df, self.k)
        rows = pd.Categorical(hist["move"], categories=MOVES).codes
        cols = pd.Categorical(hist["state"], categories=self.states).codes
        if (rows < 0).any() or (cols < 0).any():
            raise ValueError("moves must be R/P/S and outcomes win/lose/tie")
        self.counts = np.zeros_like(self.counts)
        np.add.at(self.counts, (rows, cols), 1)
        return self

    @property
    def P(self) -> np.ndarray:
        """Smoothed probabilities: rows = next move, columns = states; each column sums to 1."""
        smoothed = self.counts + self.alpha
        return smoothed / smoothed.sum(axis=0)

    def _labelled(self, values: np.ndarray) -> pd.DataFrame:
        return pd.DataFrame(values, index=MOVES, columns=self.states)

    def to_frame(self) -> pd.DataFrame:
        return self._labelled(self.P)

    def column(self, state: str) -> np.ndarray:
        """P @ e_j for the state's column j; KeyError on an unknown label."""
        return self.P[:, self._index[state]]

    def predict(self, x: np.ndarray) -> np.ndarray:
        """P @ x for a belief x over the 9**k states."""
        return self.P @ np.asarray(x)

    @classmethod
    def from_csv(cls, path: str | Path, k: int = 3, alpha: float = 1.0) -> "TransitionMatrix":
        """Fit on every row of a master-format CSV."""
        return cls(k, alpha).fit(load_rounds(path))

    def save(self, path: str | Path) -> None:
        """Write counts: rows R, P, S; first column "move", then one column per state."""
        self._labelled(self.counts).to_csv(path, index_label="move")

    @classmethod
    def load(cls, path: str | Path, alpha: float = 1.0) -> "TransitionMatrix":
        """Read a counts CSV written by save; k comes from the state label length."""
        df = pd.read_csv(path, index_col="move")
        tm = cls(len(df.columns[0].split("-")), alpha)
        tm.counts = df.loc[MOVES, tm.states].to_numpy(dtype=int)
        return tm


def main(argv: list[str] | None = None) -> None:
    """Write N_<name>.csv (counts) and P_<name>.csv (probabilities) for each input <name>.csv."""
    parser = argparse.ArgumentParser(prog="python -m rps_markov.markov", description=main.__doc__)
    parser.add_argument("--csv", nargs="+", required=True, type=Path, help="master-format CSV files")
    parser.add_argument("--out", required=True, type=Path, help="output folder")
    parser.add_argument("--k", type=int, default=3)
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)
    for path in args.csv:
        tm = TransitionMatrix.from_csv(path, k=args.k)
        tm.save(args.out / f"N_{path.stem}.csv")
        tm.to_frame().to_csv(args.out / f"P_{path.stem}.csv", index_label="move")


if __name__ == "__main__":
    main()
