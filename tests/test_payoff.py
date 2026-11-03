import numpy as np

from rps_markov.count import MOVES
from rps_markov.matrix import Matrix
from rps_markov.payoff import PayoffMatrix


def test_payoff_values():
    np.testing.assert_array_equal(PayoffMatrix().A, [[0, -1, 1], [1, 0, -1], [-1, 1, 0]])


def test_payoff_is_labelled_matrix():
    payoff = PayoffMatrix()
    q = np.array([0.2, 0.5, 0.3])

    assert isinstance(payoff, Matrix)
    assert payoff.A is payoff.values
    assert payoff.rows == payoff.columns == MOVES
    np.testing.assert_array_equal(payoff.scores(q), payoff @ q)


def test_best_move_counters_pure_move():
    payoff = PayoffMatrix()

    assert payoff.best_move([1, 0, 0]) == "P"
    assert payoff.best_move([0, 1, 0]) == "S"
    assert payoff.best_move([0, 0, 1]) == "R"


def test_best_move_uses_expected_score():
    # scores [0.33, 0.01, -0.34]: R beats the counter to the most likely move (P)
    assert PayoffMatrix().best_move([0.45, 0.11, 0.44]) == "R"


def test_best_move_tie_goes_to_first():
    assert PayoffMatrix().best_move([1 / 3, 1 / 3, 1 / 3]) == "R"
