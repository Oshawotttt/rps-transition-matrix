import json
import os
import subprocess
import sys

import numpy as np
import pandas as pd
import pytest

from rps_markov.bot import Bot, Decision
from rps_markov.count import MOVES, TOKENS, count
from rps_markov.markov import BasicTransitionMatrix, BotMatchTransitionMatrix, Counts, OutcomeTransitionMatrix
from rps_markov.payoff import PayoffMatrix
from test_count import SRC, synthetic_rounds
from test_markov import cycling_counts, reducible_counts

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


def test_opening_from_match_steady_state():
    bot = Bot(synthetic_counts())
    pi = bot.match.stationary
    opening = bot.opening
    by_move = [sum(p for p, s in zip(pi, TOKENS) if s.startswith(m)) for m in MOVES]

    assert opening.state is None
    np.testing.assert_array_equal(opening.x, pi)
    np.testing.assert_allclose(opening.q, bot.outcome.P @ pi, rtol=0, atol=1e-12)
    np.testing.assert_allclose(opening.q, by_move, rtol=0, atol=1e-12)
    np.testing.assert_array_equal(opening.scores, bot.payoff.scores(opening.q))
    assert opening.move == bot.payoff.best_move(opening.q)
    assert opening.source == "match"


def test_opening_falls_back_to_basic():
    bot = Bot(reducible_counts())
    opening = bot.opening

    assert bot.match.eigenvalue_one_multiplicity == 2
    assert opening.source == "basic"
    np.testing.assert_array_equal(opening.x, bot.basic.stationary)
    np.testing.assert_array_equal(opening.q, bot.basic.stationary)
    assert opening.move == bot.payoff.best_move(bot.basic.stationary)


def test_opening_falls_back_on_unit_cycle():
    bot = Bot(cycling_counts(), alpha=1e-12)

    assert bot.match.has_unit_cycle is True
    assert bot.match.eigenvalue_one_multiplicity == 1
    assert bot.opening.source == "basic"
    np.testing.assert_array_equal(bot.opening.q, bot.basic.stationary)


def test_opening_cached():
    bot = Bot(synthetic_counts())

    assert bot.opening is bot.opening


DECISION_KEYS = {"state", "x", "q", "scores", "move", "source", "counter_move", "splits", "expected_score"}
CHAIN_KEYS = {"P", "eigenvalues", "moduli", "eigenvalue_one_multiplicity", "has_unit_cycle", "rounds_to_fade",
              "stationary", "closed_groups", "transient_states"}
MATCH_KEYS = CHAIN_KEYS | {"outcome_rates", "edge", "edge_check", "group_stationary", "group_outcome_rates"}


def assert_json_safe(value):
    """Only dicts with str keys, lists, str, int, float, bool and None; no numpy types."""
    if isinstance(value, dict):
        for key, item in value.items():
            assert isinstance(key, str)
            assert_json_safe(item)
    elif isinstance(value, list):
        for item in value:
            assert_json_safe(item)
    else:
        assert value is None or type(value) in (str, int, float, bool), type(value)


def test_decision_to_dict():
    d = Bot(synthetic_counts()).get_move("SL")
    out = d.to_dict()

    assert set(out) == DECISION_KEYS
    assert_json_safe(out)
    json.dumps(out, allow_nan=False)
    assert out["state"] == "SL" and out["move"] == d.move and out["source"] == "state"
    assert out["q"] == d.q.tolist()
    assert out["splits"] == d.splits.tolist() and len(out["splits"]) == 3
    assert out["expected_score"] == d.expected_score
    assert Bot(synthetic_counts()).opening.to_dict()["state"] is None


def test_bot_to_dict():
    bot = Bot(synthetic_counts())
    out = bot.to_dict()

    assert set(out) == {"opponent", "tokens", "moves", "alpha", "payoff", "outcome", "basic", "match", "opening", "decisions",
                        "policy", "look_ahead"}
    assert out["opponent"] is None
    assert out["tokens"] == TOKENS and out["moves"] == MOVES and out["alpha"] == 1.0
    assert set(out["payoff"]) == {"A"} and out["payoff"]["A"] == [[0, -1, 1], [1, 0, -1], [-1, 1, 0]]
    assert set(out["outcome"]) == {"P"}
    assert set(out["basic"]) == CHAIN_KEYS
    assert set(out["match"]) == MATCH_KEYS
    assert out["basic"]["rounds_to_fade"] == bot.basic.rounds_to_fade(0.1)
    assert out["match"]["edge"] == bot.match.edge
    assert out["opening"] == bot.opening.to_dict()
    assert set(out["decisions"]) == set(TOKENS)
    for s in TOKENS:
        assert out["decisions"][s] == bot.get_move(s).to_dict()
    assert set(out["policy"]) == {"S", "B"}
    np.testing.assert_allclose(out["policy"]["S"], bot.payoff.A @ bot.outcome.P, rtol=0, atol=1e-12)
    B = np.array(out["policy"]["B"])
    assert B.shape == (3, 9)
    for j, s in enumerate(TOKENS):
        np.testing.assert_array_equal(B[:, j], [m == out["decisions"][s]["move"] for m in MOVES])
    assert set(out["look_ahead"]) == set(TOKENS)
    for j, s in enumerate(TOKENS):
        x = np.zeros(9)
        x[j] = 1
        entry = out["look_ahead"][s]
        assert set(entry) == {"rows", "stopped_at"}
        np.testing.assert_array_equal(entry["rows"], bot.match.look_ahead(x))
        assert entry["stopped_at"] == len(entry["rows"]) - 1


def test_bot_to_dict_json_safe():
    bot = Bot(synthetic_counts())
    out = bot.to_dict()
    assert_json_safe(out)
    loaded = json.loads(json.dumps(out, allow_nan=False))

    for key in ["basic", "match"]:
        eigenvalues = getattr(bot, key).eigenvalues
        assert all(len(pair) == 2 for pair in loaded[key]["eigenvalues"])
        np.testing.assert_array_equal([complex(re, im) for re, im in loaded[key]["eigenvalues"]], eigenvalues)


def test_bot_to_dict_reducible():
    out = Bot(reducible_counts()).to_dict()
    match = out["match"]

    json.dumps(out, allow_nan=False)
    for key in ["stationary", "outcome_rates", "edge", "edge_check", "rounds_to_fade"]:
        assert match[key] is None, key
    assert match["eigenvalue_one_multiplicity"] == 2
    assert len(match["group_outcome_rates"]) == 2
    assert out["opening"]["source"] == "basic"


def run_bot_cli(*args):
    env = {**os.environ, "PYTHONPATH": str(SRC)}
    return subprocess.run([sys.executable, "-m", "rps_markov.bot", *map(str, args)],
                          env=env, capture_output=True, text=True)


def test_cli_writes_json(tmp_path):
    path = tmp_path / "N_a.csv"
    count(synthetic_rounds(seed=7)).to_csv(path)
    out = tmp_path / "bots" / "bot_a.json"

    result = run_bot_cli("--counts", path, "--out", out)
    assert result.returncode == 0, result.stderr
    assert json.loads(out.read_text()) == json.loads(json.dumps(Bot(Counts.load(path), name="a").to_dict()))

    half = tmp_path / "half.json"
    assert run_bot_cli("--counts", path, "--out", half, "--alpha", "0.5").returncode == 0
    assert json.loads(half.read_text())["alpha"] == 0.5

    named = tmp_path / "named.json"
    assert run_bot_cli("--counts", path, "--out", named, "--name", "Alice").returncode == 0
    assert json.loads(named.read_text())["opponent"] == "Alice"

    abbreviated = run_bot_cli("--count", path, "--out", tmp_path / "x.json")
    assert abbreviated.returncode != 0


ROOT = SRC.parent
WEB_FIXTURE = ROOT / "web" / "test" / "fixtures" / "bot_synthetic.json"
DEFAULT_BOT = ROOT / "web" / "public" / "bots" / "bot_rps_human_combined.json"
COMBINED_COUNTS = ROOT / "data" / "processed" / "transition_matrices" / "N_rps_human_combined.csv"


def assert_json_close(actual, expected, path="$"):
    """Strings, ints, bools and None exactly; floats within 1e-12 (np.linalg.eig can differ in the last bits)."""
    if isinstance(expected, dict):
        assert isinstance(actual, dict) and set(actual) == set(expected), path
        for key in expected:
            assert_json_close(actual[key], expected[key], f"{path}.{key}")
    elif isinstance(expected, list):
        assert isinstance(actual, list) and len(actual) == len(expected), path
        for k, (a, e) in enumerate(zip(actual, expected)):
            assert_json_close(a, e, f"{path}[{k}]")
    elif type(expected) is float:
        assert type(actual) is float and abs(actual - expected) <= 1e-12, (path, actual, expected)
    else:
        assert type(actual) is type(expected) and actual == expected, (path, actual, expected)


def exported(bot):
    """bot.to_dict() as the browser reads it, after the JSON round trip the CLI writes."""
    return json.loads(json.dumps(bot.to_dict(), allow_nan=False))


def test_web_fixture_is_current():
    assert_json_close(json.loads(WEB_FIXTURE.read_text(encoding="utf-8")), exported(Bot(synthetic_counts())))


@pytest.mark.skipif(not COMBINED_COUNTS.exists(), reason=f"{COMBINED_COUNTS} is missing (data/ is gitignored)")
def test_default_bot_is_current():
    expected = exported(Bot(Counts.load(COMBINED_COUNTS), name="rps_human_combined"))
    assert_json_close(json.loads(DEFAULT_BOT.read_text(encoding="utf-8")), expected)
