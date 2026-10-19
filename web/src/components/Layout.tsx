import { Link, NavLink, Outlet } from "react-router-dom";
import { site } from "../content/site";

export function Layout() {
  const { brand, nav, aria, footer } = site;

  return (
    <div className="app-shell">
      <div className="it-header-wrapper">
        <div className="it-header-slim-wrapper">
          <div className="container-xxl">
            <div className="row">
              <div className="col-12">
                <div className="it-header-slim-wrapper-content">
                  <span className="d-none d-lg-block navbar-brand">
                    {brand.slim}
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
                          <div className="it-brand-title">{brand.title}</div>
                          <div className="it-brand-tagline d-none d-md-block">
                            {brand.tagline}
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
              aria-label={aria.nav}
            >
              <div className="container-xxl">
                <button
                  className="navbar-toggler"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#navPrimaria"
                  aria-controls="navPrimaria"
                  aria-expanded="false"
                  aria-label={aria.nav_toggle}
                >
                  <span className="navbar-toggler-icon" />
                </button>
                <div className="collapse navbar-collapse" id="navPrimaria">
                  <ul className="navbar-nav">
                    {nav.map(({ to, label, end }) => (
                      <li className="nav-item" key={to}>
                        <NavLink
                          to={to}
                          end={end ?? false}
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
                    <h2 className="no_toc">{brand.title}</h2>
                    <h3 className="no_toc d-none d-md-block">
                      {brand.footer_subtitle}
                    </h3>
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-12 col-md-6">
                <h4 className="no_toc">{footer.contents_title}</h4>
                <p>{footer.contents_body}</p>
              </div>
              <div className="col-12 col-md-6">
                <h4 className="no_toc">{footer.sources_title}</h4>
                <ul className="list-unstyled">
                  <li>{footer.sources_line}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="it-footer-small-prints">
          <div className="container-xxl">
            <ul className="it-footer-small-prints-list list-inline mb-0">
              <li className="list-inline-item">{footer.small_print}</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
