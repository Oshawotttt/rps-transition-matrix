import numpy as np
import pandas as pd
import pytest

from rps_markov.count import MOVES, TOKENS, count, load_rounds
from rps_markov.markov import (BasicTransitionMatrix, BotMatchTransitionMatrix, Counts, OutcomeTransitionMatrix,
                               SquareTransitionMatrix, TransitionMatrix)
from rps_markov.payoff import PayoffMatrix
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


def test_basic_matrix_hand_checked():
    tm = BasicTransitionMatrix(Counts(count(rounds("a", BASIC))), alpha=1)

    # one R -> P, one P -> S, one S -> R
    np.testing.assert_allclose(tm.column("R"), [0.25, 0.5, 0.25])
    np.testing.assert_allclose(tm.column("P"), [0.25, 0.25, 0.5])
    np.testing.assert_allclose(tm.column("S"), [0.5, 0.25, 0.25])


def test_basic_matrix_recovers_move_counts():
    df = synthetic_rounds(seed=3)
    alpha = 0.5
    tm = BasicTransitionMatrix(Counts(count(df)), alpha=alpha)

    ordered = df.sort_values(["player_id", "round"])
    by_player = ordered.groupby("player_id")
    has_prev = by_player["round"].shift(1) == ordered["round"] - 1
    prev_move = by_player["move"].shift(1)
    expected = pd.crosstab(pd.Categorical(ordered["move"][has_prev], categories=MOVES),
                           pd.Categorical(prev_move[has_prev], categories=MOVES), dropna=False)
    recovered = tm.P * (expected.to_numpy().sum(axis=0) + 3 * alpha) - alpha

    np.testing.assert_allclose(recovered, expected.loc[MOVES, MOVES].to_numpy(), atol=1e-9)


def test_basic_matrix_shape():
    tm = BasicTransitionMatrix(Counts(count(synthetic_rounds())))

    assert tm.P.shape == (3, 3)
    np.testing.assert_allclose(tm.P.sum(axis=0), 1, rtol=0, atol=1e-12)
    assert tm.rows == tm.states == MOVES


def zero_counts():
    return Counts(pd.DataFrame(0, index=MOVES, columns=TOKENS))


def test_eigenvalues_sorted_with_one_first():
    eigenvalues = BasicTransitionMatrix(Counts(count(synthetic_rounds(seed=5)))).eigenvalues
    moduli = np.abs(eigenvalues)

    assert np.iscomplexobj(eigenvalues)
    np.testing.assert_allclose(eigenvalues[0], 1, rtol=0, atol=1e-12)
    assert (np.diff(moduli) <= 0).all()
    assert (moduli[1:] < 1).all()


def test_stationary_is_fixed_point():
    tm = BasicTransitionMatrix(Counts(count(synthetic_rounds(seed=5))))
    pi = tm.stationary

    np.testing.assert_allclose(tm.P @ pi, pi, rtol=0, atol=1e-12)
    assert pi.sum() == pytest.approx(1)
    assert (pi > 0).all()
    assert not np.iscomplexobj(pi)


def test_uniform_P_eigen():
    tm = BasicTransitionMatrix(zero_counts())

    np.testing.assert_allclose(tm.eigenvalues, [1, 0, 0], rtol=0, atol=1e-12)
    np.testing.assert_allclose(tm.stationary, [1 / 3, 1 / 3, 1 / 3], rtol=0, atol=1e-12)


def test_square_matrix_kinds():
    assert isinstance(BasicTransitionMatrix(zero_counts()), SquareTransitionMatrix)
    tm = OutcomeTransitionMatrix(zero_counts())
    assert not hasattr(tm, "eigenvalues")
    assert not hasattr(tm, "stationary")


def bot_match(counts, alpha=1.0):
    return BotMatchTransitionMatrix(OutcomeTransitionMatrix(counts, alpha), PayoffMatrix())


def test_bot_match_shape():
    P = bot_match(Counts(count(synthetic_rounds(seed=7)))).P

    assert P.shape == (9, 9)
    np.testing.assert_allclose(P.sum(axis=0), 1, rtol=0, atol=1e-12)
    assert ((P != 0).sum(axis=0) == 3).all()


def test_bot_match_hand_checked_column():
    tm = bot_match(Counts(count(rounds("a", BASIC))))
    column = tm.to_frame()["RW"]

    # human after RW: [0.25, 0.5, 0.25]; bot scores [-0.25, 0, 0.25] -> bot plays S
    # human R beats S (RW), P loses to S (PL), S ties S (ST)
    assert sorted(column[column != 0].index) == ["PL", "RW", "ST"]
    np.testing.assert_allclose(column[["RW", "PL", "ST"]], [0.25, 0.5, 0.25])
    assert tm.rows == tm.states == TOKENS


def test_bot_match_uniform_human_rates():
    rates = bot_match(zero_counts()).outcome_rates

    assert set(rates) == {"win", "lose", "tie"}
    for rate in rates.values():
        assert rate == pytest.approx(1 / 3)


def test_bot_match_rates_from_stationary():
    tm = bot_match(Counts(count(synthetic_rounds(seed=7))))
    pi = pd.Series(tm.stationary, index=TOKENS)

    assert sum(tm.outcome_rates.values()) == pytest.approx(1)
    for outcome, letter in [("win", "W"), ("lose", "L"), ("tie", "T")]:
        assert tm.outcome_rates[outcome] == pytest.approx(pi[[t for t in TOKENS if t.endswith(letter)]].sum())


def test_bot_match_kind():
    counts = Counts(count(synthetic_rounds()))

    assert isinstance(bot_match(counts), SquareTransitionMatrix)
    with pytest.raises(TypeError):
        BotMatchTransitionMatrix(BasicTransitionMatrix(counts), PayoffMatrix())
