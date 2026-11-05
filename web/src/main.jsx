import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/atkinson-hyperlegible/400-italic.css";
import "@fontsource/atkinson-hyperlegible/700-italic.css";
import "@fontsource/gabarito/500.css";
import "@fontsource/gabarito/700.css";
import "@fontsource/gabarito/800.css";
import "./projector.css";
import { loadBot } from "./game.js";
import { chooseRole, connect, getJson, savedRole } from "./net.js";
import Lobby from "./Lobby.jsx";
import Player from "./Player.jsx";
import Projector from "./Projector.jsx";
import Start from "./Start.jsx";

const NO_SERVER = "The app needs its server: from web/, run npm run dev on one laptop, or npm run host to play on two.";
const REFUSED = "Hosting works only on the laptop running the server. On this laptop, choose Join as guest.";
const STREAM_CLOSED = "The server closed the connection. Reload the page to connect again.";

// Asks the host-only bot list, since EventSource hides the HTTP status: resolves with null when hosting
// works here, else with the message to show (a refused host, or no server).
function probeHost() {
  return getJson("/api/host/bots").then(() => null, (e) => (e.status === 403 ? REFUSED : NO_SERVER));
}

function Status({ title, children }) {
  return <main className="status">{title && <h1>{title}</h1>}{children}</main>;
}

// The host: the lobby until the server's match starts, then the projector. Loads the bot the server names,
// again whenever the name changes.
function Host({ onLeave }) {
  const [server, setServer] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [bot, setBot] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const conn = connect("/api/events?role=host", setServer);
    conn.onStatus = (s) => {
      setStatus(s);
      if (s !== "closed") return;
      probeHost().then((why) => (why === REFUSED ? onLeave(REFUSED) : setError(why ?? STREAM_CLOSED)));
    };
    return () => conn.close();
  }, [onLeave]);

  const name = server?.bot;
  useEffect(() => {
    if (!name) return undefined;
    let live = true;
    loadBot(`bots/${name}`).then((data) => live && setBot({ name, data }), (e) => live && setError(e.message));
    return () => { live = false; };
  }, [name]);

  if (error) return <Status title="The projector can't reach the match"><p>{error}</p></Status>;
  if (!server) return <Status><p>Connecting to the server…</p></Status>;
  if (bot?.name !== name) return <Status><p>Loading the bot from bots/{name}…</p></Status>;
  if (!server.started) {
    return <Lobby server={server} status={status} name={bot.data.opponent ?? "Your friend"} onLeave={() => onLeave(null)} />;
  }
  return <Projector bot={bot.data} server={server} status={status} onLeave={() => onLeave(null)} />;
}

function App() {
  const [role, setRole] = useState(() => savedRole(sessionStorage));
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const choose = useCallback((next) => {
    chooseRole(sessionStorage, next);
    setRole(next);
  }, []);
  const onLeave = useCallback((why) => {
    choose(null);
    setMessage(why);
  }, [choose]);

  async function onHost() {
    setBusy(true);
    setMessage(null);
    const why = await probeHost();
    setBusy(false);
    if (why) setMessage(why);
    else choose("host");
  }

  if (role === "host") return <Host onLeave={onLeave} />;
  if (role === "player") return <Player onLeave={() => onLeave(null)} />;
  return <Start onHost={onHost} onGuest={() => choose("player")} message={message} busy={busy} refused={message === REFUSED} />;
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
