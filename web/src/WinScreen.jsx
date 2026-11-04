import { useEffect, useRef } from "react";

// The end of a match: the winner on the podium under the lights, the loser on the floor below, confetti over both.

const CONFETTI = ["#c24b3a", "#3462ad", "#d39b22", "#2f7b55", "#a6f0c6", "#fff3c9", "#fbfbf8", "#f4b0a6"];

function makePiece(x, y, vx, vy) {
  const roll = Math.random();
  return {
    x, y, vx, vy,
    angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.3,
    flip: Math.random() * 6.28, flipSpeed: 0.06 + Math.random() * 0.12,
    size: 8 + Math.random() * 8,
    colour: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    shape: roll < 0.18 ? "dot" : roll < 0.4 ? "ribbon" : "rect",
  };
}

function drawPiece(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // squash on one axis as it tumbles, so flat paper seems to turn over
  ctx.scale(1, Math.cos(p.flip));
  ctx.fillStyle = p.colour;
  ctx.strokeStyle = p.colour;
  if (p.shape === "dot") {
    ctx.beginPath();
    ctx.arc(0, 0, p.size * 0.32, 0, 6.28);
    ctx.fill();
  } else if (p.shape === "ribbon") {
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-p.size, 0);
    ctx.bezierCurveTo(-p.size / 3, -p.size * 0.7, p.size / 3, p.size * 0.7, p.size, 0);
    ctx.stroke();
  } else {
    ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
  }
  ctx.restore();
}

// Canvas confetti: two cannons from the floor corners, then a steady fall. Returns a burst(x, y) for extra volleys.
function useConfetti(ref) {
  const burst = useRef(() => {});
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0;
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();

    const bits = [];
    // scale speeds to the screen so the cannons reach the same height on a laptop and a projector
    const k = () => h / 900;

    if (still) {
      for (let i = 0; i < 140; i++) drawPiece(ctx, makePiece(Math.random() * w, Math.random() * h * 0.7, 0, 0));
      return undefined;
    }

    function cannon(left, count) {
      for (let i = 0; i < count; i++) {
        const deg = (left ? -62 : -118) + (Math.random() - 0.5) * 34;
        const speed = (16 + Math.random() * 14) * k();
        const rad = (deg * Math.PI) / 180;
        bits.push(makePiece(left ? -10 : w + 10, h * 0.86, Math.cos(rad) * speed, Math.sin(rad) * speed));
      }
    }
    function rain(count) {
      for (let i = 0; i < count; i++) bits.push(makePiece(Math.random() * w, -20, (Math.random() - 0.5) * 2, 1 + Math.random() * 2));
    }
    burst.current = (x, y) => {
      for (let i = 0; i < 70; i++) {
        const rad = Math.random() * 6.28;
        const speed = (6 + Math.random() * 12) * k();
        bits.push(makePiece(x, y, Math.cos(rad) * speed, Math.sin(rad) * speed - 6 * k()));
      }
    };

    // [ms after opening, what happens]: the first volley lands with the champion
    const schedule = [[950, () => { cannon(true, 110); cannon(false, 110); }], [1700, () => { cannon(true, 60); cannon(false, 60); }]];
    const start = performance.now();
    let last = start, frame = 0, carry = 0;
    function tick(now) {
      const dt = Math.min((now - last) / 16.7, 3);
      last = now;
      const t = now - start;
      while (schedule.length && schedule[0][0] <= t) schedule.shift()[1]();
      // heavy at first, then a gentle fall that never quite stops
      carry += (t < 2000 ? 0 : t < 7000 ? 2.2 : 0.5) * dt;
      if (carry >= 1 && bits.length < 600) { rain(Math.floor(carry)); }
      carry %= 1;

      ctx.clearRect(0, 0, w, h);
      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i];
        p.vy += 0.32 * k() * dt;
        p.vx *= 0.986 ** dt;
        p.vy *= 0.986 ** dt;
        // past the top of its arc a piece flutters down instead of dropping
        if (p.vy > 3.4 * k()) p.vy = 3.4 * k();
        p.x += (p.vx + Math.sin(p.flip) * 0.7) * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        if (p.y > h + 40 || p.x < -80 || p.x > w + 80) bits.splice(i, 1);
        else drawPiece(ctx, p);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", size);
      burst.current = () => {};
    };
  }, [ref]);
  return burst;
}

function Sparkle({ className }) {
  return <svg className={`spk ${className}`} viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10z" /></svg>;
}

function RobotHappy() {
  return (
    <svg className="fig" viewBox="-14 -6 228 210" aria-hidden="true">
      <g className="arm l"><path className="rb-arm" d="M58 170 22 76" /><circle className="rb-hand" cx="22" cy="72" r="13" /></g>
      <g className="arm r"><path className="rb-arm" d="M142 170 178 76" /><circle className="rb-hand" cx="178" cy="72" r="13" /></g>
      <line className="rb-ant" x1="100" y1="42" x2="100" y2="22" /><circle className="rb-bulb on" cx="100" cy="16" r="8" />
      <rect className="rb-ear" x="24" y="72" width="16" height="38" rx="7" /><rect className="rb-ear" x="160" y="72" width="16" height="38" rx="7" />
      <rect className="rb-neck" x="86" y="136" width="28" height="16" rx="4" />
      <path className="rb-body" d="M46 204V176c0-17 12-28 30-28h48c18 0 30 11 30 28v28z" />
      <rect className="rb-head" x="36" y="38" width="128" height="102" rx="32" /><rect className="rb-screen" x="52" y="56" width="96" height="64" rx="22" />
      <path className="rb-joy" d="M69 90q10-14 20 0M111 90q10-14 20 0" />
      <path className="rb-grin" d="M84 99h32q0 15-16 15t-16-15z" />
      <circle className="rb-cheek" cx="64" cy="106" r="5" /><circle className="rb-cheek" cx="136" cy="106" r="5" />
      <g className="medal">
        <path className="md-a" d="M84 149l16 26 7-4-14-24z" /><path className="md-b" d="M116 149l-16 26-7-4 14-24z" />
        <circle className="md-c" cx="100" cy="182" r="14" /><text className="md-t" x="100" y="188.5">1</text>
      </g>
    </svg>
  );
}

function RobotSad() {
  return (
    <svg className="fig" viewBox="0 -6 200 210" aria-hidden="true">
      <path className="rb-ant" d="M100 42q0-14 12-20" fill="none" /><circle className="rb-bulb off" cx="115" cy="19" r="7" />
      <rect className="rb-ear" x="24" y="72" width="16" height="38" rx="7" /><rect className="rb-ear" x="160" y="72" width="16" height="38" rx="7" />
      <rect className="rb-neck" x="86" y="136" width="28" height="16" rx="4" />
      <path className="rb-body" d="M46 204V176c0-17 12-28 30-28h48c18 0 30 11 30 28v28z" />
      <rect className="rb-head" x="36" y="38" width="128" height="102" rx="32" /><rect className="rb-screen" x="52" y="56" width="96" height="64" rx="22" />
      <path className="rb-brow" d="M68 80l16-6M132 80l-16-6" />
      <ellipse className="rb-eye" cx="78" cy="92" rx="7" ry="8.5" /><ellipse className="rb-eye" cx="122" cy="92" rx="7" ry="8.5" />
      <path className="rb-mouth" d="M90 112q10-8 20 0" />
      <path className="tear rb-tear" d="M77 101q-4 6 0 9 4-3 0-9z" />
      <path className="rb-tie" d="M100 162 80 151v22zM100 162l20-11v22z" /><circle className="rb-tie" cx="100" cy="162" r="5.5" />
    </svg>
  );
}

function HumanHappy() {
  return (
    <svg className="fig" viewBox="-14 -6 228 210" aria-hidden="true">
      <g className="arm l"><path className="hu-sleeve" d="M56 168 24 92" /><circle className="hu-skin" cx="22" cy="84" r="11" /></g>
      <g className="arm r"><path className="hu-sleeve" d="M144 168 176 92" /><circle className="hu-skin" cx="178" cy="84" r="11" /></g>
      <rect className="hu-neck" x="89" y="122" width="22" height="28" rx="6" />
      <path className="hu-jacket" d="M40 204v-24c0-22 16-34 40-36h40c24 2 40 14 40 36v24z" />
      <path className="hu-shirt" d="M82 144h36l-18 38z" /><path className="hu-tie" d="M100 150l-6 7 6 24 6-24z" />
      <path className="hu-lapel" d="M82 144l18 38-11 6-15-38zM118 144l-18 38 11 6 15-38z" />
      <circle className="hu-skin" cx="57" cy="94" r="9" /><circle className="hu-skin" cx="143" cy="94" r="9" /><circle className="hu-skin" cx="100" cy="88" r="44" />
      <path className="hu-hair" d="M55 92c-4-34 18-56 46-56 29 0 50 20 46 54-5-11-9-19-16-25-16 11-42 15-64 9-6 5-10 11-12 18z" />
      <path className="hu-joy" d="M77 97q7-9 14 0M109 97q7-9 14 0" />
      <circle className="hu-cheek" cx="72" cy="110" r="6" /><circle className="hu-cheek" cx="128" cy="110" r="6" />
      <path className="hu-grin" d="M88 108h24q0 16-12 16t-12-16z" />
      <g className="medal">
        <path className="md-a" d="M84 146l16 26 7-4-14-24z" /><path className="md-b" d="M116 146l-16 26-7-4 14-24z" />
        <circle className="md-c" cx="100" cy="182" r="14" /><text className="md-t" x="100" y="188.5">1</text>
      </g>
    </svg>
  );
}

function HumanSad() {
  return (
    <svg className="fig" viewBox="0 -6 200 210" aria-hidden="true">
      <rect className="hu-neck" x="89" y="122" width="22" height="28" rx="6" />
      <path className="hu-jacket" d="M40 204v-24c0-22 16-34 40-36h40c24 2 40 14 40 36v24z" />
      <path className="hu-shirt" d="M82 144h36l-18 38z" /><path className="hu-tie" d="M100 150l-6 7 6 24 6-24z" />
      <path className="hu-lapel" d="M82 144l18 38-11 6-15-38zM118 144l-18 38 11 6 15-38z" />
      <g className="slump">
        <circle className="hu-skin" cx="57" cy="96" r="9" /><circle className="hu-skin" cx="143" cy="96" r="9" /><circle className="hu-skin" cx="100" cy="90" r="44" />
        <path className="hu-hair" d="M55 94c-4-34 18-56 46-56 29 0 50 20 46 54-5-11-9-19-16-25-16 11-42 15-64 9-6 5-10 11-12 18z" />
        <path className="hu-brow" d="M73 88l16-5M127 88l-16-5" />
        <ellipse className="hu-eye" cx="84" cy="101" rx="4.4" ry="5" /><ellipse className="hu-eye" cx="116" cy="101" rx="4.4" ry="5" />
        <path className="hu-smile" d="M91 120q9-7 18 0" />
        <path className="tear hu-tear" d="M84 108q-5 7 0 11 5-4 0-11z" />
      </g>
    </svg>
  );
}

function Cloud() {
  return (
    <svg className="cloud" viewBox="0 0 120 90" aria-hidden="true">
      <g className="drops"><path d="M34 52v12" /><path d="M54 56v12" /><path d="M74 52v12" /><path d="M92 56v12" /></g>
      <path className="puff" d="M28 54a16 16 0 0 1 2-32 22 22 0 0 1 40-8 18 18 0 0 1 30 12 14 14 0 0 1-2 28z" />
    </svg>
  );
}

export default function WinScreen({ winner, name, tally, bestOf, rounds, onMain, onPlay }) {
  const canvas = useRef(null);
  const first = useRef(null);
  const burst = useConfetti(canvas);
  const botWon = winner === "bot";
  const winnerName = botWon ? "The Bot" : name;
  const loserName = botWon ? name : "The Bot";
  const ties = tally.tie;

  useEffect(() => {
    first.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === "Escape") onMain(); };
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onMain]);

  function cheer(e) {
    const box = e.currentTarget.getBoundingClientRect();
    burst.current(box.left + box.width / 2, box.top + box.height * 0.3);
  }

  return (
    <div className={`win ${botWon ? "bot-won" : "hum-won"}`} role="dialog" aria-modal="true" aria-labelledby="win-title">
      <div className="beams" aria-hidden="true"><i /><i /></div>
      <div className="pool" aria-hidden="true" />
      <header className="win-head">
        <h1 id="win-title">{botWon ? <>The Bot <span>wins!</span></> : <>{name} <span>wins!</span></>}</h1>
        <p>
          <b>{botWon ? tally.lose : tally.win}–{botWon ? tally.win : tally.lose}</b> in a best of {bestOf}
          {" · "}{rounds} {rounds === 1 ? "round" : "rounds"}{ties > 0 && `, ${ties} ${ties === 1 ? "tie" : "ties"} replayed`}
        </p>
      </header>

      <div className="stage">
        <div className="champ-col">
          <button className="champ" onClick={cheer} aria-label={`${winnerName}: throw more confetti`}>
            <Sparkle className="s1" /><Sparkle className="s2" /><Sparkle className="s3" /><Sparkle className="s4" />
            {botWon ? <RobotHappy /> : <HumanHappy />}
          </button>
          <div className="podium">
            <span className="place">1</span>
            <span className="who">{winnerName}</span>
          </div>
        </div>
        <div className="loser">
          <p className="bubble">{botWon ? "Beaten by a matrix…" : "Recalculating…"}</p>
          <Cloud />
          {botWon ? <HumanSad /> : <RobotSad />}
          <span className="who">{loserName}</span>
        </div>
      </div>

      <div className="floor">
        <div className="acts">
          <button ref={first} className="go" onClick={() => onPlay(3)}>Play again: best of 3</button>
          <button className="go" onClick={() => onPlay(5)}>Play again: best of 5</button>
          <button className="back" onClick={onMain}>Back to main page</button>
        </div>
      </div>
      <canvas ref={canvas} className="confetti" aria-hidden="true" />
    </div>
  );
}
