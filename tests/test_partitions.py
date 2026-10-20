import hashlib

import pandas as pd
import pytest

from rps_markov.partition import partition, write_partitions

COLUMNS = ["dataset", "game_id", "player_id", "round", "move", "opp_move",
           "outcome", "prev_move", "prev_opp_move", "prev_outcome"]
KEYS = ["train_brockbank", "test_brockbank", "train_wxz", "test_wxz", "train_pooled", "test_pooled"]


def make_master(n_brockbank=10, n_wxz=7, n_rounds=3):
    rows = []
    for dataset, n_players in [("brockbank", n_brockbank), ("wxz", n_wxz)]:
        for p in range(n_players):
            player = f"{dataset}_p{p}"
            for r in range(1, n_rounds + 1):
                rows.append([dataset, f"{dataset}_g{p // 2}", player, r, "R", "P", "lose",
                             None if r == 1 else "R", None if r == 1 else "P", None if r == 1 else "lose"])
    return pd.DataFrame(rows, columns=COLUMNS)


@pytest.fixture
def master():
    return make_master()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_master_unchanged(tmp_path, master):
    path = tmp_path / "master.csv"
    master.to_csv(path, index=False)
    before = sha256(path)

    write_partitions(path, tmp_path / "partitions")

    assert sha256(path) == before
    assert sorted(p.name for p in (tmp_path / "partitions").iterdir()) == sorted(f"{k}.csv" for k in KEYS)


def row_keys(df):
    return set(zip(df["player_id"], df["round"]))


@pytest.mark.parametrize("dataset", ["brockbank", "wxz"])
def test_partition_exact_cover(master, dataset):
    parts = partition(master)
    train, test = row_keys(parts[f"train_{dataset}"]), row_keys(parts[f"test_{dataset}"])

    assert train | test == row_keys(master[master["dataset"] == dataset])
    assert train & test == set()


@pytest.mark.parametrize("split", ["train", "test"])
def test_pooled_is_union(master, split):
    parts = partition(master)
    expected = pd.concat([parts[f"{split}_brockbank"], parts[f"{split}_wxz"]], ignore_index=True)

    pd.testing.assert_frame_equal(parts[f"{split}_pooled"], expected)


@pytest.mark.parametrize("dataset", ["brockbank", "wxz", "pooled"])
def test_partition_by_player(master, dataset):
    parts = partition(master)

    assert set(parts[f"train_{dataset}"]["player_id"]) & set(parts[f"test_{dataset}"]["player_id"]) == set()


def test_partition_share(master):
    parts = partition(master)

    # 10 brockbank players -> floor(2.0) = 2; 7 wxz players -> floor(1.4) = 1
    assert parts["test_brockbank"]["player_id"].nunique() == 2
    assert parts["test_wxz"]["player_id"].nunique() == 1


def test_partition_deterministic(master):
    first, second = partition(master), partition(master)

    for key in KEYS:
        pd.testing.assert_frame_equal(first[key], second[key])


def test_partition_columns(master):
    parts = partition(master)

    assert sorted(parts) == sorted(KEYS)
    for part in parts.values():
        assert list(part.columns) == COLUMNS
