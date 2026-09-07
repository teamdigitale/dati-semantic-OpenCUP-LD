import { Link, NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/mappature", label: "Mappature" },
  { to: "/grafi", label: "Grafi separati" },
  { to: "/unione", label: "Unione semantica" },
  { to: "/unione/animazione", label: "Unione animata" },
  { to: "/analisi", label: "Analisi" },
] as const;

export function Layout() {
  return (
    <div className="app-shell">
      <div className="it-header-wrapper">
        <div className="it-header-slim-wrapper">
          <div className="container-xxl">
            <div className="row">
              <div className="col-12">
                <div className="it-header-slim-wrapper-content">
                  <span className="d-none d-lg-block navbar-brand">
                    Linked Data · investimento pubblico
                  </span>
                  <div className="it-header-slim-right-zone">
                    <a
                      className="btn btn-primary btn-icon btn-full"
                      href="https://schema.gov.it"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      schema.gov.it
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="it-nav-wrapper">
          <div className="it-header-center-wrapper">
            <div className="container-xxl">
              <div className="row">
                <div className="col-12">
                  <div className="it-header-center-content-wrapper">
                    <div className="it-brand-wrapper">
                      <Link to="/">
                        <div className="it-brand-text">
                          <div className="it-brand-title">OpenCUP LD</div>
                          <div className="it-brand-tagline d-none d-md-block">
                            Esploratore Linked Data OpenCUP · ANAC · PA Digitale · IndicePA
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="it-header-navbar-wrapper theme-dark">
            <nav
              className="navbar navbar-expand-lg has-megamenu theme-dark"
              aria-label="Navigazione principale"
            >
              <div className="container-xxl">
                <button
                  className="navbar-toggler"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#navPrimaria"
                  aria-controls="navPrimaria"
                  aria-expanded="false"
                  aria-label="Mostra o nascondi la navigazione"
                >
                  <span className="navbar-toggler-icon" />
                </button>
                <div className="collapse navbar-collapse" id="navPrimaria">
                  <ul className="navbar-nav">
                    {NAV.map(({ to, label, ...rest }) => (
                      <li className="nav-item" key={to}>
                        <NavLink
                          to={to}
                          end={"end" in rest ? rest.end : false}
                          className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                          }
                        >
                          <span>{label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>

      <main className="container-xxl py-4 py-lg-5" id="main">
        <Outlet />
      </main>

      <footer className="it-footer">
        <div className="it-footer-main">
          <div className="container-xxl">
            <div className="row">
              <div className="col-12">
                <div className="it-brand-wrapper mb-3">
                  <div className="it-brand-text">
                    <h2 className="no_toc">OpenCUP Linked Data</h2>
                    <h3 className="no_toc d-none d-md-block">
                      Dati interoperabili PNRR — ontologia PublicInvestment
                    </h3>
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-12 col-md-6">
                <h4 className="no_toc">Ambito</h4>
                <p>
                  Le <strong>Analisi</strong> usano le basi raw complete. I{" "}
                  <strong>grafi</strong> e il RDF (<code>all.ttl</code>) restano
                  sull&apos;hub interop e su un campione di CUP.
                </p>
              </div>
              <div className="col-12 col-md-6">
                <h4 className="no_toc">Fonti</h4>
                <ul className="list-unstyled">
                  <li>OpenCUP · ANAC CUP↔CIG · PA Digitale · IndicePA · SCP MIT</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="it-footer-small-prints">
          <div className="container-xxl">
            <ul className="it-footer-small-prints-list list-inline mb-0">
              <li className="list-inline-item">
                Design System .italia / Bootstrap Italia
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
