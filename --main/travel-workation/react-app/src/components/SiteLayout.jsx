import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getSessionUser, hasSession } from "../auth/session";

const navigation = [
  ["관광지 추천", "/recommend"],
  ["지역·일자리", "/jobs"],
  ["AI 매칭", "/local-fit"],
  ["여행 공유", "/community"],
  ["게더링", "/gatherings"]
];

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => ({
    status: hasSession() ? "authenticated" : "guest",
    user: getSessionUser()
  }));
  const location = useLocation();
  const signedIn = session.status === "authenticated";
  const storedName = String(session.user?.name || "").trim();
  const accountLabel = !storedName || /^[?\uFFFD]+$/.test(storedName) ? "마이페이지" : storedName;

  useEffect(() => {
    const classes = ["feature-page", "auth-page", "map-page", "travel-guide-page", "travel-result-page", "mypage-page", "job-detail-page", "local-fit-page"];
    classes.forEach((name) => document.body.classList.remove(name));
    if (location.pathname === "/auth" || location.pathname === "/oauth/callback") document.body.classList.add("auth-page");
    else if (location.pathname === "/jobs") document.body.classList.add("feature-page");
    else if (location.pathname === "/mypage" || location.pathname.startsWith("/mypage/")) document.body.classList.add("feature-page", "mypage-page");
    else if (location.pathname.startsWith("/jobs/")) document.body.classList.add("feature-page", "job-detail-page");
    else if (location.pathname === "/recommend") document.body.classList.add("feature-page", "travel-guide-page");
    else if (location.pathname === "/local-fit") document.body.classList.add("feature-page", "local-fit-page");
    else if (location.pathname === "/travel-guide") document.body.classList.add("feature-page", "travel-guide-page", "travel-result-page");
    else if (location.pathname !== "/") document.body.classList.add("feature-page");
    return () => classes.forEach((name) => document.body.classList.remove(name));
  }, [location.pathname]);

  useEffect(() => {
    setSession({ status: hasSession() ? "authenticated" : "guest", user: getSessionUser() });
  }, [location.pathname]);

  useEffect(() => {
    const refreshSessionUser = () => setSession({ status: hasSession() ? "authenticated" : "guest", user: getSessionUser() });
    window.addEventListener("session-user-changed", refreshSessionUser);
    return () => window.removeEventListener("session-user-changed", refreshSessionUser);
  }, []);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="일로와전라 홈">
          <img className="brand-logo" src="/mobile-assets/illowa-full-logo-v2.png" alt="일로와전라" />
        </Link>
        <button className="mobile-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="메뉴 열기" aria-expanded={open}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav className={`main-nav${open ? " is-open" : ""}`} aria-label="주요 메뉴">
          <NavLink className="nav-home-link" to="/" onClick={() => setOpen(false)}>홈</NavLink>
          <span className="nav-separator" aria-hidden="true" />
          <div className="nav-group" aria-label="지역 탐색">
            {navigation.slice(0, 3).map(([label, path]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
          </div>
          <span className="nav-separator" aria-hidden="true" />
          <div className="nav-group" aria-label="커뮤니티">
            {navigation.slice(3).map(([label, path]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
          </div>
        </nav>
        {signedIn ? (
          <NavLink className="header-account-link header-nickname-link" to="/mypage"><span className="header-account-avatar" aria-hidden="true"><img src="/brand/empty-character.png" alt="" /></span><span><small>MY PAGE</small><b>{accountLabel}</b></span><i aria-hidden="true">→</i></NavLink>
        ) : (
          <NavLink className="header-account-link header-login-link" to="/auth"><span className="header-account-avatar" aria-hidden="true">♡</span><span><small>ACCOUNT</small><b>로그인</b></span><i aria-hidden="true">→</i></NavLink>
        )}
      </header>
      <Outlet />
    </div>
  );
}
