import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { getSessionUser, hasSession } from "../auth/session";

const navigation = [
  ["관광지 추천", "/recommend"],
  ["지역·일자리", "/map"],
  ["AI 매칭", "/local-fit"],
  ["여행 공유", "/community"],
  ["게더링", "/gatherings"]
];

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const user = getSessionUser();
  const location = useLocation();
  const isMapPage = location.pathname === "/map";

  return (
    <div className={`app-shell${isMapPage ? " is-map-page-react" : ""}`}>
      <header className="site-header-react">
        <Link className="brand-react" to="/" aria-label="일로와전라 홈">
          <span className="brand-mark-react">일</span>
          <span>일로와전라</span>
        </Link>
        <button className="mobile-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-label="메뉴 열기" aria-expanded={open}>
          <span aria-hidden="true">{open ? "×" : "☰"}</span>
        </button>
        <nav className={`main-nav-react${open ? " is-open" : ""}`} aria-label="주요 메뉴">
          <Link to="/" onClick={() => setOpen(false)}>홈</Link>
          {navigation.map(([label, path]) => <NavLink key={path} to={path} onClick={() => setOpen(false)}>{label}</NavLink>)}
        </nav>
        {hasSession() ? (
          <Link className="account-button" to="/mypage">{user.name || "마이페이지"}</Link>
        ) : (
          <Link className="account-button" to="/auth">로그인</Link>
        )}
      </header>
      <Outlet />
      {!isMapPage && <footer className="site-footer-react">
        <div className="brand-react"><span className="brand-mark-react">일</span><span>일로와전라</span></div>
        <p>전라도의 여행과 로컬 일자리를 연결합니다.</p>
      </footer>}
    </div>
  );
}
