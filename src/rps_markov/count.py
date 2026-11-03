"""Count next move given the previous (move, outcome) token in round CSVs; write N_<name>.csv per input."""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

MOVES: list[str] = ["R", "P", "S"]
OUTCOMES: dict[str, str] = {"win": "W", "lose": "L", "tie": "T"}
TOKENS: list[str] = [m + o for m in MOVES for o in OUTCOMES.values()]
REQUIRED_COLUMNS = ["player_id", "round", "move", "outcome"]


def load_rounds(path: str | Path) -> pd.DataFrame:
    """Read a CSV in the master format; raise ValueError if a required column is missing."""
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{path}: missing columns {missing}")
    return df


def add_history(df: pd.DataFrame) -> pd.DataFrame:
    """Copy of df with column "state" (the player's previous token), keeping only rows whose player has a row at round r - 1."""
    out = df.reset_index(drop=True)
    ordered = out.sort_values(["player_id", "round"])
    by_player = ordered.groupby("player_id")
    token = ordered["move"] + ordered["outcome"].map(OUTCOMES)
    has_history = by_player["round"].shift(1) == ordered["round"] - 1
    out = out.assign(state=token.groupby(ordered["player_id"]).shift(1))
    return out[has_history.reindex(out.index)]


def count(df: pd.DataFrame) -> pd.DataFrame:
    """N: next move (rows R, P, S) against previous token (columns TOKENS) for every row of df with a state."""
    if not (df["move"].isin(MOVES).all() and df["outcome"].isin(list(OUTCOMES)).all()):
        raise ValueError("moves must be R/P/S and outcomes win/lose/tie")
    hist = add_history(df)
    rows = pd.Categorical(hist["move"], categories=MOVES).codes
    cols = pd.Categorical(hist["state"], categories=TOKENS).codes
    counts = np.zeros((len(MOVES), len(TOKENS)), dtype=int)
    np.add.at(counts, (rows, cols), 1)
    return pd.DataFrame(counts, index=pd.Index(MOVES, name="move"), columns=TOKENS)


def main(argv: list[str] | None = None) -> None:
    """Write N_<name>.csv (counts) for each input <name>.csv."""
    parser = argparse.ArgumentParser(prog="python -m rps_markov.count", description=main.__doc__,
                                     allow_abbrev=False)
    parser.add_argument("--csv", nargs="+", required=True, type=Path, help="master-format CSV files")
    parser.add_argument("--out", required=True, type=Path, help="output folder")
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)
    for path in args.csv:
        count(load_rounds(path)).to_csv(args.out / f"N_{path.stem}.csv")


if __name__ == "__main__":
    main()
