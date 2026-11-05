// The start screen: each tab picks its role, Host (the projector) or Join as guest.

export default function Start({ onHost, onGuest, message, busy }) {
  return (
    <main className="start">
      <h1>Rock, paper, scissors against the bot</h1>
      <p>Pick this screen's role. The host runs the match on the projector; the guest plays against the bot.</p>
      <div className="start-go">
        <button className="go" disabled={busy} onClick={onHost}>Host</button>
        <button className="go alt" disabled={busy} onClick={onGuest}>Join as guest</button>
      </div>
      {message && <p className="start-msg" role="alert">{message}</p>}
    </main>
  );
}
