import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/gabarito/500.css";
import "@fontsource/gabarito/700.css";
import "@fontsource/gabarito/800.css";
import "./projector.css";
import { DEFAULT_BOT_URL, loadBot } from "./game.js";
import Projector from "./Projector.jsx";

// ?bot=bots/<file>.json picks another bot from web/public/; the pooled bot is the default.
const botUrl = new URLSearchParams(location.search).get("bot") || DEFAULT_BOT_URL;

function App() {
  const [bot, setBot] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    loadBot(botUrl).then(setBot, setError);
  }, []);
  if (error) {
    return (
      <main className="status">
        <h1>The bot didn't load</h1>
        <p>{error.message}</p>
        <p>Check that the file exists under web/public/, or remove ?bot= from the address to use the pooled bot.</p>
      </main>
    );
  }
  if (!bot) return <main className="status"><p>Loading the bot from {botUrl}…</p></main>;
  return <Projector bot={bot} />;
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
