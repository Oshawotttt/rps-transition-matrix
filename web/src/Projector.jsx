import { useCallback, useEffect, useState } from "react";
import { newGame, playRound } from "./game.js";
import RoundReport from "./RoundReport.jsx";
import { LongRun, LookAhead, Policy, Tally } from "./Panels.jsx";
import { Card, Sprites } from "./ui.jsx";
import WinScreen from "./WinScreen.jsx";

const TABS = [["round", "This round"], ["long", "Long run"], ["tally", "Tally"], ["policy", "Policy"], ["ahead", "Look ahead"]];

// Each round: the class works through the steps, the presenter picks our move ("think"),
// enters the friend's move ("reveal"), and sees the result until the next round ("result").
export default function Projector({ bot }) {
  const [game, setGame] = useState(() => newGame(bot, 3));
  const [phase, setPhase] = useState("think");
  const [pick, setPick] = useState(null);
  const [wrong, setWrong] = useState(null);
  const [tab, setTab] = useState("round");
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

  function restart(bestOf = game.bestOf) {
    setGame(newGame(bot, bestOf));
    setPhase("think");
    setPick(null);
    setWrong(null);
    setWon(false);
    setTab("round");
  }

  useEffect(() => {
    if (!game.winner) return undefined;
    const timer = setTimeout(() => setWon(true), 1400);
    return () => clearTimeout(timer);
  }, [game.winner]);

  const onMain = useCallback(() => setWon(false), []);

  function onPick(move) {
    if (move !== game.decision.move) {
      setWrong((w) => ({ move, n: (w?.n ?? 0) + 1 }));
      return;
    }
    setWrong(null);
    setPick(move);
    setPhase("reveal");
  }

  function onFriend(move) {
    setGame(playRound(game, move, pick));
    setPhase("result");
  }

  function onNext() {
    if (game.winner) setWon(true);
    else {
      setPhase("think");
      setPick(null);
    }
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
            <RoundReport bot={bot} {...view} phase={phase} pick={pick} wrong={wrong} onPick={onPick} onFriend={onFriend}
              record={record} winner={game.winner} target={game.target} tally={game.tally} onNext={onNext} name={name} />
          )}
          {tab === "long" && <LongRun bot={bot} />}
          {tab === "tally" && <Tally bot={bot} history={game.history} />}
          {tab === "policy" && <Policy bot={bot} />}
          {tab === "ahead" && <LookAhead />}
        </section>
      </main>

      {won && (
        <WinScreen winner={game.winner} name={name} tally={game.tally}
          onMain={onMain} onPlay={(n) => { restart(n); window.scrollTo(0, 0); }} />
      )}
    </>
  );
}
