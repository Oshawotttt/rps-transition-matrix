import { Card, Fallback, Mat, MoveIcon, NAME, Vec, fix, int, signed } from "./ui.jsx";

const OUTCOME = { W: "won", L: "lost", T: "tied" };

export function Step({ n, title, formula, open = true, children }) {
  return (
    <details className="step" open={open}>
      <summary>
        <span className="n">{n}</span><h2>{title}<em>{formula}</em></h2>
        <svg className="chev" aria-hidden="true"><use href="#chev" /></svg>
      </summary>
      <div className="sbody">{children}</div>
    </details>
  );
}

// Bar chart of q: their chance of each move.
export function QBars({ q, moves }) {
  const top = Math.max(...q);
  return (
    <div className="figs"><div>
      <div className="vb">
        {q.map((v, i) => (
          <div key={moves[i]}>{fix(v)}<i style={{ height: `${(v / top) * 150}px`, background: `var(--${moves[i].toLowerCase()})` }} /></div>
        ))}
      </div>
      <div className="vl">{moves.map((m) => <span key={m}>{NAME[m]}</span>)}</div>
      <p className="cap">Their chance of throwing each move next.</p>
    </div></div>
  );
}

function Predict({ bot, decision, state, round }) {
  const { tokens, moves } = bot;
  const P = bot.outcome.P;
  const col = state ? tokens.indexOf(state) : -1;
  const matP = (
    <span className="mstack">
      <span className="collbl">{tokens.map((t, j) => <span key={t} className={j === col ? "hl" : undefined}>{t}</span>)}</span>
      <Mat rows={P} col={col} />
    </span>
  );
  let text, eq;
  if (state) {
    // round 2 is always the first lookup, since round 1 always ends in a state
    const first = round === 2;
    text = first
      ? "x is one-hot: 1 for the state just played, 0 for the other 8. Multiplying P by it picks out one column, so this step is a lookup."
      : `x is one-hot, so q is column ${state} of P.`;
    eq = <>{matP}{first && <Vec values={decision.x} format={int} hl={col} />}</>;
  } else if (decision.source === "basic") {
    const split = bot.match.eigenvalue_one_multiplicity > 1;
    text = `Round 1 has no last state, and the 9 × 9 ${split ? "matrix has no single π" : "chain never settles on its π"}. So q₀ is the steady state of the 3 × 3 matrix, the habit from training, used directly.`;
    eq = <span className="lab">π of the 3&nbsp;×&nbsp;3 matrix =</span>;
  } else {
    text = "Round 1 has no last state, so x is the steady state π (see Long run). P π averages all 9 columns of P, weighted by π.";
    eq = <>{matP}<Vec values={decision.x} /></>;
  }
  return (
    <Step n={1} title="Predict" formula="q = P x">
      <p>{text}</p>
      <div className="eq"><span className="lab">{state ? "q =" : "q₀ ="}</span>{eq} = <Vec values={decision.q} /></div>
      <QBars q={decision.q} moves={moves} />
    </Step>
  );
}

// Bar heights share one scale from zero, so the win and loss bars keep their height when they move into the gap column.
const BAR = 150;
const FILL = { 1: "var(--w)", 0: "var(--t)", "-1": "var(--l)" };
const SIGN = { 1: "pos", 0: "zer", "-1": "neg" };

// A's row recolours q: each row of the grid is q painted by one row of A, then its win and loss bars side by side.
// The band between their tops is that row of A q. `pick` highlights the move we chose.
function ScoreGrid({ bot, decision, pick }) {
  const { moves } = bot;
  const A = bot.payoff.A;
  const { q, splits, scores } = decision;
  const top = Math.max(...q);
  const h = (v) => `${(v / top) * BAR}px`;
  return (
    <div className="sg" role="img" aria-label={moves.map((m, i) => `Our ${NAME[m]}: win ${fix(splits[i][0])}, lose ${fix(splits[i][2])}, score ${signed(scores[i])}`).join(". ")}>
      <span />
      {moves.map((m, j) => <span key={m} className="sg-hd"><MoveIcon move={m} />Their {NAME[m]}<small>q = {fix(q[j])}</small></span>)}
      <span /><span className="sg-hd">win, lose</span><span className="sg-hd sg-r">A q</span>
      {A.map((row, i) => {
        const [win, , lose] = splits[i];
        const lo = Math.min(win, lose);
        return (
          <div key={moves[i]} className={`sg-row${pick === moves[i] ? " on" : ""}`}>
            <span className="sg-who"><MoveIcon move={moves[i]} /> Our {NAME[moves[i]]}</span>
            {row.map((a, j) => (
              <span key={j} className="sg-cell">
                <span className={`sg-a ${SIGN[a]}`}>{a > 0 ? `+${a}` : int(a)}</span>
                <i className={a === 0 ? "t" : undefined} style={{ height: h(q[j]), background: FILL[a] }}>{fix(q[j])}</i>
              </span>
            ))}
            <span className="sg-ar" aria-hidden="true">→</span>
            <span className="sg-gap">
              <i style={{ height: h(win), background: "var(--w)" }}>{fix(win)}</i>
              <i style={{ height: h(lose), background: "var(--l)" }}>{fix(lose)}</i>
              <span className="sg-band" style={{ bottom: h(lo), height: h(Math.abs(win - lose)) }} />
            </span>
            <span className={`sg-score ${SIGN[Math.sign(Math.round(scores[i] * 1000))]}`}>{signed(scores[i])}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Score({ bot, decision, open, pick }) {
  return (
    <Step n={2} title="Score" formula="A q" open={open}>
      <p>A holds our score for each pair of moves: rows are our move, columns are theirs. Multiplying by q gives each of our moves' expected points: its chance of winning minus its chance of losing.</p>
      <div className="eq"><span className="lab">A q =</span><Mat rows={bot.payoff.A} format={int} /><Vec values={decision.q} /> = <Vec values={decision.scores} format={signed} /></div>
      <ScoreGrid bot={bot} decision={decision} pick={pick} />
      <div className="key"><span><i style={{ background: "var(--w)" }} />We win (+1)</span><span><i style={{ background: "var(--t)" }} />Tie (0)</span><span><i style={{ background: "var(--l)" }} />We lose (−1)</span><span><i className="band" />Gap: A q</span></div>
    </Step>
  );
}

function Result({ record, winner, tally, onNext, name }) {
  const { botMove, humanMove, outcome, token, round } = record;
  const title = outcome === "tie" ? "Tie. Replay the round" : outcome === "lose" ? `We win round ${round}` : `They win round ${round}`;
  let end = "";
  if (winner === "bot") end = ` We win the match ${tally.lose}–${tally.win}.`;
  if (winner === "human") end = ` ${name} wins the match ${tally.win}–${tally.lose}.`;
  return (
    <div className="result" aria-live="polite">
      <div className="pair"><Card move={botMove} side="b" won={outcome === "lose"} /><Card move={humanMove} side="h" won={outcome === "win"} /></div>
      <div><h3>{title}</h3><p>We played {NAME[botMove]}, they played {NAME[humanMove]}. New state: {token}.{end}</p></div>
      <button className="next" onClick={onNext}>{winner ? "See the podium" : "Next round"}</button>
    </div>
  );
}

function Choose({ bot, decision, phase, pick, wrong, onPick, onFriend, record, winner, tally, onNext, name }) {
  const { moves } = bot;
  const chosen = phase !== "think";
  return (
    <Step n={3} title="Choose" formula="the largest entry of A q">
      <p>Which move do we play? Pick the row of A q with the largest score. If two tie, take the first in the order R, P, S.</p>
      <div className="opts">
        {moves.map((m) => (
          // a new key on each wrong pick remounts the button, so the shake replays
          <button key={wrong?.move === m ? `${m}-${wrong.n}` : m} className={`mv${chosen && m === pick ? " yes" : ""}${wrong?.move === m ? " no" : ""}`}
            disabled={chosen} onClick={() => onPick(m)}>
            <MoveIcon move={m} />{NAME[m]}
          </button>
        ))}
      </div>
      <p className={`fb${wrong ? " bad" : ""}`} aria-live="polite">
        {wrong && `${NAME[wrong.move]} scores ${signed(decision.scores[moves.indexOf(wrong.move)])}. That's not the largest entry of A q.`}
        {chosen && `Correct: ${NAME[pick]} scores ${signed(decision.scores[moves.indexOf(pick)])}, the largest entry.`}
      </p>
      {chosen && decision.move !== decision.counter_move && (
        <p className="flag">Note: countering their likeliest move would mean playing {NAME[decision.counter_move]}.</p>
      )}
      {phase === "reveal" && (
        <div className="friend">
          <h3>What did {bot.opponent ?? "your friend"} throw?</h3>
          <div className="opts">
            {moves.map((m) => <button key={m} className="mv sm" onClick={() => onFriend(m)}><MoveIcon move={m} />{NAME[m]}</button>)}
          </div>
        </div>
      )}
      {phase === "result" && <Result record={record} winner={winner} tally={tally} onNext={onNext} name={name} />}
    </Step>
  );
}

export default function RoundReport(props) {
  const { bot, state, round } = props;
  return (
    <>
      <div className="lede">
        <h1>Round {round}</h1>
        <p>
          {state
            ? <>x = <b>{state}</b>: they played {NAME[state[0]]} and {OUTCOME[state[1]]}</>
            : props.decision.source === "basic"
              ? <>x = <b>π of the 3&nbsp;×&nbsp;3 matrix</b>: no previous round</>
              : <>x = <b>π</b>: no previous round</>}
        </p>
      </div>
      {!state && <Fallback bot={bot} />}
      <Predict {...props} />
      <Score {...props} />
      <Choose {...props} />
    </>
  );
}
