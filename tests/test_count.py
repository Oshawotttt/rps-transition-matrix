import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from rps_markov.count import MOVES, OUTCOMES, TOKENS, add_history, count, load_rounds

MASTER = Path(__file__).resolve().parents[1] / "data" / "processed" / "rps_human_combined.csv"
PARTITIONS = MASTER.parent / "partitions"
SRC = Path(__file__).resolve().parents[1] / "src"


def test_load_rounds_missing_column(tmp_path):
    path = tmp_path / "no_outcome.csv"
    pd.DataFrame({"player_id": ["a"], "round": [1], "move": ["R"]}).to_csv(path, index=False)

    with pytest.raises(ValueError):
        load_rounds(path)


def rounds(player, plays, round_numbers=None):
    """Rows for one player; plays = [(move, outcome), ...]."""
    round_numbers = round_numbers or list(range(1, len(plays) + 1))
    return pd.DataFrame({
        "player_id": player,
        "round": round_numbers,
        "move": [m for m, _ in plays],
        "outcome": [o for _, o in plays],
    })


BASIC = [("R", "win"), ("P", "lose"), ("S", "tie"), ("R", "win")]


def synthetic_rounds(n_players=4, n_rounds=40, seed=0):
    rng = np.random.default_rng(seed)
    frames = []
    for p in range(n_players):
        moves = rng.choice(MOVES, size=n_rounds)
        outcomes = rng.choice(list(OUTCOMES), size=n_rounds)
        frames.append(rounds(f"p{p}", list(zip(moves, outcomes))))
    return pd.concat(frames, ignore_index=True)


def test_add_history_basic():
    out = add_history(rounds("a", BASIC))

    assert out["round"].tolist() == [2, 3, 4]
    assert out["state"].tolist() == ["RW", "PL", "ST"]


def test_add_history_gap():
    plays = [("R", "win"), ("P", "lose"), ("S", "tie"), ("R", "win"), ("P", "lose")]
    out = add_history(rounds("a", plays, [1, 2, 4, 5, 6]))

    # round 3 is missing: round 4 has no state; rounds 5, 6 use rounds 4, 5
    assert out["round"].tolist() == [2, 5, 6]
    assert out["state"].tolist() == ["RW", "ST", "RW"]


def test_add_history_players_separate():
    a = rounds("a", [("R", "win"), ("R", "win"), ("R", "win")])
    b = rounds("b", [("S", "tie"), ("S", "tie"), ("S", "tie")])
    interleaved = pd.concat([a, b]).sort_values("round", kind="stable")

    out = add_history(interleaved)

    assert sorted(zip(out["player_id"], out["round"], out["state"])) == [
        ("a", 2, "RW"), ("a", 3, "RW"), ("b", 2, "ST"), ("b", 3, "ST")]


@pytest.mark.skipif(not MASTER.exists(), reason="master CSV absent")
def test_add_history_matches_prev_columns():
    master = load_rounds(MASTER)
    out = add_history(master)
    with_prev = out[out["prev_move"].notna()]

    assert len(with_prev) == master["prev_move"].notna().sum() > 0
    assert (with_prev["state"] == with_prev["prev_move"] + with_prev["prev_outcome"].map(OUTCOMES)).all()


def test_counts_small():
    N = count(rounds("a", BASIC))

    # round 2: state RW, next move P; round 3: PL, next S; round 4: ST, next R
    expected = pd.DataFrame(0, index=MOVES, columns=TOKENS)
    expected.loc["P", "RW"] = 1
    expected.loc["S", "PL"] = 1
    expected.loc["R", "ST"] = 1
    assert list(N.index) == MOVES
    assert list(N.columns) == TOKENS
    np.testing.assert_array_equal(N.to_numpy(), expected.to_numpy())
    assert N.to_numpy().dtype.kind == "i"


def test_counts_total():
    df = synthetic_rounds()

    assert count(df).to_numpy().sum() == len(add_history(df))


def test_count_rejects_unknown_outcome():
    with pytest.raises(ValueError):
        count(rounds("a", [("R", "win"), ("P", "draw"), ("S", "tie")]))


def test_count_rejects_unknown_move():
    with pytest.raises(ValueError):
        count(rounds("a", [("R", "win"), ("X", "lose"), ("S", "tie")]))


@pytest.mark.skipif(not (PARTITIONS / "train_pooled.csv").exists(), reason="partition files absent")
def test_pooled_counts_sum():
    brockbank = count(load_rounds(PARTITIONS / "train_brockbank.csv"))
    wxz = count(load_rounds(PARTITIONS / "train_wxz.csv"))
    pooled = count(load_rounds(PARTITIONS / "train_pooled.csv"))

    np.testing.assert_array_equal(brockbank.to_numpy() + wxz.to_numpy(), pooled.to_numpy())


def run_cli(*args):
    env = {**os.environ, "PYTHONPATH": str(SRC)}
    return subprocess.run([sys.executable, "-m", "rps_markov.count", *map(str, args)],
                          env=env, capture_output=True, text=True)


def write_inputs(folder):
    """Write a.csv and b.csv (synthetic rounds) to folder; return their paths."""
    paths = []
    for name, seed in [("a", 1), ("b", 2)]:
        path = folder / f"{name}.csv"
        synthetic_rounds(seed=seed).to_csv(path, index=False)
        paths.append(path)
    return paths


def test_cli_writes_counts_only(tmp_path):
    out = tmp_path / "out"
    result = run_cli("--csv", *write_inputs(tmp_path), "--out", out)

    assert result.returncode == 0, result.stderr
    assert sorted(p.name for p in out.iterdir()) == ["N_a.csv", "N_b.csv"]
    for name in ["a", "b"]:
        lines = (out / f"N_{name}.csv").read_text().splitlines()
        assert lines[0] == "move,RW,RL,RT,PW,PL,PT,SW,SL,ST"
        assert [line.split(",")[0] for line in lines[1:]] == MOVES


def test_cli_rejects_k(tmp_path):
    result = run_cli("--csv", *write_inputs(tmp_path), "--out", tmp_path / "out", "--k", "1")

    assert result.returncode != 0
