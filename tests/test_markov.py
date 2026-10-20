import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from rps_markov.markov import MOVES, OUTCOMES, TOKENS, TransitionMatrix, add_history, load_rounds, state_labels

MASTER = Path(__file__).resolve().parents[1] / "data" / "processed" / "rps_human_combined.csv"
PARTITIONS = MASTER.parent / "partitions"
SRC = Path(__file__).resolve().parents[1] / "src"
COLUMNS = ["dataset", "game_id", "player_id", "round", "move", "opp_move",
           "outcome", "prev_move", "prev_opp_move", "prev_outcome"]


def test_state_labels():
    assert state_labels(1) == TOKENS
    assert len(state_labels(3)) == 729
    assert state_labels(2)[1] == "RW-RL"


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


def test_add_history_basic():
    out = add_history(rounds("a", BASIC), k=2)

    assert out["round"].tolist() == [3, 4]
    assert out["state"].tolist() == ["RW-PL", "PL-ST"]


def test_add_history_gap():
    plays = [("R", "win"), ("P", "lose"), ("S", "tie"), ("R", "win"), ("P", "lose")]
    out = add_history(rounds("a", plays, [1, 2, 4, 5, 6]), k=2)

    # round 3 is missing: rounds 4 and 5 lack 2 gap-free prior rounds; round 6 uses rounds 4, 5
    assert out["round"].tolist() == [6]
    assert out["state"].tolist() == ["ST-RW"]


def test_add_history_players_separate():
    a = rounds("a", [("R", "win"), ("R", "win"), ("R", "win")])
    b = rounds("b", [("S", "tie"), ("S", "tie"), ("S", "tie")])
    interleaved = pd.concat([a, b]).sort_values("round", kind="stable")

    out = add_history(interleaved, k=2)

    assert sorted(zip(out["player_id"], out["round"], out["state"])) == [
        ("a", 3, "RW-RW"), ("b", 3, "ST-ST")]


@pytest.mark.skipif(not MASTER.exists(), reason="master CSV absent")
def test_add_history_matches_prev_columns():
    master = load_rounds(MASTER)
    out = add_history(master, k=1)
    with_prev = out[out["prev_move"].notna()]

    assert len(with_prev) == master["prev_move"].notna().sum() > 0
    assert (with_prev["state"] == with_prev["prev_move"] + with_prev["prev_outcome"].map(OUTCOMES)).all()


def test_counts_small():
    tm = TransitionMatrix(k=2).fit(rounds("a", BASIC))

    # round 3: state RW-PL, next move S; round 4: state PL-ST, next move R
    expected = np.zeros((3, 81), dtype=int)
    expected[2, tm.states.index("RW-PL")] = 1
    expected[0, tm.states.index("PL-ST")] = 1
    np.testing.assert_array_equal(tm.counts, expected)


def synthetic_rounds(n_players=4, n_rounds=40, seed=0):
    rng = np.random.default_rng(seed)
    frames = []
    for p in range(n_players):
        moves = rng.choice(MOVES, size=n_rounds)
        outcomes = rng.choice(list(OUTCOMES), size=n_rounds)
        frames.append(rounds(f"p{p}", list(zip(moves, outcomes))))
    return pd.concat(frames, ignore_index=True)


@pytest.mark.parametrize("k", [1, 2, 3])
def test_columns_sum_to_one(k):
    P = TransitionMatrix(k).fit(synthetic_rounds()).P

    assert P.shape == (3, 9**k)
    assert ((P >= 0) & (P <= 1)).all()
    np.testing.assert_allclose(P.sum(axis=0), 1, rtol=0, atol=1e-12)


def test_unseen_state_uniform():
    tm = TransitionMatrix(k=2, alpha=1.0).fit(rounds("a", BASIC))

    np.testing.assert_allclose(tm.column("SW-SW"), [1 / 3, 1 / 3, 1 / 3])
    # seen state RW-PL: one S out of one -> (0+1, 0+1, 1+1) / 4
    np.testing.assert_allclose(tm.column("RW-PL"), [0.25, 0.25, 0.5])


def test_column_is_P_e_j():
    tm = TransitionMatrix(k=3).fit(synthetic_rounds())
    e_j = np.zeros(729)
    e_j[tm.states.index("RW-PL-ST")] = 1

    np.testing.assert_array_equal(tm.column("RW-PL-ST"), tm.P @ e_j)
    np.testing.assert_array_equal(tm.column("RW-PL-ST"), tm.to_frame()["RW-PL-ST"].to_numpy())
    assert list(tm.to_frame().index) == MOVES
    assert list(tm.to_frame().columns) == tm.states


def test_predict_mixture():
    tm = TransitionMatrix(k=1).fit(synthetic_rounds())
    x = np.zeros(9)
    x[TOKENS.index("RW")], x[TOKENS.index("PL")] = 0.25, 0.75

    np.testing.assert_allclose(tm.predict(x), 0.25 * tm.column("RW") + 0.75 * tm.column("PL"))
    assert tm.predict(x).sum() == pytest.approx(1)


def test_column_unknown_state():
    with pytest.raises(KeyError):
        TransitionMatrix(k=1).column("XX")


def test_counts_total():
    df = synthetic_rounds()

    assert TransitionMatrix(k=2).fit(df).counts.sum() == len(add_history(df, 2))


def test_save_load_roundtrip(tmp_path):
    tm = TransitionMatrix(k=2).fit(synthetic_rounds())
    path = tmp_path / "N.csv"

    tm.save(path)
    loaded = TransitionMatrix.load(path)

    assert loaded.k == 2
    np.testing.assert_array_equal(loaded.counts, tm.counts)
    header = path.read_text().splitlines()[0].split(",")
    assert header == ["move"] + tm.states


def test_from_csv(tmp_path):
    path = tmp_path / "rounds.csv"
    synthetic_rounds().to_csv(path, index=False)

    np.testing.assert_array_equal(TransitionMatrix.from_csv(path, k=2).counts,
                                  TransitionMatrix(2).fit(load_rounds(path)).counts)


@pytest.mark.skipif(not (PARTITIONS / "train_pooled.csv").exists(), reason="partition files absent")
def test_pooled_counts_sum():
    brockbank = TransitionMatrix.from_csv(PARTITIONS / "train_brockbank.csv")
    wxz = TransitionMatrix.from_csv(PARTITIONS / "train_wxz.csv")
    pooled = TransitionMatrix.from_csv(PARTITIONS / "train_pooled.csv")

    np.testing.assert_array_equal(brockbank.counts + wxz.counts, pooled.counts)


def test_fit_rejects_unknown_outcome():
    with pytest.raises(ValueError):
        TransitionMatrix(k=1).fit(rounds("a", [("R", "win"), ("P", "draw"), ("S", "tie")]))


def run_cli(*args):
    env = {**os.environ, "PYTHONPATH": str(SRC)}
    return subprocess.run([sys.executable, "-m", "rps_markov.markov", *map(str, args)],
                          env=env, capture_output=True, text=True)


@pytest.fixture
def cli_out(tmp_path):
    for name, seed in [("a", 1), ("b", 2)]:
        synthetic_rounds(seed=seed).to_csv(tmp_path / f"{name}.csv", index=False)
    out = tmp_path / "out"
    result = run_cli("--csv", tmp_path / "a.csv", tmp_path / "b.csv", "--out", out)
    assert result.returncode == 0, result.stderr
    return out


def test_cli_writes_files(cli_out):
    assert sorted(p.name for p in cli_out.iterdir()) == ["N_a.csv", "N_b.csv", "P_a.csv", "P_b.csv"]


def test_cli_output_valid(cli_out):
    for name in ["a", "b"]:
        tm = TransitionMatrix.load(cli_out / f"N_{name}.csv")
        assert tm.P.shape == (3, 729)
        np.testing.assert_allclose(tm.P.sum(axis=0), 1, rtol=0, atol=1e-12)

        P = pd.read_csv(cli_out / f"P_{name}.csv", index_col="move")
        np.testing.assert_allclose(P.to_numpy(), tm.P)
        assert list(P.index) == MOVES
        assert list(P.columns) == tm.states
