import { useCallback, useEffect, useState } from "react";
import { getJson, post } from "./net.js";
import RoundReport from "./RoundReport.jsx";
import LookAhead from "./LookAhead.jsx";
import { LongRun, Tally } from "./Panels.jsx";
import { Card, Sprites } from "./ui.jsx";
import WinScreen from "./WinScreen.jsx";

const TABS = [["round", "This round"], ["long", "Long run"], ["tally", "Tally"], ["ahead", "Look ahead"]];

// What the projector says about the guest: online or not, and whether they have thrown, never which move.
function guestStatus(server) {
  if (server.seat === "empty") return ["off", "No guest yet"];
  if (!server.playerOnline) return ["off", "Guest offline"];
  if (server.flow.thrown) return ["on", "Guest has thrown"];
  return ["on", "Guest online"];
}

// Each round: the class works through the steps, the host picks our move ("think"); the guest throws
// before or after the pick; the round plays once both are in ("result") and shows until Next.
// The match lives on the server; this screen keeps only its tabs, the wrong-pick shake and the win overlay.
export default function Projector({ bot, server, status, onLeave }) {
  const { phase, pick, thrown } = server.flow;
  const game = { ...server.flow.game, bot };
  const [wrong, setWrong] = useState(null);
  const [tab, setTab] = useState("round");
  const [bots, setBots] = useState([server.bot]);
  const [failed, setFailed] = useState(null);
  // the win screen opens a moment after the final reveal, so the last cards register first
  const [won, setWon] = useState(false);
  const name = bot.opponent ?? "Your friend";

  const record = phase === "result" ? game.history[game.history.length - 1] : null;
  // while a result shows, the report keeps the round just played; the game has already moved on
  const view = record
    ? { decision: record.decision, state: game.history[game.history.length - 2]?.token ?? null, round: record.round }
    : { decision: game.decision, state: game.state, round: game.round };
  const last = game.history[game.history.length - 1];
  const botWins = game.tally.lose;
  const friendWins = game.tally.win;
  const [guestClass, guestText] = guestStatus(server);

  useEffect(() => {
    getJson("/api/host/bots").then(({ files }) => setBots(files), (e) => setFailed(e.message));
  }, []);

  // a round's wrong pick is forgotten once the round changes
  useEffect(() => setWrong(null), [game.round]);

  useEffect(() => {
    if (!game.winner) {
      setWon(false);
      return undefined;
    }
    const timer = setTimeout(() => setWon(true), 1400);
    return () => clearTimeout(timer);
  }, [game.winner]);

  const onMain = useCallback(() => setWon(false), []);

  // Every match action goes to the server; its state event redraws the screen.
  function send(path, body = {}) {
    setFailed(null);
    post(path, body).catch((e) => setFailed(e.message));
  }

  function restart(bestOf = game.bestOf, botName = server.bot) {
    send("/api/host/new", { bestOf, bot: botName });
    setWrong(null);
    setWon(false);
    setTab("round");
  }

  function onPick(move) {
    // checked here too, so the shake is immediate; the server still refuses a wrong pick
    if (move !== game.decision.move) {
      setWrong((w) => ({ move, n: (w?.n ?? 0) + 1 }));
      return;
    }
    setWrong(null);
    send("/api/host/pick", { move });
  }

  function onFriend(move) {
    send("/api/host/throw", { move });
  }

  function onNext() {
    if (game.winner) setWon(true);
    else send("/api/host/next");
    window.scrollTo(0, 0);
  }

  return (
    <>
      <Sprites />
      <header className="scene"><div className="in">
        <div className="tag bot">The Bot<small>That's us</small></div>
        <div className="tag hum">{name}<small>Playing from the corner</small></div>
        <div className="mid">
          <div className="score">
            <span>{botWins}<small>Bot</small></span><span className="dash">–</span><span>{friendWins}<small>{name}</small></span>
          </div>
          <p>Best of {game.bestOf}</p>
        </div>
        <div className="bust bot"><svg><use href="#robot" /></svg></div>
        <div className="bust hum"><svg><use href="#human" /></svg></div>
        <div className="tbl" />
        <div className="prev">
          {last ? (
            <>
              <Card move={last.botMove} side="b" won={last.outcome === "lose"} />
              <div className="pcap">Last round: {last.outcome === "tie" ? "tie, replayed" : last.outcome === "lose" ? "we won" : "they won"}</div>
              <Card move={last.humanMove} side="h" won={last.outcome === "win"} />
            </>
          ) : (
            <>
              <div className="crd b empty">Our card</div>
              <div className="pcap">No previous round yet</div>
              <div className="crd h empty">Their card</div>
            </>
          )}
        </div>
      </div></header>

      <div className="host"><div className="wrap">
        <span className={`guest ${guestClass}`}><i aria-hidden="true" />{guestText}</span>
        <button className="ghost" disabled={server.seat === "empty"} onClick={() => send("/api/host/free-seat")}>Free the seat</button>
        <label className="pickbot">Bot
          <select value={server.bot} onChange={(e) => restart(game.bestOf, e.target.value)}>
            {bots.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <button className="ghost leave" onClick={onLeave}>Leave</button>
      </div></div>
      {status === "reconnecting" && <p className="banner" role="status">Reconnecting to the server…</p>}
      {failed && <p className="banner bad" role="alert">{failed}</p>}

      <nav className="bar"><div className="wrap" role="tablist" aria-label="Panels">
        {TABS.map(([id, label]) => (
          <button key={id} className="tab" role="tab" id={`tab-${id}`} aria-controls={`p-${id}`} aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
        <div className="mini">
          <div className="len" role="group" aria-label="Match length">
            {[3, 5].map((n) => (
              <button key={n} aria-pressed={game.bestOf === n} disabled={game.history.length > 0} onClick={() => restart(n)}>Best of {n}</button>
            ))}
          </div>
          <button className="ghost" onClick={() => restart()}>New match</button>
        </div>
      </div></nav>

      <main className="wrap">
        <section className="panel" id={`p-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "round" && (
            <RoundReport bot={bot} {...view} phase={phase} pick={pick} thrown={thrown} wrong={wrong} onPick={onPick} onFriend={onFriend}
              record={record} winner={game.winner} target={game.target} tally={game.tally} onNext={onNext} name={name} />
          )}
          {tab === "long" && <LongRun bot={bot} />}
          {tab === "tally" && <Tally bot={bot} history={game.history} />}
          {tab === "ahead" && <LookAhead bot={bot} state={game.state} />}
        </section>
      </main>

      {won && (
        <WinScreen winner={game.winner} name={name} tally={game.tally}
          onMain={onMain} onPlay={(n) => { restart(n); window.scrollTo(0, 0); }} />
      )}
    </>
  );
}
