import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { checkHealth } from "../api/client";
import { siteConfig } from "../config/site";
import { FilmIcon, SignalIcon, UploadIcon } from "./Icons";

type ApiStatus = "checking" | "online" | "offline";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await checkHealth();
      if (!cancelled) setApiStatus(result ? "online" : "offline");
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand" id="nav-brand">
            <FilmIcon size={20} color="#E50914" />
            <span className="site-header__wordmark">{siteConfig.name}</span>
          </Link>

          <nav className="site-header__nav" aria-label="Primary navigation">
            <NavLink
              to="/"
              id="nav-catalog"
              className={({ isActive }) =>
                `site-header__link${isActive && location.pathname === "/" ? " site-header__link--active" : ""}`
              }
              end
            >
              Catalog
            </NavLink>
            <NavLink
              to="/upload"
              id="nav-upload"
              className={({ isActive }) =>
                `site-header__link${isActive ? " site-header__link--active" : ""}`
              }
            >
              <UploadIcon size={16} />
              Upload
            </NavLink>
          </nav>

          <div className="site-header__status">
            <span
              className={`api-indicator api-indicator--${apiStatus}`}
              title={`API ${apiStatus === "online" ? "reachable" : apiStatus === "offline" ? "unreachable" : "checking"}`}
              aria-label={`API status: ${apiStatus}`}
            >
              <SignalIcon size={14} />
              <span className="api-indicator__label">
                API {apiStatus === "checking" ? "..." : apiStatus === "online" ? "Online" : "Offline"}
              </span>
            </span>
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__left">
            <span className="site-footer__copy">
              &copy; {year} {siteConfig.name}. All rights reserved.
            </span>
            <span className="site-footer__env">
              {siteConfig.domain}
            </span>
          </div>
          <nav className="site-footer__nav" aria-label="Footer navigation">
            <Link to="/privacy" id="footer-privacy" className="site-footer__link">Privacy Policy</Link>
            <Link to="/terms" id="footer-terms" className="site-footer__link">Terms of Service</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
