// Shared pieces of the projector: number formats, notation, move icons, cards and the two characters.

export const NAME = { R: "Rock", P: "Paper", S: "Scissors" };

// 3 decimals with a true minus sign; values that round to zero lose their sign.
export function fix(v) {
  return (v < 0 && Math.abs(v) >= 5e-4 ? "−" : "") + Math.abs(v).toFixed(3);
}

// Like fix, with a + on positive values: for scores.
export function signed(v) {
  return (v >= 5e-4 ? "+" : "") + fix(v);
}

// Payoff entries are the integers +1, 0 and −1.
export function int(v) {
  return v < 0 ? `−${-v}` : String(v);
}

// A column vector in square brackets; `hl` marks one entry.
export function Vec({ values, format = fix, hl = -1 }) {
  return (
    <span className="vec">
      {values.map((v, i) => <span key={i} className={i === hl ? "hl" : undefined}>{format(v)}</span>)}
    </span>
  );
}

// A matrix in square brackets; `col` highlights one column.
export function Mat({ rows, format = fix, col = -1 }) {
  return (
    <span className="mat" style={{ gridTemplateColumns: `repeat(${rows[0].length}, auto)` }}>
      {rows.flatMap((row, i) => row.map((v, j) => (
        <span key={`${i}-${j}`} className={j === col ? "hl" : undefined}>{format(v)}</span>
      )))}
    </span>
  );
}

// A matrix in square brackets with column labels across the top and row labels down the side, in one grid so labels line up.
// `col` shades one column; `cellClass(v, i, j)` styles single entries; `from`/`to` name the two axes.
export function LMat({ rows, rowLabels, colLabels, format = fix, cellClass, col = -1, from, to, label }) {
  const m = rows.length, n = rows[0].length;
  return (
    <div className="lm" role="table" aria-label={label}
      style={{ gridTemplateColumns: `auto auto 12px repeat(${n}, minmax(4.4ch, auto)) 12px`, gridTemplateRows: `auto 6px repeat(${m}, auto) 6px` }}>
      {from && <span className="lm-from">{from}</span>}
      {to && <span className="lm-to" style={{ gridRow: `3 / ${m + 3}` }}>{to}</span>}
      {col >= 0 && <span className="lm-band" aria-hidden="true" style={{ gridColumn: col + 4, gridRow: `1 / ${m + 4}` }} />}
      <span className="lm-brk" aria-hidden="true" style={{ gridColumn: `3 / ${n + 5}`, gridRow: `2 / ${m + 4}` }} />
      <div className="lm-row" role="row">
        {colLabels.map((c, j) => <span key={j} className={`lm-col${j === col ? " on" : ""}`} role="columnheader" style={{ gridColumn: j + 4 }}>{c}</span>)}
      </div>
      {rows.map((row, i) => (
        <div className="lm-row" role="row" key={i}>
          <span className="lm-lbl" role="rowheader" style={{ gridRow: i + 3 }}>{rowLabels[i]}</span>
          {row.map((v, j) => (
            <span key={j} role="cell" style={{ gridRow: i + 3, gridColumn: j + 4 }} className={cellClass?.(v, i, j)}>{format(v)}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MoveIcon({ move, className = "" }) {
  return <svg className={`ic m${move} ${className}`} aria-hidden="true"><use href={`#m${move}`} /></svg>;
}

export function Card({ move, side, won }) {
  return (
    <div className={`crd ${side}${won ? " won" : ""}`}>
      <MoveIcon move={move} />{NAME[move]}
    </div>
  );
}

// One banner for both fallback cases, read from the bot's flags; null when π is usable.
export function Fallback({ bot }) {
  const { match } = bot;
  const k = match.eigenvalue_one_multiplicity;
  let title, text;
  if (k > 1) {
    title = `Eigenvalue 1 appears ${k} times, so the chain splits into ${k} closed groups.`;
    text = "There is no single steady state: the long run depends on where the game starts.";
  } else if (match.has_unit_cycle) {
    title = "An eigenvalue other than 1 has |λ| = 1, so the chain cycles and never settles.";
    text = "π is still unique, as the share of each state averaged over rounds, but Mᵗ x keeps cycling instead of settling on it.";
  } else return null;
  return (
    <div className="warn" role="status">
      <svg aria-hidden="true"><use href="#warn" /></svg>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <span className="tagline">Round 1 uses the 3&nbsp;×&nbsp;3 steady state instead</span>
      </div>
    </div>
  );
}

export function Sprites() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="robot" viewBox="0 0 200 200">
          <line className="rb-ant" x1="100" y1="42" x2="100" y2="22" /><circle className="rb-bulb" cx="100" cy="16" r="8" />
          <rect className="rb-ear" x="24" y="72" width="16" height="38" rx="7" /><rect className="rb-ear" x="160" y="72" width="16" height="38" rx="7" />
          <rect className="rb-neck" x="86" y="136" width="28" height="16" rx="4" />
          <path className="rb-body" d="M46 204V176c0-17 12-28 30-28h48c18 0 30 11 30 28v28z" />
          <rect className="rb-head" x="36" y="38" width="128" height="102" rx="32" /><rect className="rb-screen" x="52" y="56" width="96" height="64" rx="22" />
          <ellipse className="rb-eye" cx="79" cy="85" rx="8.5" ry="11" /><ellipse className="rb-eye" cx="121" cy="85" rx="8.5" ry="11" />
          <circle className="rb-shine" cx="82" cy="80" r="2.6" /><circle className="rb-shine" cx="124" cy="80" r="2.6" />
          <path className="rb-mouth" d="M91 104q9 7 18 0" /><circle className="rb-cheek" cx="64" cy="104" r="5" /><circle className="rb-cheek" cx="136" cy="104" r="5" />
          <path className="rb-tie" d="M100 162 80 151v22zM100 162l20-11v22z" /><circle className="rb-tie" cx="100" cy="162" r="5.5" />
          <circle className="rb-dot" cx="86" cy="188" r="3.5" /><circle className="rb-dot" cx="100" cy="188" r="3.5" /><circle className="rb-dot" cx="114" cy="188" r="3.5" />
        </symbol>
        <symbol id="human" viewBox="0 0 200 200">
          <rect className="hu-neck" x="89" y="122" width="22" height="28" rx="6" />
          <path className="hu-jacket" d="M40 204v-24c0-22 16-34 40-36h40c24 2 40 14 40 36v24z" />
          <path className="hu-shirt" d="M82 144h36l-18 38z" /><path className="hu-tie" d="M100 150l-6 7 6 24 6-24z" />
          <path className="hu-lapel" d="M82 144l18 38-11 6-15-38zM118 144l-18 38 11 6 15-38z" />
          <circle className="hu-skin" cx="57" cy="94" r="9" /><circle className="hu-skin" cx="143" cy="94" r="9" /><circle className="hu-skin" cx="100" cy="88" r="44" />
          <path className="hu-hair" d="M55 92c-4-34 18-56 46-56 29 0 50 20 46 54-5-11-9-19-16-25-16 11-42 15-64 9-6 5-10 11-12 18z" />
          <ellipse className="hu-eye" cx="84" cy="96" rx="4.6" ry="6" /><ellipse className="hu-eye" cx="116" cy="96" rx="4.6" ry="6" />
          <circle className="hu-cheek" cx="72" cy="110" r="6" /><circle className="hu-cheek" cx="128" cy="110" r="6" /><path className="hu-smile" d="M92 112q8 7 16 0" />
        </symbol>
        <symbol id="nobody" viewBox="0 0 200 200"><circle className="nb" cx="100" cy="88" r="44" /><path className="nb" d="M40 202v-22c0-22 16-34 40-36h40c24 2 40 14 40 36v22" /></symbol>
        <symbol id="mR" viewBox="0 0 48 48"><path d="M8 31c-2-10 6-19 17-19s18 8 16 18c-1 8-9 11-16 11-9 0-16-3-17-10z" /></symbol>
        <symbol id="mP" viewBox="0 0 48 48"><path d="M11 5h20l9 9v29H11z" /><path d="M31 5v9h9" fill="#fff" opacity=".45" /></symbol>
        <symbol id="mS" viewBox="0 0 48 48"><g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round"><circle cx="14" cy="35" r="6.5" /><circle cx="34" cy="35" r="6.5" /><path d="M18 30 35 6M30 30 13 6" /></g></symbol>
        <symbol id="warn" viewBox="0 0 40 40"><path d="M20 4 37 34H3z" fill="#20232b" stroke="#20232b" strokeWidth="3" strokeLinejoin="round" /><path d="M20 14v10" stroke="#fff3c9" strokeWidth="3.5" strokeLinecap="round" /><circle cx="20" cy="29" r="2.2" fill="#fff3c9" /></symbol>
        <symbol id="chev" viewBox="0 0 24 24"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      </defs>
    </svg>
  );
}
