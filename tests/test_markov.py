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
    for member in ["eigenvalues", "stationary", "look_ahead", "moduli", "eigenvalue_one_multiplicity",
                   "has_unit_cycle", "rounds_to_fade", "closed_groups", "group_stationary", "transient_states",
                   "edge", "edge_check", "group_outcome_rates"]:
        assert not hasattr(tm, member), member


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


def test_stationary_rejects_reducible_chain():
    # human after RT/PW/SL plays S (bot R); after RW/PL/ST plays P (bot S): two closed classes
    frame = pd.DataFrame(0, index=MOVES, columns=TOKENS)
    frame.loc["S", ["RT", "PW", "SL"]] = 10
    frame.loc["P", ["RW", "PL", "ST"]] = 10
    tm = bot_match(Counts(frame))

    np.testing.assert_allclose(np.abs(tm.eigenvalues[:2]), [1, 1], rtol=0, atol=1e-12)
    with pytest.raises(ValueError):
        tm.stationary
    with pytest.raises(ValueError):
        tm.outcome_rates


def one_hot(n, j):
    x = np.zeros(n)
    x[j] = 1
    return x


def reducible_counts():
    # human after RT/PW/SL plays S (bot R); after RW/PL/ST plays P (bot S): two closed classes
    frame = pd.DataFrame(0, index=MOVES, columns=TOKENS)
    frame.loc["S", ["RT", "PW", "SL"]] = 10
    frame.loc["P", ["RW", "PL", "ST"]] = 10
    return Counts(frame)


def cycling_counts():
    # human after R* plays P (bot S, so PL); after P* or S* plays R (bot P, so RL): RL and PL alternate
    frame = pd.DataFrame(0, index=MOVES, columns=TOKENS)
    frame.loc["P", ["RW", "RL", "RT"]] = 10
    frame.loc["R", ["PW", "PL", "PT", "SW", "SL", "ST"]] = 10
    return Counts(frame)


def test_look_ahead_stops_at_tolerance():
    tm = bot_match(Counts(count(synthetic_rounds(seed=7))))
    x = one_hot(9, TOKENS.index("RW"))
    rows = tm.look_ahead(x)
    changes = np.abs(np.diff(rows, axis=0)).sum(axis=1)

    assert rows.shape[1] == 9
    np.testing.assert_array_equal(rows[0], x)
    for k in range(len(rows)):
        np.testing.assert_allclose(rows[k], np.linalg.matrix_power(tm.P, k) @ x, rtol=0, atol=1e-12)
    assert changes[-1] < 0.01
    assert (changes[:-1] >= 0.01).all()


def test_eigenvectors_and_coefficients():
    tm = bot_match(Counts(count(synthetic_rounds(seed=7))))
    V = tm.eigenvectors

    assert V.shape == (9, 9)
    np.testing.assert_allclose(tm.P @ V, V * tm.eigenvalues, rtol=0, atol=1e-9)
    np.testing.assert_allclose(V[:, 0], tm.stationary, rtol=0, atol=1e-12)
    for k in range(1, 9):
        np.testing.assert_allclose(np.linalg.norm(V[:, k]), 1, rtol=0, atol=1e-12)
        big = V[np.argmax(np.abs(V[:, k])), k]
        assert big.real > 0 and abs(big.imag) < 1e-12
    for j in range(9):
        x = one_hot(9, j)
        c = tm.coefficients(x)
        np.testing.assert_allclose(c[0], 1, rtol=0, atol=1e-9)
        np.testing.assert_allclose(V @ c, x, rtol=0, atol=1e-9)
        for t, row in enumerate(tm.look_ahead(x)):
            np.testing.assert_allclose((V * tm.eigenvalues ** t) @ c, row, rtol=0, atol=1e-9)


def test_eigenvectors_reducible():
    tm = bot_match(reducible_counts())
    V = tm.eigenvectors

    if V is not None:
        np.testing.assert_allclose(tm.P @ V, V * tm.eigenvalues, rtol=0, atol=1e-9)
        np.testing.assert_allclose(V @ tm.coefficients(one_hot(9, 0)), one_hot(9, 0), rtol=0, atol=1e-9)
    else:
        assert tm.coefficients(one_hot(9, 0)) is None


def test_look_ahead_uniform():
    rows = BasicTransitionMatrix(zero_counts()).look_ahead(one_hot(3, 0))

    assert rows.shape == (3, 3)
    np.testing.assert_allclose(rows[1:], 1 / 3, rtol=0, atol=1e-12)


def test_look_ahead_cap():
    tm = BasicTransitionMatrix(Counts(count(synthetic_rounds(seed=5))))

    assert tm.look_ahead(one_hot(3, 0), tol=0, max_steps=5).shape == (6, 3)


def test_moduli():
    tm = bot_match(Counts(count(synthetic_rounds(seed=7))))

    np.testing.assert_array_equal(tm.moduli, np.abs(tm.eigenvalues))


def test_diagnostics_irreducible():
    tm = bot_match(Counts(count(synthetic_rounds(seed=7))))
    expected_fade = next(t for t in range(1000) if tm.moduli[1] ** t < 0.1)
    zero = [s for s, p in zip(TOKENS, tm.stationary) if abs(p) < 1e-12]

    assert tm.eigenvalue_one_multiplicity == 1
    assert tm.has_unit_cycle is False
    assert tm.rounds_to_fade(0.1) == expected_fade
    assert len(tm.closed_groups) == 1
    assert tm.transient_states == zero
    np.testing.assert_allclose(tm.group_stationary[0], tm.stationary, rtol=0, atol=1e-12)


def test_diagnostics_reducible():
    tm = bot_match(reducible_counts())

    assert tm.eigenvalue_one_multiplicity == 2
    assert tm.rounds_to_fade() is None
    assert tm.closed_groups == [["RW", "PL", "ST"], ["RT", "PW", "SL"]]
    assert tm.transient_states == ["RL", "PT", "SW"]
    for group, pi in zip(tm.closed_groups, tm.group_stationary):
        np.testing.assert_allclose(tm.P @ pi, pi, rtol=0, atol=1e-12)
        assert pi.sum() == pytest.approx(1)
        outside = [j for j, s in enumerate(TOKENS) if s not in group]
        np.testing.assert_array_equal(pi[outside], 0)
    assert len(tm.group_outcome_rates) == 2
    for rates in tm.group_outcome_rates:
        assert set(rates) == {"win", "lose", "tie"}
        assert sum(rates.values()) == pytest.approx(1)
    with pytest.raises(ValueError):
        tm.edge
    with pytest.raises(ValueError):
        tm.edge_check


def test_has_unit_cycle():
    tm = bot_match(cycling_counts(), alpha=1e-12)
    pi = pd.Series(tm.stationary, index=TOKENS)

    assert tm.has_unit_cycle is True
    assert tm.eigenvalue_one_multiplicity == 1
    np.testing.assert_allclose(pi[["RL", "PL"]], 0.5, rtol=0, atol=1e-9)


def test_edge_cross_check():
    tm = bot_match(Counts(count(synthetic_rounds(seed=7))))

    assert tm.edge == pytest.approx(tm.outcome_rates["lose"] - tm.outcome_rates["win"], abs=1e-12)
    assert tm.edge == pytest.approx(tm.edge_check, abs=1e-12)


def test_edge_uniform():
    assert bot_match(zero_counts()).edge == pytest.approx(0, abs=1e-12)
