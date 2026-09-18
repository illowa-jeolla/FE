import BrandCharacter from "../components/BrandCharacter";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getRegion, getRegions } from "../api/regions";
import { externalJobDetailPath, getExternalJobsBatch } from "../api/jobs";
import RegionIllustrationMap from "../components/RegionIllustrationMap";
import { isJeonnamJob, jeonnamRegionName } from "../data/jeonnam";
import { asList } from "../hooks/useApi";
import { dateValue, displayDate, JobCalendarMonth, timeOptions, workTypes } from "./JobsPage";

const jobPhotos = [
  new URL("../../../assets/J6aHjc.jpeg", import.meta.url).href,
  new URL("../../../assets/JvLTt.jpeg", import.meta.url).href,
  new URL("../../../assets/lX3GW.jpeg", import.meta.url).href,
  new URL("../../../assets/OZ3bs.jpeg", import.meta.url).href,
  new URL("../../../assets/s6jB4w.jpeg", import.meta.url).href,
  new URL("../../../assets/u3OD9c.jpeg", import.meta.url).href,
  new URL("../../../assets/wt960.jpeg", import.meta.url).href,
  new URL("../../../assets/y0SxMq.jpeg", import.meta.url).href
];

function jobPhoto(job) {
  return jobPhotos[Math.abs(Number(job.id) || 0) % jobPhotos.length];
}

function MapJobItem({ job }) {
  const employer = String(job.employerName || "").trim();
  const location = job.location || job.regionName || "위치 정보 확인";
  return <Link className="map-job-item" to={externalJobDetailPath(job)}><img className="map-job-photo" src={jobPhoto(job)} alt={`${job.regionName || "전라도"} 일자리 현장`} /><div className="map-job-heading">{job.externalSource !== "junnam" && <span>{job.category}</span>}<h3>{job.title}</h3>{employer && employer !== "관리자" && <p className="map-job-employer">{employer}</p>}</div><div className="job-meta">{[job.workType, job.workHours, job.employmentPeriod].filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div><footer><span className="map-job-location">{location}</span><strong>{job.salaryText || "상세 조건 확인"}</strong><b>상세 보기 →</b></footer></Link>;
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedRegion = jeonnamRegionName(params.get("region")) || "전체";
  const [jobFilters, setJobFilters] = useState({ tripStart: "", tripEnd: "", workType: "", time: "" });
  const [openPicker, setOpenPicker] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [jobTitleQuery, setJobTitleQuery] = useState("");
  const [submittedJobTitleQuery, setSubmittedJobTitleQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false); const [draftStart, setDraftStart] = useState(null); const [draftEnd, setDraftEnd] = useState(null);
  const [timeOpen, setTimeOpen] = useState(false); const [draftTimeStart, setDraftTimeStart] = useState("09:00"); const [draftTimeEnd, setDraftTimeEnd] = useState("18:00");
  const jobFilterRef = useRef(null); const todayRef = useRef(new Date()); todayRef.current.setHours(0, 0, 0, 0);
  const [calendarCursor, setCalendarCursor] = useState(new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
  const [view, setView] = useState(() => params.get("view") === "search" ? "search" : "map");
  const [summaryView, setSummaryView] = useState("region");
  const [regionSummary, setRegionSummary] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [regionRecords, setRegionRecords] = useState([]);
  const [regionsError, setRegionsError] = useState("");
  const mapRegions = regionRecords.map((region) => region.name);
  const selectedRegionRecord = regionRecords.find((region) => region.name === selectedRegion);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsFetchingMore, setJobsFetchingMore] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsHasMore, setJobsHasMore] = useState(true);
  const [visibleJobCount, setVisibleJobCount] = useState(20);
  const [visibleMapJobCount, setVisibleMapJobCount] = useState(10);
  const resultTitle = selectedRegion === "전체" ? "전체" : selectedRegion;
  const normalizedJobTitleQuery = submittedJobTitleQuery.trim().toLocaleLowerCase();
  const filteredJobs = jobs.filter((job) => String(job.title || "").toLocaleLowerCase().includes(normalizedJobTitleQuery));
  const visibleJobs = filteredJobs.slice(0, visibleJobCount);
  const emptyRegionJobsMessage = selectedRegion === "전체" ? "일자리 정보가 없습니다." : `${selectedRegion}에 일자리 정보가 없습니다.`;
  const jobsAuthenticationError = /로그인|인증|토큰|세션/.test(jobsError);
  const jobsErrorView = <div className="jobs-status is-visible is-error"><BrandCharacter pose="error" /><p>{jobsError}</p>{jobsAuthenticationError && <Link className="button button-primary" to="/auth?returnTo=%2Fmap">다시 로그인하기</Link>}</div>;

  function chooseRegion(region) {
    const next = {};
    if (view === "search") next.view = "search";
    if (region !== "전체") next.region = region;
    setParams(next);
  }

  function chooseView(nextView) {
    setView(nextView);
    const next = {};
    if (nextView === "search") next.view = "search";
    if (selectedRegion !== "전체") next.region = selectedRegion;
    setParams(next);
  }

  useEffect(() => {
    if (params.has("region") && !jeonnamRegionName(params.get("region"))) {
      const next = new URLSearchParams(params);
      next.delete("region");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    let cancelled = false;
    getRegions()
      .then((result) => {
        if (cancelled) return;
        const list = asList(result, "regions").filter((region) => jeonnamRegionName(region.name)).map((region) => ({ ...region, name: jeonnamRegionName(region.name) }));
        setRegionRecords(list);
        setRegionsError("");
      })
      .catch((requestError) => { if (!cancelled) setRegionsError(requestError.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function closePicker(event) { if (!jobFilterRef.current?.contains(event.target)) { setOpenPicker(""); setRegionFilter(""); } }
    document.addEventListener("pointerdown", closePicker); return () => document.removeEventListener("pointerdown", closePicker);
  }, []);

  function openDatePicker() {
    const start = jobFilters.tripStart ? new Date(`${jobFilters.tripStart}T00:00:00`) : null; const end = jobFilters.tripEnd ? new Date(`${jobFilters.tripEnd}T00:00:00`) : null;
    setDraftStart(start); setDraftEnd(end); setCalendarCursor(start ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)); setDateOpen(true);
  }
  function selectJobDate(date) { if (!draftStart || draftEnd || date <= draftStart) { setDraftStart(date); setDraftEnd(null); } else setDraftEnd(date); }

  function submitJobTitleSearch(event) {
    event.preventDefault();
    setSubmittedJobTitleQuery(jobTitleQuery.trim());
    setVisibleJobCount(20);
  }

  useEffect(() => {
    let cancelled = false;
    setVisibleJobCount(20);
    setVisibleMapJobCount(10);
    setJobs([]); setJobsLoading(true); setJobsFetchingMore(true); setJobsError("");
    setJobsPage(1); setJobsHasMore(true);
    getExternalJobsBatch({ region: selectedRegion === "전체" ? "" : selectedRegion, page: 1 })
      .then((result) => { if (!cancelled) { setJobs(result.items.filter(isJeonnamJob)); setJobsHasMore(result.hasMore); } })
      .catch((requestError) => { if (!cancelled) { setJobs([]); setJobsError(requestError.message); } })
      .finally(() => { if (!cancelled) { setJobsLoading(false); setJobsFetchingMore(false); } });
    return () => { cancelled = true; };
  }, [selectedRegion]);

  async function loadMoreJobs() {
    if (visibleJobCount < filteredJobs.length) {
      setVisibleJobCount((count) => count + 20);
      return;
    }
    if (!jobsHasMore || jobsFetchingMore) return;
    const nextPage = jobsPage + 1;
    setJobsFetchingMore(true); setJobsError("");
    try {
      const result = await getExternalJobsBatch({ region: selectedRegion === "전체" ? "" : selectedRegion, page: nextPage });
      setJobs((current) => {
        const seen = new Set(current.map((job) => job.id));
        return [...current, ...result.items.filter((job) => isJeonnamJob(job) && !seen.has(job.id))];
      });
      setJobsPage(nextPage); setJobsHasMore(result.hasMore); setVisibleJobCount((count) => count + 20);
    } catch (requestError) {
      if (!jobs.length) setJobsError(requestError.message);
    } finally {
      setJobsFetchingMore(false);
    }
  }

  async function loadMoreMapJobs() {
    if (visibleMapJobCount < jobs.length) {
      setVisibleMapJobCount((count) => count + 10);
      return;
    }
    if (!jobsHasMore || jobsFetchingMore) return;
    const nextPage = jobsPage + 1;
    setJobsFetchingMore(true); setJobsError("");
    try {
      const result = await getExternalJobsBatch({ region: selectedRegion === "전체" ? "" : selectedRegion, page: nextPage });
      setJobs((current) => {
        const seen = new Set(current.map((job) => job.id));
        return [...current, ...result.items.filter((job) => isJeonnamJob(job) && !seen.has(job.id))];
      });
      setJobsPage(nextPage); setJobsHasMore(result.hasMore); setVisibleMapJobCount((count) => count + 10);
    } catch (requestError) {
      if (!jobs.length) setJobsError(requestError.message);
    } finally {
      setJobsFetchingMore(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setRegionSummary(null); setReviewSummary(null); setReviewError("");
    if (selectedRegion === "전체" || !selectedRegionRecord?.id) return () => { cancelled = true; };
    setReviewLoading(true);
    getRegion(selectedRegionRecord.id)
      .then((region) => { if (!cancelled) setRegionSummary(region); })
      .catch((requestError) => { if (!cancelled) setReviewError(requestError.message); })
      .finally(() => { if (!cancelled) setReviewLoading(false); });
    return () => { cancelled = true; };
  }, [selectedRegion, selectedRegionRecord?.id]);

  useEffect(() => {
    let cancelled = false;
    if (summaryView !== "reviews" || selectedRegion === "전체" || !regionSummary?.reviewCount) return () => { cancelled = true; };
    setReviewLoading(true); setReviewError("");
    setReviewSummary({ summary: "관광지별 리뷰는 관광지 상세 화면에서 확인할 수 있어요.", aiEnabled: false });
    setReviewLoading(false);
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

  return <main className={`map-page-main${view === "search" ? " is-job-search-mode" : ""}`}>
    <section className="job-view-switch" aria-label="일자리 보기 방식"><button className={view === "map" ? "is-active" : ""} type="button" onClick={() => chooseView("map")}><span aria-hidden="true">⌖</span><strong>지도</strong></button><button className={view === "search" ? "is-active" : ""} type="button" onClick={() => chooseView("search")}><span aria-hidden="true">⌕</span><strong>검색</strong></button></section>
    {view === "map" ? <section className="map-controls-panel region-summary-panel"><div className="map-summary-tabs"><button className={summaryView === "region" ? "is-active" : ""} type="button" aria-pressed={summaryView === "region"} onClick={() => setSummaryView("region")}>지역 정보</button><button className={summaryView === "reviews" ? "is-active" : ""} type="button" aria-pressed={summaryView === "reviews"} onClick={() => setSummaryView("reviews")}>리뷰 요약</button></div>{regionPanel}</section> : <section className="job-search-panel"><div className="job-detail-card-head"><h2>일자리 검색</h2><span>외부 공고</span></div><form className="job-search-form map-job-search-form" ref={jobFilterRef} onSubmit={submitJobTitleSearch}>
      <label className="job-picker-field">지역 검색<div className="job-picker-trigger job-region-search-trigger"><input value={openPicker === "region" ? regionFilter : selectedRegion === "전체" ? "" : selectedRegion} placeholder="지역을 선택해 주세요" autoComplete="off" aria-expanded={openPicker === "region"} onFocus={() => { setRegionFilter(""); setOpenPicker("region"); }} onChange={(event) => { setRegionFilter(event.target.value); setOpenPicker("region"); }} /><i /></div>{openPicker === "region" && <section className="job-option-popover"><div>{["전체", ...mapRegions].filter((region) => !regionFilter.trim() || region.includes(regionFilter.trim())).map((region) => <button className={selectedRegion === region ? "is-selected" : ""} type="button" key={region} onClick={(event) => { event.preventDefault(); chooseRegion(region); setRegionFilter(""); setOpenPicker(""); }}><span>{region}</span>{selectedRegion === region && <i>✓</i>}</button>)}</div></section>}</label>
      <label className="job-title-search-field">제목 검색<div><span aria-hidden="true">⌕</span><input value={jobTitleQuery} placeholder="공고 제목을 검색해 주세요" autoComplete="off" onChange={(event) => setJobTitleQuery(event.target.value)} />{jobTitleQuery && <button type="button" aria-label="제목 검색어 지우기" onClick={() => { setJobTitleQuery(""); setSubmittedJobTitleQuery(""); setVisibleJobCount(20); }}>×</button>}</div></label>
      <button className="button button-primary" type="submit" disabled={jobsLoading}>{jobsLoading ? "검색 중..." : "제목으로 검색하기"}</button>
      </form></section>}
    {view === "map" && <section className="map-canvas-panel"><div className="map-canvas-scroll-content"><div className="map-canvas-heading"><h2><BrandCharacter pose="travel" />원하는 지역을 선택하세요</h2></div><div className="jeolla-map"><RegionIllustrationMap items={regionRecords} selectedName={selectedRegion === "전체" ? "" : selectedRegion} onSelect={(item) => chooseRegion(item.name)} /></div></div></section>}
    {dateOpen && <div className="travel-calendar-popover job-calendar-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDateOpen(false); }}><section className="travel-calendar-dialog job-calendar-dialog" role="dialog" aria-modal="true"><header><h2>여행 날짜를 선택하세요</h2><button type="button" aria-label="닫기" onClick={() => setDateOpen(false)}>×</button></header><div className="travel-calendar-nav"><button type="button" aria-label="이전 달" disabled={calendarCursor <= new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)} onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="다음 달" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="travel-calendar-months"><JobCalendarMonth monthDate={calendarCursor} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectJobDate} /><JobCalendarMonth monthDate={new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectJobDate} /></div><footer><button type="button" disabled={!draftStart || !draftEnd} onClick={() => { setJobFilters((current) => ({ ...current, tripStart: dateValue(draftStart), tripEnd: dateValue(draftEnd) })); setDateOpen(false); }}>적용하기</button></footer></section></div>}
    {timeOpen && <div className="job-time-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setTimeOpen(false); }}><section className="job-time-dialog" role="dialog" aria-modal="true"><header><div><span>WORK HOURS</span><h2>희망 시간을 선택하세요</h2></div><button type="button" aria-label="닫기" onClick={() => setTimeOpen(false)}>×</button></header><div className="job-time-columns"><label><span>시작 시간</span><select value={draftTimeStart} onChange={(event) => { const next = event.target.value; setDraftTimeStart(next); if (draftTimeEnd <= next) setDraftTimeEnd(timeOptions.find((time) => time > next) || "21:00"); }}>{timeOptions.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label><div className="job-time-line"><i /><span>근무</span><i /></div><label><span>종료 시간</span><select value={draftTimeEnd} onChange={(event) => setDraftTimeEnd(event.target.value)}>{timeOptions.filter((time) => time > draftTimeStart).map((time) => <option key={time}>{time}</option>)}</select></label></div><div className="job-time-presets">{[["오전", "09:00", "13:00"], ["오후", "13:00", "18:00"], ["종일", "09:00", "18:00"]].map(([label, start, end]) => <button type="button" key={label} onClick={() => { setDraftTimeStart(start); setDraftTimeEnd(end); }}>{label}<small>{start}–{end}</small></button>)}</div><footer><button type="button" onClick={() => { setJobFilters((current) => ({ ...current, time: `${draftTimeStart}~${draftTimeEnd}` })); setTimeOpen(false); }}>적용하기</button></footer></section></div>}
    <aside className="map-results-panel">
      {view === "search" && jobsLoading && !jobs.length && <section className="jobs-loading-state"><BrandCharacter pose="loading" /><h3>일자리를 불러오고 있어요</h3><p>먼저 도착한 공고부터 곧 보여드릴게요.</p></section>}
      {view === "map" ? <><div className="map-results-heading"><div><p className="eyebrow dark">일자리 조회 결과</p><h2>{resultTitle} 일자리</h2></div></div>{jobsLoading ? <div className="jobs-status is-visible" role="status"><BrandCharacter pose="loading" />일자리를 불러오는 중입니다.</div> : jobsError ? jobsErrorView : (jobs.length || jobsHasMore) ? <><div className="map-job-list">{jobs.slice(0, visibleMapJobCount).map((job) => <MapJobItem job={job} key={job.id} />)}</div>{(visibleMapJobCount < jobs.length || jobsHasMore) && <button className="map-jobs-more-button" type="button" disabled={jobsFetchingMore} onClick={loadMoreMapJobs}>{jobsFetchingMore ? "불러오는 중..." : "더보기"}</button>}</> : <div className="jobs-status is-visible is-empty"><BrandCharacter pose="empty" />{emptyRegionJobsMessage}</div>}</> : <><div className="map-results-heading"><div><p className="eyebrow dark">일자리 조회 결과</p><h2>{resultTitle} 일자리</h2></div></div>{jobsLoading ? <div className="jobs-status is-visible" role="status"><BrandCharacter pose="loading" />데이터를 불러오는 중입니다.</div> : jobsError ? jobsErrorView : filteredJobs.length ? <><div className="map-job-list">{visibleJobs.map((job) => <MapJobItem job={job} key={job.id} />)}</div>{visibleJobCount < filteredJobs.length && <button className="map-jobs-more-button" type="button" onClick={() => setVisibleJobCount((count) => count + 20)}>더보기</button>}</> : <div className="jobs-status is-visible is-empty"><BrandCharacter pose="empty" />{normalizedJobTitleQuery ? "제목과 지역 조건에 맞는 일자리가 없습니다." : emptyRegionJobsMessage}</div>}</>}
      {view === "search" && !jobsFetchingMore && jobsHasMore && visibleJobCount >= filteredJobs.length && <button className="map-jobs-more-button" type="button" onClick={loadMoreJobs}>더보기</button>}
      {view === "search" && jobsFetchingMore && jobs.length > 0 && <p className="jobs-progress-note">다음 일자리를 불러오는 중입니다.</p>}
    </aside>
  </main>;
}
