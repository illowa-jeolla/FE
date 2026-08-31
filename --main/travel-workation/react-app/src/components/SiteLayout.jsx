import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";
import { clearSession, getSessionUser, hasSession } from "../auth/session";

const navigation = [
  ["관광지 추천", "/recommend"],
  ["지역·일자리", "/map"],
  ["AI 매칭", "/local-fit"],
  ["여행 공유", "/community"],
  ["게더링", "/gatherings"]
];

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => ({
    status: hasSession() ? "checking" : "guest",
    user: getSessionUser()
  }));
  const location = useLocation();
  const isMapPage = location.pathname === "/map";
  const signedIn = session.status === "authenticated";
  const storedName = String(session.user?.name || "").trim();
  const accountLabel = !storedName || /^[?\uFFFD]+$/.test(storedName) ? "마이페이지" : storedName;

  useEffect(() => {
    const classes = ["feature-page", "auth-page", "map-page", "travel-guide-page", "travel-result-page", "mypage-page", "job-detail-page"];
    classes.forEach((name) => document.body.classList.remove(name));
    if (location.pathname === "/auth" || location.pathname === "/oauth/callback") document.body.classList.add("auth-page");
    else if (location.pathname === "/map") document.body.classList.add("map-page");
    else if (location.pathname === "/mypage" || location.pathname.startsWith("/mypage/")) document.body.classList.add("feature-page", "mypage-page");
    else if (location.pathname.startsWith("/jobs/")) document.body.classList.add("feature-page", "job-detail-page");
    else if (location.pathname === "/recommend") document.body.classList.add("feature-page", "travel-guide-page");
    else if (location.pathname === "/travel-guide") document.body.classList.add("feature-page", "travel-guide-page", "travel-result-page");
    else if (location.pathname !== "/") document.body.classList.add("feature-page");
    return () => classes.forEach((name) => document.body.classList.remove(name));
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    if (!hasSession()) {
      setSession({ status: "guest", user: getSessionUser() });
      return () => { cancelled = true; };
    }

    apiRequest("/api/v1/me")
      .then((data) => {
        if (cancelled) return;
        const profile = data.profile || data || {};
        const email = profile.email || profile.username || "";
        const name = profile.nickname || email.split("@")[0] || "";
        if (email) sessionStorage.setItem("email", email);
        if (name) sessionStorage.setItem("nickname", name);
        setSession({ status: "authenticated", user: { ...profile, email, name } });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 401) clearSession();
        setSession({
          status: error.status === 401 ? "guest" : "authenticated",
          user: getSessionUser()
        });
      });

    return () => { cancelled = true; };
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="일로와전라 홈">
          <span className="brand-mark">일</span>
          <span>일로와전라</span>
        </Link>
        <button className="mobile-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="메뉴 열기" aria-expanded={open}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav className={`main-nav${open ? " is-open" : ""}`} aria-label="주요 메뉴">
          <Link to="/" onClick={() => setOpen(false)}>홈</Link>
          {navigation.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
        </nav>
        {signedIn ? (
          <Link className="button button-small button-ghost header-nickname-link" to="/mypage">{accountLabel}</Link>
        ) : (
          <Link className="button button-small button-ghost" to="/auth">로그인</Link>
        )}
      </header>
      <Outlet />
    </div>
  );
}
