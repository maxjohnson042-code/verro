export default function HomePage() {
  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Verro</h1>
      <p>Milestone 0 scaffold. Pick a portal:</p>
      <ul>
        <li>
          <a href="/broker">Broker portal</a>
        </li>
        <li>
          <a href="/portal">Aggregator / Lender / Association portal</a>
        </li>
        <li>
          <a href="/admin">Internal Admin portal</a>
        </li>
      </ul>
    </main>
  );
}
