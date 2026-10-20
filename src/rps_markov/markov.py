"""k-Markov transition matrices over (move, outcome) histories of human RPS players."""
import itertools
from pathlib import Path

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
