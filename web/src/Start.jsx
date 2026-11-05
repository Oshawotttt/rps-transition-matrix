import { Sprites } from "./ui.jsx";

// The start screen: the projector's two players sit behind the table, and each half of the screen picks
// this tab's role. Pointing at a side stands that player up; the robot is the host, the human the guest.
export default function Start({ onHost, onGuest, message, busy, refused }) {
  return (
    <main className={`si${busy ? " busy" : ""}${refused ? " refused" : ""}`}>
      <Sprites />
      <div className="si-title">
        <h1>Rock, paper, scissors against the bot</h1>
        <p>Pick a side for this screen.</p>
      </div>
      <button className="si-side si-host" disabled={busy} onClick={onHost}>
        <svg className="si-bust" aria-hidden="true"><use href="#robot" /></svg>
        <span className="si-tag">
          <b>Host</b>
          <span>{busy ? "Checking the server…" : refused ? "Not on this laptop." : "Runs the match on this laptop and its projector."}</span>
        </span>
      </button>
      <button className="si-side si-guest" disabled={busy} onClick={onGuest}>
        <svg className="si-bust" aria-hidden="true"><use href="#human" /></svg>
        <span className="si-tag">
          <b>Join as guest</b>
          <span>Play the bot from your own device.</span>
        </span>
      </button>
      {message && <p className="si-slip" role="alert">{message}</p>}
    </main>
  );
}
