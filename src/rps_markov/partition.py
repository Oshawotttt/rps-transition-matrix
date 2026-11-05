"""Split the master table into train/test partitions by player."""
import math
from pathlib import Path

import numpy as np
import pandas as pd

DATASETS = ["brockbank", "wxz"]
SPLITS = ["train", "test"]


def partition(df: pd.DataFrame, test_share: float = 0.2, seed: int = 103) -> dict[str, pd.DataFrame]:
    """Return train/test copies of df per dataset and pooled; each player goes wholly to one split."""
    rng = np.random.default_rng(seed)
    parts = {}
    for name in DATASETS:
        rows = df[df["dataset"] == name]
        players = np.sort(rows["player_id"].unique())
        n_test = math.floor(test_share * len(players))
        test_players = rng.choice(players, size=n_test, replace=False)
        is_test = rows["player_id"].isin(test_players)
        parts[f"train_{name}"] = rows[~is_test].reset_index(drop=True)
        parts[f"test_{name}"] = rows[is_test].reset_index(drop=True)
    for split in SPLITS:
        parts[f"{split}_pooled"] = pd.concat([parts[f"{split}_{name}"] for name in DATASETS], ignore_index=True)
    return parts


def write_partitions(master: str | Path, out_dir: str | Path, test_share: float = 0.2, seed: int = 103) -> None:
    """Read the master CSV and write <key>.csv for each partition into out_dir."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(master)
    for key, part in partition(df, test_share, seed).items():
        part.to_csv(out_dir / f"{key}.csv", index=False)


# one human per demo bot: partition name -> player_id; why each was picked is in README.md, "Single-human bots"
DEMO_HUMANS: dict[str, str] = {
    "human_stubborn": "wxz_2",
    "human_cycler": "1e58af30-db85-4e8f-96c9-de55c627c35a",
    "human_wsls": "b068ac38-b969-454e-ad65-28fc739e7600",
    "human_doubler": "wxz_48",
}


def player_rounds(df: pd.DataFrame, player_id: str) -> pd.DataFrame:
    """Copy of every row of one player, in master order; KeyError if the player has no rows."""
    rows = df[df["player_id"] == player_id]
    if rows.empty:
        raise KeyError(player_id)
    return rows.reset_index(drop=True)


def write_players(master: str | Path, out_dir: str | Path, players: dict[str, str] = DEMO_HUMANS) -> None:
    """Read the master CSV and write <name>.csv into out_dir with the rows of each player in players (name -> player_id)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(master)
    for name, player_id in players.items():
        player_rounds(df, player_id).to_csv(out_dir / f"{name}.csv", index=False)
