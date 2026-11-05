import { useCallback, useEffect, useState } from "react";
import { QBars, Score, Step } from "./RoundReport.jsx";
import { Card, Mat, MoveIcon, NAME, Vec, fix, signed } from "./ui.jsx";

const OUTCOME_COLOUR = { W: "w", L: "l", T: "t" };
const SUB = ["₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
// how many terms of the sum are written out before the ⋯
const SHOWN = 3;

const OUTCOME = { W: "won", L: "lost", T: "tied" };
// the first index of the largest entry, as the bot breaks ties (R, P, S order for moves)
const argmax = (v) => v.indexOf(Math.max(...v));
const told = (s) => `they threw ${NAME[s[0]]} and ${OUTCOME[s[1]]}`;

const isReal = ([, im]) => Math.abs(im) < 5e-4;

// A complex number [re, im] as text: a plain decimal when it is real, else a ± bi.
function cx(z) {
  if (isReal(z)) return fix(z[0]);
  return `${fix(z[0])} ${z[1] < 0 ? "−" : "+"} ${fix(Math.abs(z[1]))}i`;
}

// Text that rolls when it changes: the old value leaves and the new one arrives, up when stepping forward, down when back.
// Both are real values from the bot file; nothing in between is shown.
function Roll({ text, dir }) {
  const [s, setS] = useState({ cur: text, prev: null, n: 0, dir: null });
  if (s.cur !== text) setS({ cur: text, prev: s.cur, n: s.n + 1, dir });
  const d = s.n > 0 && s.dir ? ` ${s.dir}` : "";
  return (
    <span className="roll">
      {s.prev != null && <span key={`o${s.n}`} className={`out${d}`} aria-hidden="true">{s.prev}</span>}
      <span key={`i${s.n}`} className={`in${d}`}>{s.cur}</span>
    </span>
  );
}

// A sum of scalar-times-vector terms in one grid, so every vector's 9 rows line up with the state labels on the left.
// `bar(i)` adds a cell after the last term on row i; `barHead` heads that column.
function Terms({ tokens, lhs, terms, tail, bar, barHead, label, hlRow = -1 }) {
  const n = tokens.length;
  const span = `2 / ${n + 4}`;
  const row = (i) => i + 3;
  const cells = tokens.map((t, i) => <span key={`l${t}`} className="tm-lbl" style={{ gridColumn: 1, gridRow: row(i) }}>{t}</span>);
  if (hlRow >= 0) cells.unshift(<span key="band" className="tm-band" aria-hidden="true" style={{ gridColumn: "1 / -1", gridRow: row(hlRow) }} />);
  cells.push(<span key="lhs" className="tm-op tm-lhs" style={{ gridColumn: 2, gridRow: span }}>{lhs}</span>);
  terms.forEach((term, k) => {
    const c = 3 + k * 5;
    if (term.scalar) cells.push(<span key={`s${k}`} className="tm-op" style={{ gridColumn: c, gridRow: span }}>{term.scalar}</span>);
    if (term.head) cells.push(<span key={`h${k}`} className="tm-head" style={{ gridColumn: `${c + 1} / ${c + 4}` }}>{term.head}</span>);
    cells.push(<span key={`b${k}`} className="tm-brk" aria-hidden="true" style={{ gridColumn: `${c + 1} / ${c + 4}`, gridRow: span }} />);
    term.values.forEach((v, i) => cells.push(<span key={`v${k}-${i}`} className="tm-v" style={{ gridColumn: c + 2, gridRow: row(i) }}>{v}</span>));
    const op = k < terms.length - 1 ? "+" : tail;
    if (op) cells.push(<span key={`o${k}`} className="tm-op" style={{ gridColumn: c + 4, gridRow: span }}>{op}</span>);
  });
  const barCol = 3 + terms.length * 5;
  if (bar) {
    if (barHead) cells.push(<span key="bh" className="tm-head tm-bh" style={{ gridColumn: barCol }}>{barHead}</span>);
    tokens.forEach((t, i) => cells.push(<span key={`r${t}`} className="tm-bar" style={{ gridColumn: barCol, gridRow: row(i) }}>{bar(i)}</span>));
  }
  const cols = `auto auto ${"auto 12px auto 12px auto ".repeat(terms.length)}${bar ? "minmax(240px, 440px)" : ""}`;
  return (
    <div className="tm" role="img" aria-label={label} style={{ gridTemplateColumns: cols, gridTemplateRows: `auto 6px repeat(${n}, auto) 6px` }}>
      {cells}
    </div>
  );
}

function Pow({ base, t, dir }) {
  return <span className="pw">({base})<sup><Roll text={String(t)} dir={dir} /></sup></span>;
}

const M = ({ t, dir }) => <><var>M</var><sup>{t == null ? <var>t</var> : <Roll text={String(t)} dir={dir} />}</sup><var>x</var></>;

// Mᵗ x for a one-hot x, as a sum over the eigenvectors of M, then the numbers, then the vector and its chart.
// Every number is read from the bot file (look_ahead, eigenvalues, eigenvectors, coefficients); only t is chosen here.
export default function LookAhead({ bot, state }) {
  const { tokens, moves, match } = bot;
  const [from, setFrom] = useState(state ?? tokens[0]);
  const [view, setView] = useState({ t: 0, dir: null });
  const run = bot.look_ahead[from];
  const last = run.stopped_at;
  const t = Math.min(view.t, last);
  const { dir } = view;
  const pi = match.stationary;
  const V = match.eigenvectors ?? null;
  const c = run.coefficients ?? null;
  const lam = match.eigenvalues;
  const row = run.rows[t];
  const d = run.decisions?.[t] ?? null;
  const top = argmax(row);
  const piTop = pi ? argmax(pi) : -1;
  const likely = d ? argmax(d.q) : -1;

  const step = useCallback((d) => setView((v) => {
    const next = Math.max(0, Math.min(last, v.t + d));
    return next === v.t ? v : { t: next, dir: d > 0 ? "up" : "down" };
  }), [last]);

  useEffect(() => {
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  function pick(s) {
    setFrom(s);
    setView({ t: 0, dir: null });
  }

  const shown = Math.min(SHOWN, lam.length);
  const rest = lam.length > shown ? match.moduli[shown] : null;
  const ends = last >= 100 ? "Stopped at the 100-step cap." : "Settled: one more step moves the vector by less than 0.01 in total.";

  return (
    <>
      <div className="lede"><h1>Look ahead</h1><p>Where the match is <b>t</b> rounds after {from}</p></div>
      <p className="intro">
        x is one-hot for the state we start from. Mᵗ x is the chance of each of the 9 states t rounds later.
      </p>

      <div className="la-from">
        <span>Start from</span>
        <div className="pick" role="group" aria-label="State to start from">
          {tokens.map((s) => (
            <button key={s} aria-pressed={s === from} onClick={() => pick(s)}>
              {s}{s === state && <small>now</small>}
            </button>
          ))}
        </div>
      </div>
      {state == null && <p className="cap">Round 1 starts from π, which M leaves where it is (M π = π). Pick a state to follow instead.</p>}

      <div className="sec">
        <h2>The formula</h2>
        <div className="fx">
          <span className="fl"><var>x</var></span><span>=</span>
          <span><var>c</var>₁<var>v</var>₁ + <var>c</var>₂<var>v</var>₂ + <var>c</var>₃<var>v</var>₃ + ⋯ + <var>c</var>₉<var>v</var>₉</span>
          <span className="gl">Write x as a combination of the 9 eigenvectors of M.</span>

          <span className="fl"><var>M</var> <var>v</var><sub><var>i</var></sub></span><span>=</span>
          <span><var>λ</var><sub><var>i</var></sub> <var>v</var><sub><var>i</var></sub></span>
          <span className="gl">M only stretches an eigenvector, by its eigenvalue.</span>

          <span className="fl"><M /></span><span>=</span>
          <span><var>c</var>₁<var>λ</var>₁<sup><var>t</var></sup><var>v</var>₁ + <var>c</var>₂<var>λ</var>₂<sup><var>t</var></sup><var>v</var>₂ + <var>c</var>₃<var>λ</var>₃<sup><var>t</var></sup><var>v</var>₃ + ⋯</span>
          <span className="gl">
            So t steps stretch each part by λᵗ. They are sorted by |λ|: λ₁ = 1 stays{pi && <>, and c₁v₁ = π</>}
            {rest != null && <>; the parts after the third have |λ| ≤ {fix(rest)}, so they shrink fastest</>}.
          </span>
        </div>
      </div>

      <div className="la-steps" role="group" aria-label="Number of steps t">
        <button className="stp" onClick={() => step(-1)} disabled={t === 0} aria-label="One step back">
          <svg aria-hidden="true"><use href="#chev" /></svg>
        </button>
        <div className="tnow" aria-live="polite"><var>t</var> = <b><Roll text={String(t)} dir={dir} /></b><small>of {last}</small></div>
        <button className="stp fwd" onClick={() => step(1)} disabled={t === last} aria-label="One step forward">
          <svg aria-hidden="true"><use href="#chev" /></svg>
        </button>
        <p>{t === last ? ends : "The ← and → keys step too."}</p>
      </div>

      <div className="sec">
        <h2>With the numbers</h2>
        {V && c ? (
          <>
            <p className="cap">The first {shown} eigenvalues and eigenvectors of M, and the weights c that build x = {from}.</p>
            <div className="la-scroll">
              <Terms tokens={tokens} lhs={<><M t={t} dir={dir} /> =</>} tail="+ ⋯"
                label={`M to the ${t} times x, as the first ${shown} terms of the eigenvector sum`}
                terms={Array.from({ length: shown }, (_, k) => {
                  const ck = isReal(c[k]) ? cx(c[k]) : `(${cx(c[k])})`;
                  return {
                    head: <><var>v</var>{SUB[k]}{k === 0 && pi && <> = π</>}</>,
                    scalar: <>{ck} <Pow base={cx(lam[k])} t={t} dir={dir} /></>,
                    values: V[k].map(cx),
                  };
                })} />
            </div>
          </>
        ) : (
          <p className="cap">M has no full set of 9 eigenvectors, so x cannot be written as a combination of them. The vector below is still M multiplied by x, t times.</p>
        )}
      </div>

      <div className="sec">
        <h2>The answer</h2>
        <p className="la-read" aria-live="polite">
          {t === 0
            ? <>At t = 0 the match is in <b>{from}</b> for sure: {told(from)}.</>
            : <>After {t} round{t === 1 ? "" : "s"} from {from}, the likeliest state is <b>{tokens[top]}</b> ({fix(row[top])}): {told(tokens[top])}.</>}
          {piTop >= 0 && <> In the long run (π) it is <b>{tokens[piTop]}</b> ({fix(pi[piTop])}): {told(tokens[piTop])}.</>}
        </p>
        <div className="la-ans">
          <div>
            <div className="la-scroll">
              <Terms tokens={tokens} lhs={<><M t={t} dir={dir} /> =</>} hlRow={top}
                label={`M to the ${t} times x`}
                terms={[{ values: row.map((v, i) => <Roll key={tokens[i]} text={fix(v)} dir={dir} />) }]}
                barHead={<>Chance of each state{pi && <span className="la-key"><i />π, the long run</span>}</>}
                bar={(i) => (
                  <>
                    <i className={OUTCOME_COLOUR[tokens[i][1]]} style={{ transform: `scaleX(${Math.max(0, Math.min(1, row[i]))})` }} />
                    {pi && <b style={{ left: `${Math.max(0, pi[i]) * 100}%` }} />}
                  </>
                )} />
            </div>
            <div className="key" style={{ marginTop: 16 }}>
              <span><i style={{ background: "var(--w)" }} />They win (…W)</span><span><i style={{ background: "var(--t)" }} />Tie (…T)</span><span><i style={{ background: "var(--l)" }} />They lose (…L)</span>
            </div>
          </div>
          {d && (
            <aside className="la-next" aria-live="polite">
              <h3>The round after</h3>
              <p className="cap">Knowing only Mᵗ x, not the exact state.</p>
              <div className="pair">
                <figure>
                  <Card move={moves[likely]} side="h" />
                  <figcaption>They likely throw<b>{NAME[moves[likely]]}</b>{fix(d.q[likely])}</figcaption>
                </figure>
                <figure>
                  <Card move={d.move} side="b" won />
                  <figcaption>We play<b>{NAME[d.move]}</b>scores {signed(d.expected_score)}</figcaption>
                </figure>
              </div>
            </aside>
          )}
        </div>
      </div>

      {d && (
        <details className="sec report">
          <summary>
            <h2>Why that move<em>Predict, Score, Choose</em></h2>
            <svg className="chev" aria-hidden="true"><use href="#chev" /></svg>
          </summary>
          <p className="cap">The same three steps as each round, with Mᵗ x in place of a one-hot x.</p>
          <Step n={1} title="Predict" formula="q = P Mᵗ x">
            <p>We only know the state as the chances in Mᵗ x, so q mixes the 9 columns of P, each weighted by its chance.</p>
            <div className="eq">
              <span className="lab">q =</span>
              <span className="mstack">
                <span className="collbl">{tokens.map((s) => <span key={s}>{s}</span>)}</span>
                <Mat rows={bot.outcome.P} />
              </span>
              <Vec values={row} /> = <Vec values={d.q} />
            </div>
            <QBars q={d.q} moves={moves} />
          </Step>
          <Score bot={bot} decision={d} />
          <Step n={3} title="Choose" formula="the largest entry of A q">
            <p>Pick the row of A q with the largest score. If two tie, take the first in the order R, P, S.</p>
            <div className="opts">
              {moves.map((m, i) => (
                <div key={m} className={`mv${m === d.move ? " yes" : ""}`}>
                  <MoveIcon move={m} />{NAME[m]} <span className="la-sc">{signed(d.scores[i])}</span>
                </div>
              ))}
            </div>
            <p className="fb">Play {NAME[d.move]}: it scores {signed(d.expected_score)}, the largest entry.</p>
            {d.move !== d.counter_move && (
              <p className="flag">Note: countering their likeliest move would mean playing {NAME[d.counter_move]}.</p>
            )}
          </Step>
        </details>
      )}
    </>
  );
}
