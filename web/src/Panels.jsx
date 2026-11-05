import { useState } from "react";
import { Fallback, LMat, Mat, MoveIcon, NAME, fix, int, signed } from "./ui.jsx";

const OUTCOME_COLOUR = { W: "w", L: "l", T: "t" };

function Rates({ rates, edge }) {
  return (
    <div className="rates">
      <span><b>{fix(rates.win)}</b>they win</span>
      <span><b>{fix(rates.lose)}</b>they lose</span>
      <span><b>{fix(rates.tie)}</b>tie</span>
      {edge != null && <span><b>{signed(edge)}</b>our edge per round</span>}
    </div>
  );
}

function eigenLabel([re, im]) {
  if (Math.abs(im) < 1e-9) return fix(re);
  return `${fix(re)} ${im < 0 ? "−" : "+"} ${fix(Math.abs(im))}i`;
}

const OUTCOME_WORD = { W: "they win", L: "they lose", T: "tie" };
const zeroAsInt = (v) => (v === 0 ? "0" : fix(v));
const mCell = (tokens) => (v, i) => (v === 0 ? "z" : `nz ${OUTCOME_COLOUR[tokens[i][1]]}`);

// How M comes from P: score every state (S = A P), keep the best move per state (B), then drop each column of P into M.
// Everything is read from the bot file; the rows each entry lands in are found in M, not re-derived.
function Build({ bot, s, setS }) {
  const { tokens, moves, match } = bot;
  const { S, B } = bot.policy;
  const P = bot.outcome.P;
  const j = tokens.indexOf(s);
  const ours = bot.decisions[s].move;
  const ourRows = moves.map((m) => `Our ${m}`);
  const mCol = match.P.map((row) => [row[j]]);
  return (
    <div className="sec">
      <h2>How M is built</h2>
      <p className="cap">Two matrices go in, both fixed before the match. Our move after each state is fixed too, so they turn into the 9 × 9 matrix M in three steps.</p>

      <h3 className="sub">P: their next move after each state</h3>
      <p className="cap">Counted from training rounds. Column s is their chance of throwing Rock, Paper or Scissors next, after state s. Each column sums to 1.</p>
      <div className="eq lm-eq">
        <span className="op lab">P =</span>
        <LMat rows={P} rowLabels={moves.map((m) => `Their ${m}`)} colLabels={tokens} from="after" label="P, the 3 by 9 matrix" />
      </div>

      <h3 className="sub">A: our score for each pair of moves</h3>
      <p className="cap">The rules of the game. Rows are our move, columns are theirs: +1 when we win, 0 for a tie, −1 when we lose.</p>
      <div className="eq lm-eq">
        <span className="op lab">A =</span>
        <LMat rows={bot.payoff.A} rowLabels={ourRows} colLabels={moves.map((m) => `Their ${m}`)} format={int} label="A, the payoff matrix" />
      </div>

      <h3 className="sub">Score every state at once: S = A P</h3>
      <p className="cap">Column s of S is A q for state s: the same score step as each round, done for all 9 states in one product. The largest entry in each column is filled in: that is the move we play.</p>
      <div className="eq lm-eq">
        <span className="op lab">S = A P =</span>
        <Mat rows={bot.payoff.A} format={int} />
        <LMat rows={P} rowLabels={moves} colLabels={tokens} col={j} label="P, the 3 by 9 matrix" />
      </div>
      <div className="eq lm-eq">
        <span className="op">=</span>
        <LMat rows={S} rowLabels={ourRows} colLabels={tokens} format={signed} col={j}
          cellClass={(v, r, c) => (B[r][c] === 1 ? "best" : undefined)} label="S, the score of each of our moves in each state" />
      </div>

      <h3 className="sub">Keep the largest entry: B</h3>
      <p className="cap">Column s of B has a 1 in the row of the move we play after state s. If two scores tie, we take the first in the order R, P, S.</p>
      <div className="eq lm-eq">
        <span className="op lab">B =</span>
        <LMat rows={B} rowLabels={ourRows} colLabels={tokens} format={int} col={j}
          cellClass={(v) => (v === 1 ? "best" : "z")} label="B, the move we play in each state" />
      </div>

      <h3 className="sub">Drop each column of P into M</h3>
      <p className="cap">After state s we always play the same move, so each move they throw next ends the round one way, and its chance lands in one row of M. Pick a column to follow:</p>
      <div className="pick" role="group" aria-label="Column to follow">
        {tokens.map((t) => <button key={t} aria-pressed={t === s} onClick={() => setS(t)}>{t}</button>)}
      </div>
      <div className="drop">
        <LMat rows={moves.map((_, i) => [P[i][j]])} rowLabels={moves} colLabels={[s]} label={`Column ${s} of P`} />
        <div className="rules">
          <p>After {s} we play <b>{NAME[ours]}</b>.</p>
          <ul>
            {moves.map((m, h) => {
              const i = tokens.findIndex((t, r) => t[0] === m && match.P[r][j] !== 0);
              return (
                <li key={m}>
                  <MoveIcon move={m} /> Their {NAME[m]}, <b>{fix(P[h][j])}</b>
                  {i >= 0 ? <>: {OUTCOME_WORD[tokens[i][1]]}, so row <b className={`tk ${OUTCOME_COLOUR[tokens[i][1]]}`}>{tokens[i]}</b></> : ": never thrown here"}
                </li>
              );
            })}
          </ul>
          <p className="cap">The other 6 entries of the column are 0.</p>
        </div>
        <LMat rows={mCol} rowLabels={tokens} colLabels={[s]} format={zeroAsInt} cellClass={mCell(tokens)} label={`Column ${s} of M`} />
      </div>
    </div>
  );
}

export function LongRun({ bot }) {
  const { match, tokens } = bot;
  const k = match.eigenvalue_one_multiplicity;
  const split = k > 1;
  const pi = match.stationary;
  const top = pi ? Math.max(...pi) : 1;
  const [s, setS] = useState(tokens[0]);
  return (
    <>
      <div className="lede"><h1>The long run</h1><p>The 9 × 9 matrix M for {bot.opponent ?? "your friend"} against this bot</p></div>
      <p className="intro">Round 1 has no previous state, so we start from the steady state π of M. These numbers are fixed before the match.</p>
      <Fallback bot={bot} />
      <Build bot={bot} s={s} setS={setS} />
      <div className="sec">
        <h2>The 9 × 9 matrix M</h2>
        <p className="cap" style={{ marginBottom: 18 }}>
          Column s is where the match goes after state s. Only 3 entries per column are nonzero, one for each move they can throw next, shaded by how that round ends for them. Each column sums to 1.
        </p>
        <LMat rows={match.P} rowLabels={tokens} colLabels={tokens} col={tokens.indexOf(s)} format={zeroAsInt} cellClass={mCell(tokens)} from="from" to="to"
          label="The 9 by 9 matrix M, columns are the state now, rows the state next" />
        <div className="key" style={{ marginTop: 14 }}>
          <span><i style={{ background: "var(--w)" }} />They win (…W)</span><span><i style={{ background: "var(--t)" }} />Tie (…T)</span><span><i style={{ background: "var(--l)" }} />They lose (…L)</span>
        </div>
      </div>
      <div className="sec">
        <h2>Eigenvalues of M, sorted by |λ|</h2>
        <p className="cap" style={{ marginBottom: 14 }}>
          Solved numerically from det(M − λI) = 0.{" "}
          {match.rounds_to_fade != null
            ? <>λ₂ sets how fast the start stops mattering: about <b>{match.rounds_to_fade}</b> rounds to fall below 10%.</>
            : "A second eigenvalue with |λ| = 1 means the start never stops mattering."}
        </p>
        <div className="eig">
          {match.eigenvalues.map((e, i) => {
            const unit = Math.abs(match.moduli[i] - 1) < 1e-9;
            const cls = i < k ? "one" : unit ? "cyc" : i === 1 && match.rounds_to_fade != null ? "two" : "";
            return <div key={i} className={cls}><b>{eigenLabel(e)}</b><span>|λ| {fix(match.moduli[i])}</span></div>;
          })}
        </div>
      </div>
      {split ? (
        <div className="sec">
          <h2>Closed groups</h2>
          <div className="grps">
            {match.closed_groups.map((g, i) => (
              <div className="grp" key={i}>
                <h3>Group {i + 1}</h3><p>States {g.join(", ")}</p>
                <Rates rates={match.group_outcome_rates[i]} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="sec">
          <h2>Steady state π</h2>
          <div className="pi">
            {pi.map((v, i) => (
              <div key={tokens[i]}>{fix(v)}<i style={{ height: `${(Math.max(v, 0) / top) * 180}px`, background: `var(--${OUTCOME_COLOUR[tokens[i][1]]})` }} /></div>
            ))}
          </div>
          <div className="pil">{tokens.map((t) => <span key={t}>{t}</span>)}</div>
          {match.outcome_rates && <Rates rates={match.outcome_rates} edge={match.edge} />}
          {match.transient_states.length > 0 && (
            <p className="cap" style={{ marginTop: 14 }}>Transient states (π = 0): {match.transient_states.join(", ")}. The long run never returns to them.</p>
          )}
        </div>
      )}
    </>
  );
}

export function Tally({ bot, history }) {
  const { moves } = bot;
  return (
    <>
      <div className="lede"><h1>Tally</h1><p>What we predicted against what they threw</p></div>
      <p className="intro">One chart per round: our q for that round. Their actual move is green, the other two are red.</p>
      <div className="tally">
        {history.length === 0 && <p className="empty-note">No rounds played yet.</p>}
        {history.map((r) => {
          const top = Math.max(...r.decision.q);
          return (
            <figure key={r.round}>
              <div className="vb">
                {r.decision.q.map((v, i) => (
                  <div key={moves[i]}>{fix(v)}<i style={{ height: `${(v / top) * 80}px`, background: moves[i] === r.humanMove ? "var(--w)" : "var(--l)" }} /></div>
                ))}
              </div>
              <div className="vl">{moves.map((m) => <span key={m}>{m}</span>)}</div>
              <figcaption>Round {r.round}: {NAME[r.humanMove]}</figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}
