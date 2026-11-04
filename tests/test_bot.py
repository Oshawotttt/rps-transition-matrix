import numpy as np
import pandas as pd
import pytest

from rps_markov.bot import Bot, Decision
from rps_markov.count import MOVES, TOKENS, count
from rps_markov.markov import BasicTransitionMatrix, BotMatchTransitionMatrix, Counts, OutcomeTransitionMatrix
from rps_markov.payoff import PayoffMatrix
from test_count import synthetic_rounds

# the move that beats each move
BEATS = {"R": "P", "P": "S", "S": "R"}


def synthetic_counts(seed=7):
    return Counts(count(synthetic_rounds(seed=seed)))


def assert_decisions_equal(a, b):
    assert (a.state, a.move, a.source, a.counter_move, a.expected_score) == \
        (b.state, b.move, b.source, b.counter_move, b.expected_score)
    for field in ["x", "q", "scores", "splits"]:
        np.testing.assert_array_equal(getattr(a, field), getattr(b, field))


@pytest.mark.parametrize("alpha", [1.0, 0.5])
def test_bot_holds_matrices(alpha):
    counts = synthetic_counts()
    bot = Bot(counts, alpha)
    outcome = OutcomeTransitionMatrix(counts, alpha)

    np.testing.assert_array_equal(bot.outcome.P, outcome.P)
    np.testing.assert_array_equal(bot.basic.P, BasicTransitionMatrix(counts, alpha).P)
    np.testing.assert_array_equal(bot.match.P, BotMatchTransitionMatrix(outcome, PayoffMatrix()).P)
    np.testing.assert_array_equal(bot.payoff.A, PayoffMatrix().A)


def test_get_move_decision():
    bot = Bot(synthetic_counts())
    decision = bot.get_move("RL")
    expected_x = np.zeros(9)
    expected_x[TOKENS.index("RL")] = 1

    assert isinstance(decision, Decision)
    assert decision.state == "RL"
    np.testing.assert_array_equal(decision.x, expected_x)
    np.testing.assert_array_equal(decision.q, bot.outcome.column("RL"))
    np.testing.assert_array_equal(decision.scores, bot.payoff.scores(decision.q))
    assert decision.move == bot.payoff.best_move(decision.q)
    assert decision.source == "state"


def test_decision_panel_fields():
    bot = Bot(synthetic_counts())

    for state in TOKENS:
        d = bot.get_move(state)
        assert d.counter_move == BEATS[MOVES[int(np.argmax(d.q))]]
        assert d.splits.shape == (3, 3)
        np.testing.assert_allclose(d.splits.sum(axis=1), 1, rtol=0, atol=1e-12)
        np.testing.assert_allclose(d.splits[:, 0] - d.splits[:, 2], d.scores, rtol=0, atol=1e-12)
        assert d.expected_score == pytest.approx(max(d.scores))


def test_splits_hand_checked():
    # after RW the human plays R 1, P 2, S 1 times -> q = [0.25, 0.5, 0.25] with alpha 0
    frame = pd.DataFrame(1, index=MOVES, columns=TOKENS)
    frame.loc[["R", "P", "S"], "RW"] = [1, 2, 1]
    d = Bot(Counts(frame), alpha=0).get_move("RW")

    # rows bot R, P, S; columns win, tie, lose from the bot's side
    np.testing.assert_allclose(d.splits, [[0.25, 0.25, 0.5], [0.25, 0.5, 0.25], [0.5, 0.25, 0.25]])


def test_counter_move_tie():
    frame = pd.DataFrame(1, index=MOVES, columns=TOKENS)
    frame.loc[["R", "P", "S"], "RW"] = [5, 5, 0]
    frame.loc[["R", "P", "S"], "PL"] = [0, 5, 5]
    bot = Bot(Counts(frame))

    assert bot.get_move("RW").counter_move == "P"
    assert bot.get_move("PL").counter_move == "S"


def test_bots_are_independent():
    a_counts, b_counts = synthetic_counts(seed=7), synthetic_counts(seed=3)
    a = Bot(a_counts)
    a_P = a.outcome.P.copy()
    a_decisions = [a.get_move(s) for s in TOKENS]

    b = Bot(b_counts)
    b_decisions = [b.get_move(s) for s in TOKENS]

    np.testing.assert_array_equal(a.outcome.P, a_P)
    np.testing.assert_array_equal(b.outcome.P, OutcomeTransitionMatrix(b_counts).P)
    assert not np.array_equal(a.outcome.P, b.outcome.P)
    for before, after in zip(a_decisions, [a.get_move(s) for s in TOKENS]):
        assert_decisions_equal(before, after)
    for decision, state in zip(b_decisions, TOKENS):
        np.testing.assert_array_equal(decision.q, OutcomeTransitionMatrix(b_counts).column(state))


def test_get_move_has_no_memory():
    bot = Bot(synthetic_counts())
    first = bot.get_move("PT")
    for state in TOKENS:
        bot.get_move(state)

    assert bot.get_move("PT") == first
    assert_decisions_equal(bot.get_move("PT"), first)


def test_get_move_unknown_state():
    with pytest.raises(KeyError):
        Bot(synthetic_counts()).get_move("XX")


def human_token(human, bot):
    if human == bot:
        return human + "T"
    return human + ("W" if BEATS[bot] == human else "L")


def test_get_move_matches_match_chain():
    bot = Bot(synthetic_counts())
    frame = bot.match.to_frame()

    for state in TOKENS:
        column = frame[state]
        bot_move = bot.get_move(state).move
        assert sorted(column[column != 0].index) == sorted(human_token(m, bot_move) for m in MOVES)


def test_bot_is_lazy():
    bot = Bot(synthetic_counts())

    for matrix in [bot.outcome, bot.basic, bot.match, bot.payoff]:
        assert "values" not in matrix.__dict__
