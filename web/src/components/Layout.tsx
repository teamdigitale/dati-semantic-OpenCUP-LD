import { Link, Outlet, useLocation } from "react-router-dom";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/mappature", label: "Mappature" },
  { to: "/grafi", label: "Grafi separati" },
  { to: "/unione", label: "Unione semantica" },
  { to: "/unione/animazione", label: "Unione animata" },
  { to: "/analisi", label: "Analisi" },
];

export function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            OpenCUP LD Explorer
          </Link>
          <nav>
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={pathname === to ? "nav-link active" : "nav-link"}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        Dati interoperabili PNRR — PublicInvestment ontology — generato da{" "}
        <code>all.ttl</code>
      </footer>
    </div>
  );
}
