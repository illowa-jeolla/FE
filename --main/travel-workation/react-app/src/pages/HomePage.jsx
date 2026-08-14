import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";

const features = [
  { icon: "⌖", tag: "여행 탐색", title: "지역·일자리 지도", description: "관광지와 리뷰, 단기 일자리를 한 화면에서 살펴보세요.", label: "통합 지도 열기", path: "/map" },
  { icon: "✦", tag: "나의 여행 기록", title: "AI 전라도 라이프 매칭", description: "살 곳과 일자리, 주변 관광지를 관광데이터로 한 번에 추천해요.", label: "AI 매칭 시작하기", path: "/local-fit" },
  { icon: "○", tag: "생생한 여행 이야기", title: "여행 공유", description: "사진과 후기로 전라도에서의 여행 순간을 나눠보세요.", label: "여행 이야기 보기", path: "/community" },
  { icon: "▣", tag: "여행하며 일하기", title: "로컬 일자리", description: "여행 일정과 근무 조건에 맞는 지역 일자리를 찾아보세요.", label: "일자리 둘러보기", path: "/jobs" },
  { icon: "◇", tag: "함께하는 로컬 경험", title: "게더링", description: "근처 여행자와 가벼운 모임을 만들고 참여해보세요.", label: "모임 둘러보기", path: "/gatherings" }
];

export default function HomePage() {
  const [stats, setStats] = useState({ regionCount: "-", jobCount: "-", averageRating: "-" });
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiRequest("/api/stats").then(setStats).catch(() => {});
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    const normalized = query.trim();
    if (normalized.length < 2) return;
    window.location.href = `${import.meta.env.BASE_URL}search?q=${encodeURIComponent(normalized)}`;
  }

  return (
    <main>
      <section className="home-hero-react">
        <div className="hero-overlay" />
        <div className="hero-content-react">
          <span className="hero-label">TRAVEL · LOCAL · WORK</span>
          <h1>전라도에서<br />여행하듯 일해보세요</h1>
          <p>여행, AI 매칭, 로컬 일자리를 한곳에서 연결해요.</p>
          <div className="hero-actions">
            <a className="button-react primary" href="#features">시작하기</a>
            <Link className="button-react secondary" to="/map">지역·일자리 보기</Link>
          </div>
          <dl className="home-stats-react">
            <div><dt>{Number.isFinite(Number(stats.regionCount)) ? `${Number(stats.regionCount)}개` : "-"}</dt><dd>추천 지역</dd></div>
            <div><dt>{Number.isFinite(Number(stats.jobCount)) ? `${Number(stats.jobCount)}개` : "-"}</dt><dd>관광 일자리</dd></div>
            <div><dt>{Number.isFinite(Number(stats.averageRating)) ? Number(stats.averageRating).toFixed(1) : "-"}</dt><dd>평균 평점</dd></div>
          </dl>
        </div>
      </section>

      <section className="features-react" id="features">
        <div className="section-heading-react">
          <span>WHAT CAN I DO?</span>
          <h2>원하는 기능으로 바로 이동하세요</h2>
          <form className="home-search-react" role="search" onSubmit={submitSearch}>
            <span className="search-symbol" aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" minLength="2" placeholder="지역, 관광지, 일자리, 여행 이야기를 검색해 보세요" aria-label="통합검색" required />
            <button type="submit">검색</button>
          </form>
        </div>
        <div className="feature-grid-react">
          {features.map(({ icon, tag, title, description, label, path }, index) => (
            <article className={`feature-card-react${index === 0 ? " is-featured" : ""}`} key={path}>
              <div className="feature-icon-react" aria-hidden="true">{icon}</div>
              <span>{tag}</span><h3>{title}</h3><p>{description}</p>
              <Link to={path}>{label}<span aria-hidden="true">→</span></Link>
            </article>
          ))}
          <article className="feature-card-react account-card-react">
            <div className="feature-icon-react" aria-hidden="true">✦</div>
            <span>나만의 여행 저장</span><h3>{hasSession() ? "내 여행 이어보기" : "로그인하고 시작하기"}</h3>
            <p>저장한 여행과 지원한 일자리를 안전하게 관리해요.</p>
            {hasSession() ? <Link to="/mypage">마이페이지 보기<span aria-hidden="true">→</span></Link> : <Link to="/auth">로그인하기<span aria-hidden="true">→</span></Link>}
          </article>
        </div>
      </section>
    </main>
  );
}
