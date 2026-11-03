import numpy as np
import pandas as pd
import pytest

from rps_markov.count import MOVES, TOKENS, count, load_rounds
from rps_markov.markov import Counts, OutcomeTransitionMatrix, TransitionMatrix
from rps_markov.matrix import Matrix
from test_count import BASIC, rounds, run_cli, synthetic_rounds, write_inputs


def outcome_matrix(df, alpha=1.0):
    return OutcomeTransitionMatrix(Counts(count(df)), alpha)


def test_counts_load_matches_count(tmp_path):
    out = tmp_path / "out"
    inputs = write_inputs(tmp_path)
    result = run_cli("--csv", *inputs, "--out", out)
    assert result.returncode == 0, result.stderr

    for path in inputs:
        loaded = Counts.load(out / f"N_{path.stem}.csv")
        assert np.array_equal(loaded.values, count(load_rounds(path)).to_numpy()) is True
        assert loaded.states == TOKENS


def test_counts_rejects_wrong_rows():
    frame = count(synthetic_rounds()).loc[["P", "R", "S"]]

    with pytest.raises(ValueError):
        Counts(frame)


def test_counts_rejects_missing_state():
    with pytest.raises(ValueError):
        Counts(count(synthetic_rounds()).drop(columns="ST"))


def test_counts_rejects_k3_labels():
    labels = ["RW-RW-RW", "RW-RW-RL", "RW-RW-RT"]
    frame = pd.DataFrame(0, index=pd.Index(MOVES, name="move"), columns=labels)

    with pytest.raises(ValueError):
        Counts(frame)


def test_counts_read_only():
    counts = Counts(count(synthetic_rounds()))

    with pytest.raises(ValueError):
        counts.values[0, 0] = 99


def test_abstract_bases():
    with pytest.raises(TypeError):
        Matrix()
    with pytest.raises(TypeError):
        TransitionMatrix()


def test_outcome_matrix_is_labelled_matrix():
    tm = outcome_matrix(synthetic_rounds())
    x = np.linspace(0, 1, 9)

    assert isinstance(tm, Matrix)
    assert tm.P is tm.values
    assert tm.states == tm.columns == TOKENS
    assert tm.rows == MOVES
    np.testing.assert_array_equal(tm @ x, tm.predict(x))
    assert list(tm.to_frame().index) == MOVES
    assert list(tm.to_frame().columns) == TOKENS


def test_columns_sum_to_one():
    P = outcome_matrix(synthetic_rounds()).P

    assert P.shape == (3, 9)
    assert ((P >= 0) & (P <= 1)).all()
    np.testing.assert_allclose(P.sum(axis=0), 1, rtol=0, atol=1e-12)


def test_unseen_state_uniform():
    tm = outcome_matrix(rounds("a", BASIC), alpha=1.0)

    np.testing.assert_allclose(tm.column("SW"), [1 / 3, 1 / 3, 1 / 3])
    # seen state RW: one P out of one -> (0+1, 1+1, 0+1) / 4
    np.testing.assert_allclose(tm.column("RW"), [0.25, 0.5, 0.25])


def test_column_is_P_e_j():
    tm = outcome_matrix(synthetic_rounds())
    e_j = np.zeros(9)
    e_j[TOKENS.index("PL")] = 1

    np.testing.assert_array_equal(tm.column("PL"), tm.P @ e_j)
    np.testing.assert_array_equal(tm.column("PL"), tm.to_frame()["PL"].to_numpy())


def test_predict_mixture():
    tm = outcome_matrix(synthetic_rounds())
    x = np.zeros(9)
    x[TOKENS.index("RW")], x[TOKENS.index("PL")] = 0.25, 0.75

    np.testing.assert_allclose(tm.predict(x), 0.25 * tm.column("RW") + 0.75 * tm.column("PL"))
    assert tm.predict(x).sum() == pytest.approx(1)


def test_column_unknown_state():
    with pytest.raises(KeyError):
        outcome_matrix(synthetic_rounds()).column("XX")


def test_P_cached():
    tm = outcome_matrix(synthetic_rounds())

    assert tm.P is tm.P
