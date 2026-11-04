import { Fallback, NAME, fix, signed } from "./ui.jsx";

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

// M in square brackets with "from" states across the top and "to" states down the side, in one grid so labels line up.
function Grid9({ rows, tokens }) {
  return (
    <div className="m9" role="table" aria-label="The 9 by 9 matrix M, columns are the state now, rows the state next">
      <span className="m9-from">from</span>
      <span className="m9-to">to</span>
      <span className="m9-brk" aria-hidden="true" />
      {tokens.map((t, j) => <span key={t} className="m9-col" role="columnheader" style={{ gridColumn: j + 4 }}>{t}</span>)}
      {rows.map((row, i) => (
        <div className="m9-row" role="row" key={tokens[i]}>
          <span className="m9-lbl" role="rowheader" style={{ gridRow: i + 3 }}>{tokens[i]}</span>
          {row.map((v, j) => (
            <span key={j} role="cell" style={{ gridRow: i + 3, gridColumn: j + 4 }}
              className={v === 0 ? "z" : `nz ${OUTCOME_COLOUR[tokens[i][1]]}`}>{v === 0 ? "0" : fix(v)}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LongRun({ bot }) {
  const { match, tokens } = bot;
  const k = match.eigenvalue_one_multiplicity;
  const split = k > 1;
  const pi = match.stationary;
  const top = pi ? Math.max(...pi) : 1;
  return (
    <>
      <div className="lede"><h1>The long run</h1><p>The 9 × 9 matrix M for {bot.opponent ?? "your friend"} against this bot</p></div>
      <p className="intro">Round 1 has no previous state, so we start from the steady state π of M. These numbers are fixed before the match.</p>
      <Fallback bot={bot} />
      <div className="sec">
        <h2>The 9 × 9 matrix M</h2>
        <p className="cap" style={{ marginBottom: 18 }}>
          Column s is where the match goes after state s. Only 3 entries per column are nonzero, one for each move they can throw next, shaded by how that round ends for them. Each column sums to 1.
        </p>
        <Grid9 rows={match.P} tokens={tokens} />
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

export function Policy({ bot }) {
  const { tokens, moves } = bot;
  const { S, B } = bot.policy;
  return (
    <>
      <div className="lede"><h1>Our policy</h1><p>S = A P scores every state at once</p></div>
      <p className="intro">Column s of S is A q for state s. The highlighted entry in each column is the move we play from that state; together they make the one-hot matrix B.</p>
      <table className="grid9 big">
        <thead><tr><th />{tokens.map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody>
          {S.map((row, i) => (
            <tr key={moves[i]}><th>Our {moves[i]}</th>{row.map((v, j) => <td key={j} className={B[i][j] === 1 ? "best" : undefined}>{signed(v)}</td>)}</tr>
          ))}
          <tr><th>We play</th>{tokens.map((t) => <td key={t}><b>{bot.decisions[t].move}</b></td>)}</tr>
        </tbody>
      </table>
    </>
  );
}

export function LookAhead() {
  return (
    <>
      <div className="lede"><h1>Look ahead</h1><p>Mᵗ x, step by step</p></div>
      <p className="empty-note">Not built yet: an animated bar chart of the 9 states settling towards π, capped at 100 steps.</p>
    </>
  );
}
