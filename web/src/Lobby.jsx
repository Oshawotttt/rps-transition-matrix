import { useEffect, useState } from "react";
import { getJson, post } from "./net.js";
import { Sprites } from "./ui.jsx";

const POOLED = "bot_rps_human_combined.json";

// A bot file's name in the picker: the pooled default by name, any other file as it is.
function botLabel(file) {
  return file === POOLED ? "Pooled default" : file;
}

// The guest's seat as the lobby tells it: [state, heading, line].
function seatStatus(server, name) {
  if (server.seat === "empty") return ["empty", "No guest yet", "Waiting for someone to pick Join as guest."];
  if (!server.playerOnline) return ["off", "Guest offline", "Their page lost the connection. It rejoins on its own when it reconnects."];
  return ["on", name, "Online and ready to throw."];
}

const CAPTION = {
  empty: "You can start without a guest and enter their throw on this screen.",
  on: "Ready when you are.",
  off: "Start anyway, or wait for their page to reconnect.",
};

// The host's lobby, before a match: the projector's table with our bot and the guest's seat, the match length
// as two cards on the table, and Start game below. Starting posts the choice; the server's next state opens the projector.
export default function Lobby({ server, status, name, onLeave }) {
  const [bestOf, setBestOf] = useState(server.flow.game.bestOf);
  const [bot, setBot] = useState(server.bot);
  const [bots, setBots] = useState([server.bot]);
  const [failed, setFailed] = useState(null);
  const [starting, setStarting] = useState(false);
  const [seat, heading, line] = seatStatus(server, name);

  useEffect(() => {
    getJson("/api/host/bots").then(({ files }) => setBots(files), (e) => setFailed(e.message));
  }, []);

  function send(path, body = {}) {
    setFailed(null);
    return post(path, body).catch((e) => {
      setFailed(e.message);
      throw e;
    });
  }

  function start() {
    setStarting(true);
    send("/api/host/new", { bestOf, bot }).catch(() => setStarting(false));
  }

  return (
    <div className={`lb seat-${seat}`}>
      <Sprites />
      {status === "reconnecting" && <p className="banner" role="status">Reconnecting to the server…</p>}
      {failed && <p className="banner bad" role="alert">{failed}</p>}
      <section className="lb-scene" aria-label="Before the match">
        <div className="lb-tag bot">
          <h1>That's us</h1>
          <p>The bot plays from this laptop.</p>
          <label className="lb-pick">
            <span className="sr">Bot</span>
            <select value={bot} onChange={(e) => setBot(e.target.value)}>
              {bots.map((f) => <option key={f} value={f}>{botLabel(f)}</option>)}
            </select>
            <svg className="lb-chev" aria-hidden="true"><use href="#chev" /></svg>
          </label>
        </div>
        <div className="lb-tag hum" role="status">
          <h2>{heading}<i className="lb-dot" aria-hidden="true" /></h2>
          <p>{line}</p>
          <button className="ghost" disabled={server.seat === "empty"} onClick={() => send("/api/host/free-seat").catch(() => {})}>Free the seat</button>
        </div>
        <svg className="lb-bust bot" aria-hidden="true"><use href="#robot" /></svg>
        <span className="lb-bust hum" aria-hidden="true">
          <svg className="nobody"><use href="#nobody" /></svg>
          <svg className="someone"><use href="#human" /></svg>
        </span>
        <div className="lb-tbl" />
        <span className="lb-len-l" id="lb-len">Match length</span>
        <div className="lb-len" role="group" aria-labelledby="lb-len">
          {[3, 5].map((n) => (
            <button key={n} className="lb-card" aria-pressed={bestOf === n} onClick={() => setBestOf(n)}>
              <small>Best of</small><strong>{n}</strong><span>first to {(n + 1) / 2}</span>
            </button>
          ))}
        </div>
      </section>
      <footer className="lb-foot">
        <button className="lb-start" disabled={starting} onClick={start}>{starting ? "Starting…" : "Start game"}</button>
        <p className="lb-cap">{CAPTION[seat]} Ties are replayed.</p>
        <button className="ghost lb-leave" onClick={onLeave}>Leave</button>
      </footer>
    </div>
  );
}
