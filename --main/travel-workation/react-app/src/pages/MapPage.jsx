import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { mapPinPositions, mapRegions } from "../data/regions";
import { asList, useApi } from "../hooks/useApi";

function MapJobItem({ job }) {
  return <Link className="map-job-item" to={`/jobs/${job.id}`}><div><span>{job.category || "관광 운영"}</span><h3>{job.title}</h3><p>{job.companyName || job.company_name}</p></div><div className="job-meta">{[job.workType, job.workTime, job.duration].filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div><footer><span>{job.location || `${job.region} 주요 관광지 인근`}</span><strong>{job.pay || "급여 협의"}</strong><b>상세 보기 →</b></footer></Link>;
}

function destinationImage(value) {
  if (!value) return "/assets/jeolla-region-map.png";
  if (/^(https?:|data:|\/)/.test(value)) return value;
  return `/${value}`;
}

function MapDestinationItem({ destination }) {
  return <Link className="map-job-item map-destination-item" to={`/destinations/${destination.id}`}>
    <img src={destinationImage(destination.imageUrl)} alt="" />
    <div><span>{destination.category || "관광지"}</span><h3>{destination.name}</h3><p>{destination.description || `${destination.region} 관광지`}</p></div>
    <div className="job-meta"><span>★ {Number(destination.rating || 0).toFixed(1)}</span>{destination.transport && <span>{destination.transport}</span>}{destination.companion && <span>{destination.companion}</span>}</div>
    <footer><span>{destination.address || `${destination.region} 관광 생활권`}</span><b>상세 보기 →</b></footer>
  </Link>;
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedRegion = params.get("region") || "전체";
  const [keyword, setKeyword] = useState("");
  const [view, setView] = useState("map");
  const [resultMode, setResultMode] = useState("jobs");
  const [summaryView, setSummaryView] = useState("region");
  const [regionSummary, setRegionSummary] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const regionQuery = selectedRegion !== "전체" ? `?region=${encodeURIComponent(selectedRegion)}` : "";
  const jobsApi = useApi(`/api/jobs${regionQuery}`);
  const destinationsApi = useApi(`/api/destinations${regionQuery}`);
  const jobs = asList(jobsApi.data, "jobs").filter((job) => !keyword || `${job.title} ${job.companyName} ${job.category}`.includes(keyword));
  const destinations = asList(destinationsApi.data).filter((destination) => !keyword || `${destination.name} ${destination.category} ${destination.description}`.includes(keyword));
  const activeItems = resultMode === "jobs" ? jobs : destinations;
  const activeLoading = resultMode === "jobs" ? jobsApi.loading : destinationsApi.loading;
  const activeError = resultMode === "jobs" ? jobsApi.error : destinationsApi.error;
  const resultTitle = selectedRegion === "전체" ? "전체" : selectedRegion;

  function chooseRegion(region) {
    setParams(region === "전체" ? {} : { region });
  }

  useEffect(() => {
    let cancelled = false;
    setRegionSummary(null); setReviewSummary(null); setReviewError("");
    if (selectedRegion === "전체") return () => { cancelled = true; };
    setReviewLoading(true);
    apiRequest(`/api/regions/summary?region=${encodeURIComponent(selectedRegion)}`)
      .then((result) => { if (!cancelled) setRegionSummary(result); })
      .catch((requestError) => { if (!cancelled) setReviewError(requestError.message); })
      .finally(() => { if (!cancelled) setReviewLoading(false); });
    return () => { cancelled = true; };
  }, [selectedRegion]);

  useEffect(() => {
    let cancelled = false;
    if (summaryView !== "reviews" || selectedRegion === "전체" || !regionSummary?.reviewCount) return () => { cancelled = true; };
    setReviewLoading(true); setReviewError("");
    apiRequest(`/api/regions/review-summary?region=${encodeURIComponent(selectedRegion)}`)
      .then((result) => { if (!cancelled) setReviewSummary(result); })
      .catch((requestError) => { if (!cancelled) setReviewError(requestError.message); })
      .finally(() => { if (!cancelled) setReviewLoading(false); });
    return () => { cancelled = true; };
  }, [summaryView, selectedRegion, regionSummary?.reviewCount]);

  const regionPanel = summaryView === "region" ? <>
    <div><p className="eyebrow dark">지역 정보</p><h1>{selectedRegion === "전체" ? <>지역을<br />선택해 주세요</> : <>{selectedRegion}<br />여행 생활권</>}</h1></div>
    <p className="region-summary-copy">{selectedRegion === "전체" ? "지도에서 지역을 선택하면 관광지 평점과 여행자 리뷰를 확인할 수 있어요." : regionSummary?.destinationCount ? `${selectedRegion}에 등록된 관광지 ${regionSummary.destinationCount}곳의 평가와 여행 이야기를 모았어요.` : `${selectedRegion}의 관광지와 등록된 로컬 일자리를 확인하고 있어요.`}</p>
    {selectedRegion !== "전체" && <dl className="region-summary-metrics"><div><dt>★ {Number(regionSummary?.averageRating || 0).toFixed(1)}</dt><dd>평균 별점</dd></div><div><dt>{regionSummary?.reviewCount || 0}개</dt><dd>여행 리뷰</dd></div></dl>}
  </> : <>
    <div><p className="eyebrow dark">리뷰 요약</p><h1>{selectedRegion === "전체" ? <>지역을<br />선택해 주세요</> : <>{selectedRegion}<br />여행 리뷰</>}</h1></div>
    {selectedRegion === "전체" ? <p className="region-summary-copy">지도에서 지역을 선택하면 여행자 리뷰의 공통 의견을 확인할 수 있어요.</p> : reviewLoading ? <p className="region-summary-copy">{selectedRegion} 여행 리뷰를 불러오고 있어요.</p> : reviewError ? <p className="region-summary-copy">{reviewError}</p> : !regionSummary?.reviewCount ? <div className="region-review-list"><article className="ai-review-summary"><strong>작성된 리뷰가 아직 없어요</strong><p>{selectedRegion} 여행 리뷰가 등록되면 공통 의견을 요약해 드려요.</p></article></div> : <><dl className="region-summary-metrics"><div><dt>★ {Number(regionSummary.averageRating || 0).toFixed(1)}</dt><dd>평균 별점</dd></div><div><dt>{regionSummary.reviewCount}개</dt><dd>여행 리뷰</dd></div></dl><div className="region-review-list"><article className="ai-review-summary"><span>{reviewSummary?.aiEnabled ? "AI REVIEW SUMMARY" : "REVIEW SUMMARY"}</span><strong>{selectedRegion} 여행자들의 공통 의견</strong><p>{reviewSummary?.summary || "등록된 리뷰를 종합하고 있어요."}</p></article>{(regionSummary.reviews || []).slice(0, 2).map((review) => <article key={review.id}><div><strong>{review.nickname || review.username}</strong><span>{review.concept || "여행 이야기"}</span></div><span className="region-review-stars">{"★".repeat(Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))))}</span><p>{review.content}</p></article>)}</div></>}
  </>;

  return <div className={`react-map-route${view === "search" ? " is-job-search-mode" : ""}`}><main className="map-page-main react-map-page-main">
    <section className="job-view-switch" aria-label="일자리 보기 방식"><button className={view === "map" ? "is-active" : ""} type="button" onClick={() => setView("map")}><span aria-hidden="true">⌖</span><strong>지도</strong></button><button className={view === "search" ? "is-active" : ""} type="button" onClick={() => setView("search")}><span aria-hidden="true">⌕</span><strong>검색</strong></button></section>
    {view === "map" ? <section className="map-controls-panel region-summary-panel"><div className="map-summary-tabs"><button className={summaryView === "region" ? "is-active" : ""} type="button" aria-pressed={summaryView === "region"} onClick={() => setSummaryView("region")}>지역 정보</button><button className={summaryView === "reviews" ? "is-active" : ""} type="button" aria-pressed={summaryView === "reviews"} onClick={() => setSummaryView("reviews")}>리뷰 요약</button></div>{regionPanel}</section> : <section className="job-search-panel"><div className="job-detail-card-head"><h2>일자리 검색</h2></div><p>지역과 직무를 기준으로 관광 일자리를 찾아보세요.</p><form onSubmit={(event) => event.preventDefault()}><label>지역<select value={selectedRegion} onChange={(event) => chooseRegion(event.target.value)}>{["전체", ...mapRegions].map((region) => <option key={region}>{region}</option>)}</select></label><label>직무·회사<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="검색어 입력" /></label><button className="button button-primary" type="submit">조건으로 검색하기</button><button className="button" type="button" onClick={() => { chooseRegion("전체"); setKeyword(""); }}>전체 공고 보기</button></form></section>}
    {view === "map" && <section className="map-canvas-panel"><div className="map-canvas-scroll-content"><div className="map-canvas-heading"><div><p className="eyebrow dark">관광지·일자리 탐색</p><h2>전라도에서 원하는 지역을 선택하세요</h2></div><strong>{selectedRegion === "전체" ? "선택 전" : selectedRegion}</strong></div><div className="map-filter-chips" aria-label="지역 빠른 선택">{mapRegions.map((region) => <button className={selectedRegion === region ? "is-selected" : ""} type="button" key={region} onClick={() => chooseRegion(region)}>{region}</button>)}</div><div className="jeolla-map" aria-label="전라도 지역 선택 지도"><img className="map-image" src="/assets/jeolla-region-map.png" alt="산과 섬을 표현한 전라도 안내 지도" />{mapRegions.map((region) => <button className={`map-pin${selectedRegion === region ? " is-selected" : ""}`} style={{ "--x": mapPinPositions[region].x, "--y": mapPinPositions[region].y }} type="button" key={region} onClick={() => chooseRegion(region)}>{region}</button>)}<div className="map-legend"><span />선택 가능 지역</div></div></div></section>}
    <aside className="map-results-panel">
      <div className="map-result-tabs" role="tablist" aria-label="조회 결과 유형">
        <button className={resultMode === "jobs" ? "is-active" : ""} type="button" role="tab" aria-selected={resultMode === "jobs"} onClick={() => setResultMode("jobs")}>일자리 보기</button>
        <button className={resultMode === "destinations" ? "is-active" : ""} type="button" role="tab" aria-selected={resultMode === "destinations"} onClick={() => setResultMode("destinations")}>관광지 보기</button>
      </div>
      <div className="map-results-heading"><div><p className="eyebrow dark">{resultMode === "jobs" ? "일자리 조회 결과" : "관광지 조회 결과"}</p><h2>{resultTitle} {resultMode === "jobs" ? "일자리" : "관광지"}</h2></div><strong>{activeItems.length}</strong></div>
      {activeLoading ? <div className="jobs-status is-visible">데이터를 불러오는 중입니다.</div> : activeError ? <div className="jobs-status is-visible">{activeError}</div> : activeItems.length ? <div className="map-job-list">{resultMode === "jobs" ? jobs.map((job) => <MapJobItem job={job} key={job.id} />) : destinations.map((destination) => <MapDestinationItem destination={destination} key={destination.id} />)}</div> : <div className="jobs-status is-visible is-empty">조건에 맞는 결과가 없습니다.</div>}
    </aside>
  </main></div>;
}
