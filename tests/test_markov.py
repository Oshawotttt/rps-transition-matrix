from pathlib import Path

import pandas as pd
import pytest

from rps_markov.markov import OUTCOMES, TOKENS, add_history, load_rounds, state_labels

MASTER = Path(__file__).resolve().parents[1] / "data" / "processed" / "rps_human_combined.csv"
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
