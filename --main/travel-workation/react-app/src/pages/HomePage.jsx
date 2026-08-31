import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getJobs } from "../api/jobs";
import { getRegions } from "../api/regions";
import { asList } from "../hooks/useApi";

const features = [
  { icon: "⌖", tag: "여행 탐색", title: "관광지 지도", description: "전라도 지도를 보며 가고 싶은 지역을 고르고, 지역별 관광 정보와 일자리를 함께 살펴보세요.", label: "지도 열기", path: "/map", featured: true },
  { icon: "✦", tag: "취향에 맞는 여행", title: "관광지 추천", description: "어제 정리한 날짜와 여행 조건을 바탕으로 나에게 맞는 전라도 여행 코스를 추천받아 보세요.", label: "관광지 추천받기", path: "/recommend" },
  { icon: "◎", tag: "나의 여행 기록", title: "로컬 핏", description: "여행 경험을 기록하면 취향과 지역의 궁합을 점수로 확인하고, 다음 여행지를 발견할 수 있어요.", label: "로컬 핏 확인하기", path: "/local-fit" },
  { icon: "▣", tag: "머물며 일하기", title: "일자리 추천", description: "선택한 지역과 로컬 핏을 바탕으로 행사, 축제, 팝업 등 여행 중 가능한 일자리를 찾아보세요.", label: "일자리 찾아보기", path: "/jobs" },
  { icon: "◇", tag: "생생한 여행 이야기", title: "여행 공유", description: "최근 여행 사진과 후기를 둘러보고, 직접 경험한 전라도의 순간을 다른 여행자와 나눠보세요.", label: "여행 이야기 보기", path: "/community" },
  { icon: "♧", tag: "함께하는 로컬 경험", title: "게더링", description: "같은 지역에 머무는 사람들과 식사, 산책, 관광 모임을 만들거나 원하는 모임에 참여해 보세요.", label: "모임 둘러보기", path: "/gatherings" }
];

export default function HomePage() {
  const [stats, setStats] = useState({ regionCount: "-", jobCount: "-", averageRating: "-" });

  useEffect(() => {
    Promise.all([getRegions({ parentId: 1 }), getJobs({ page: 0, size: 1 })]).then(([regionData, jobData]) => {
      const regions = asList(regionData, "regions");
      const ratings = regions.map((region) => Number(region.averageRating)).filter(Number.isFinite);
      setStats({ regionCount: regions.length, jobCount: jobData.totalElements ?? asList(jobData, "jobs").length, averageRating: ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : "-" });
    }).catch(() => {});
  }, []);

  return (
    <main className="home-main">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__content">
          <span className="home-hero__label">TRAVEL · LOCAL · WORK</span>
          <h1 id="home-title">전라도에서,<br />여행하듯 일해보세요</h1>
          <p>여행지를 발견하고, 나와 지역의 궁합을 알아보고, 머무는 동안 할 수 있는 일까지 연결해 드려요.</p>
          <div className="home-hero__actions">
            <a className="home-button home-button--primary" href="#features">시작하기</a>
            <Link className="home-button home-button--secondary" to="/jobs">내게 맞는 일자리 보기</Link>
          </div>
          <dl className="home-stats">
            <div><dt>{Number.isFinite(Number(stats.regionCount)) ? `${Number(stats.regionCount)}개` : "-"}</dt><dd>추천 지역</dd></div>
            <div><dt>{Number.isFinite(Number(stats.jobCount)) ? `${Number(stats.jobCount)}개` : "-"}</dt><dd>관광 일자리</dd></div>
            <div><dt>{Number.isFinite(Number(stats.averageRating)) ? Number(stats.averageRating).toFixed(1) : "-"}</dt><dd>평균 평점</dd></div>
          </dl>
        </div>
      </section>

      <section className="home-features" id="features">
        <div className="home-section-heading">
          <span>WHAT CAN I DO?</span>
          <h2>원하는 기능으로 바로 이동하세요</h2>
          <p>긴 설명을 따라 내려갈 필요 없이, 지금 필요한 기능을 선택하면 해당 페이지에서 바로 시작할 수 있어요.</p>
        </div>
        <div className="home-feature-grid">
          {features.map(({ icon, tag, title, description, label, path, featured }) => (
            <article className={`home-feature-card${featured ? " home-feature-card--featured" : ""}`} key={path}>
              <div className="home-feature-card__icon" aria-hidden="true">{icon}</div>
              <span className="home-feature-card__tag">{tag}</span><h3>{title}</h3><p>{description}</p>
              <Link className="home-feature-card__button" to={path}><span>{label}</span><span aria-hidden="true">→</span></Link>
            </article>
          ))}
        </div>
      </section>
      <section className="home-cta"><div><span>어디서부터 시작할지 고민된다면</span><h2>지도에서 끌리는 지역을 먼저 골라보세요</h2></div><Link className="button button-light" to="/map">전라도 지도 열기 →</Link></section>
    </main>
  );
}
