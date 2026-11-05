import { useEffect, useRef, useState } from "react";
import { connect, post, seatId } from "./net.js";
import { Card, MoveIcon, NAME, Sprites } from "./ui.jsx";

const MOVES = ["R", "P", "S"];
const NO_SERVER = "The guest screen needs the server: on the host laptop, run npm run host from web/.";

// The round's result from the guest's side; `outcome` is already the human's.
const TITLE = { win: "You win the round", lose: "The bot wins the round", tie: "Tie. The round is replayed" };

// The guest screen: the score, the round, three throws, the locked throw, the result and the match result.
// It only ever gets playerView, so it never has the bot's matrices, decision or move before the round plays.
export default function Player({ onLeave }) {
  const [id] = useState(() => seatId(sessionStorage));
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [failed, setFailed] = useState(null);
  // one claim per empty seat seen, so a burst of events does not post it twice; none once leaving,
  // or the "empty" event that leaving causes would take the seat straight back
  const claimed = useRef(false);
  const leaving = useRef(false);

  useEffect(() => {
    const conn = connect(`/api/events?role=player&seat=${encodeURIComponent(id)}`, setState);
    conn.onStatus = setStatus;
    return () => conn.close();
  }, [id]);

  useEffect(() => {
    if (state?.seat !== "empty") {
      claimed.current = false;
      return;
    }
    if (claimed.current || leaving.current) return;
    claimed.current = true;
    post("/api/player/claim", { seat: id }).catch((e) => setFailed(e.message));
  }, [state, id]);

  function send(path, body) {
    setFailed(null);
    return post(path, { seat: id, ...body }).catch((e) => setFailed(e.message));
  }

  async function leave() {
    leaving.current = true;
    if (state?.seat === "mine") await send("/api/player/leave", {});
    onLeave();
  }

  let body;
  if (status === "closed") body = <p className="g-note">{NO_SERVER}</p>;
  else if (!state) body = <p className="g-note">Connecting to the host…</p>;
  else if (state.seat === "taken") body = <p className="g-note">Someone else is playing. You get the seat when they leave or the host frees it.</p>;
  else if (state.seat === "empty") body = <p className="g-note">Taking the seat…</p>;
  else body = <Seat view={state.view} onThrow={(move) => send("/api/player/throw", { move })} />;

  return (
    <div className="guest-screen">
      <Sprites />
      <header className="g-top">
        <h1>Rock, paper, scissors</h1>
        <button className="ghost" onClick={leave}>Leave</button>
      </header>
      {status === "reconnecting" && <p className="banner" role="status">Reconnecting to the host…</p>}
      {failed && <p className="banner bad" role="alert">{failed}</p>}
      <main className="g-main">{body}</main>
    </div>
  );
}

function Seat({ view, onThrow }) {
  const { phase, thrown, tally, bestOf, last, winner } = view;
  // in "result" the game has moved on, so the round shown is the one just played
  const round = phase === "result" ? last.round : view.round;
  return (
    <>
      <div className="g-score" aria-label={`You ${tally.win}, the bot ${tally.lose}`}>
        <span>{tally.win}<small>You</small></span><span className="dash">–</span><span>{tally.lose}<small>The bot</small></span>
      </div>
      <p className="g-round">Round {round} · Best of {bestOf}</p>

      {phase === "open" && (
        <section className="g-step">
          <h2>Your throw</h2>
          <div className="opts">
            {MOVES.map((m) => (
              <button key={m} className="mv" onClick={() => onThrow(m)}><MoveIcon move={m} />{NAME[m]}</button>
            ))}
          </div>
        </section>
      )}

      {phase === "locked" && (
        <section className="g-step">
          <h2>You threw {NAME[thrown]}</h2>
          <div className="pair"><Card move={thrown} side="h" /></div>
          <p className="wait">Locked in. Waiting for the bot's move.</p>
        </section>
      )}

      {phase === "result" && (
        <section className="g-step result-g" aria-live="polite">
          <h2>{TITLE[last.outcome]}</h2>
          <div className="pair">
            <Card move={last.botMove} side="b" won={last.outcome === "lose"} />
            <Card move={last.humanMove} side="h" won={last.outcome === "win"} />
          </div>
          <p>The bot played {NAME[last.botMove]}, you played {NAME[last.humanMove]}.</p>
          {winner
            ? <p className="g-end">{winner === "human" ? `You win the match ${tally.win}–${tally.lose}.` : `The bot wins the match ${tally.lose}–${tally.win}.`}</p>
            : <p className="wait">Waiting for the host to start the next round.</p>}
        </section>
      )}
    </>
  );
}
