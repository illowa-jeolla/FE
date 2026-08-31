import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getRegion, getRegionPlaces, getRegions } from "../api/regions";
import KakaoMarkerMap from "../components/KakaoMarkerMap";
import { asList, useApi } from "../hooks/useApi";
import { dateValue, displayDate, JobCalendarMonth, jobsPath, timeOptions, workTypes } from "./JobsPage";

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
  return <Link className="map-job-item" to={`/jobs/${job.id}`}><img className="map-job-photo" src={jobPhoto(job)} alt={`${job.regionName || "전라도"} 일자리 현장`} /><div><span>{job.category || "관광 운영"}</span><h3>{job.title}</h3><p>{job.employerName}</p></div><div className="job-meta">{[job.workType, job.workHours, job.employmentPeriod].filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div><footer><span>{job.location || `${job.regionName} 주요 관광지 인근`}</span><strong>{job.salaryText || "급여 협의"}</strong><b>상세 보기 →</b></footer></Link>;
}

function placeImage(place) {
  return place.imageUrl || place.image || place.thumbnailUrl || place.firstImage || "/assets/jeolla-region-map.png";
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedRegion = params.get("region") || "전체";
  const [jobFilters, setJobFilters] = useState({ tripStart: "", tripEnd: "", workType: "", time: "" });
  const [openPicker, setOpenPicker] = useState(""); const [regionFilter, setRegionFilter] = useState("");
  const [dateOpen, setDateOpen] = useState(false); const [draftStart, setDraftStart] = useState(null); const [draftEnd, setDraftEnd] = useState(null);
  const [timeOpen, setTimeOpen] = useState(false); const [draftTimeStart, setDraftTimeStart] = useState("09:00"); const [draftTimeEnd, setDraftTimeEnd] = useState("18:00");
  const jobFilterRef = useRef(null); const todayRef = useRef(new Date()); todayRef.current.setHours(0, 0, 0, 0);
  const [calendarCursor, setCalendarCursor] = useState(new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
  const [view, setView] = useState("map");
  const [summaryView, setSummaryView] = useState("region");
  const [regionSummary, setRegionSummary] = useState(null);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [regionRecords, setRegionRecords] = useState([]);
  const [places, setPlaces] = useState([]);
  const [regionsError, setRegionsError] = useState("");
  const mapRegions = regionRecords.map((region) => region.name);
  const selectedRegionRecord = regionRecords.find((region) => region.name === selectedRegion);
  const jobsApi = useApi(jobsPath({ ...jobFilters, region: selectedRegion === "전체" ? "" : selectedRegion }, regionRecords));
  const jobs = Array.isArray(jobsApi.data?.content) ? jobsApi.data.content : asList(jobsApi.data, "jobs");
  const resultTitle = selectedRegion === "전체" ? "전체" : selectedRegion;

  function chooseRegion(region) {
    setParams(region === "전체" ? {} : { region });
  }

  useEffect(() => {
    let cancelled = false;
    getRegions({ parentId: 1 })
      .then((result) => {
        if (cancelled) return;
        const list = asList(result, "regions");
        setRegionRecords(list);
        setRegionsError("");
      })
      .catch((requestError) => { if (!cancelled) setRegionsError(requestError.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function closePicker(event) { if (!jobFilterRef.current?.contains(event.target)) setOpenPicker(""); }
    document.addEventListener("pointerdown", closePicker); return () => document.removeEventListener("pointerdown", closePicker);
  }, []);

  function openDatePicker() {
    const start = jobFilters.tripStart ? new Date(`${jobFilters.tripStart}T00:00:00`) : null; const end = jobFilters.tripEnd ? new Date(`${jobFilters.tripEnd}T00:00:00`) : null;
    setDraftStart(start); setDraftEnd(end); setCalendarCursor(start ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)); setDateOpen(true);
  }
  function selectJobDate(date) { if (!draftStart || draftEnd || date <= draftStart) { setDraftStart(date); setDraftEnd(null); } else setDraftEnd(date); }

  useEffect(() => {
    let cancelled = false;
    setRegionSummary(null); setReviewSummary(null); setReviewError("");
    if (selectedRegion === "전체" || !selectedRegionRecord?.id) { setPlaces([]); return () => { cancelled = true; }; }
    setReviewLoading(true);
    Promise.all([getRegion(selectedRegionRecord.id), getRegionPlaces(selectedRegionRecord.id)])
      .then(([region, placeResult]) => { if (!cancelled) { setRegionSummary({ ...region, destinationCount: region.placeCount ?? asList(placeResult, "places").length }); setPlaces(asList(placeResult, "places")); } })
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
    <section className="job-view-switch" aria-label="일자리 보기 방식"><button className={view === "map" ? "is-active" : ""} type="button" onClick={() => setView("map")}><span aria-hidden="true">⌖</span><strong>지도</strong></button><button className={view === "search" ? "is-active" : ""} type="button" onClick={() => setView("search")}><span aria-hidden="true">⌕</span><strong>검색</strong></button></section>
    {view === "map" ? <section className="map-controls-panel region-summary-panel"><div className="map-summary-tabs"><button className={summaryView === "region" ? "is-active" : ""} type="button" aria-pressed={summaryView === "region"} onClick={() => setSummaryView("region")}>지역 정보</button><button className={summaryView === "reviews" ? "is-active" : ""} type="button" aria-pressed={summaryView === "reviews"} onClick={() => setSummaryView("reviews")}>리뷰 요약</button></div>{regionPanel}</section> : <section className="job-search-panel"><div className="job-detail-card-head"><h2>일자리 검색</h2><span>DB 공고</span></div><form className="job-search-form map-job-search-form" ref={jobFilterRef} onSubmit={(event) => event.preventDefault()}>
      <label className="job-picker-field">지역 검색<button className="job-picker-trigger" type="button" aria-expanded={openPicker === "region"} onClick={() => setOpenPicker((current) => current === "region" ? "" : "region")}><span>{selectedRegion === "전체" ? "지역을 선택해 주세요" : selectedRegion}</span><i /></button>{openPicker === "region" && <section className="job-option-popover"><input value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} placeholder="지역 이름 검색" autoFocus /><div>{["전체", ...mapRegions].filter((region) => !regionFilter || region.includes(regionFilter)).map((region) => <button className={selectedRegion === region ? "is-selected" : ""} type="button" key={region} onClick={() => { chooseRegion(region); setRegionFilter(region === "전체" ? "" : region); setOpenPicker(""); }}><span>{region}</span>{selectedRegion === region && <i>✓</i>}</button>)}</div></section>}</label>
      <fieldset className="map-job-date-group"><legend>여행 기간</legend><button className="job-date-trigger" type="button" aria-expanded={dateOpen} onClick={openDatePicker}><span className="job-picker-icon">▦</span><strong>{jobFilters.tripStart && jobFilters.tripEnd ? `${displayDate(jobFilters.tripStart)} → ${displayDate(jobFilters.tripEnd)}` : "날짜를 선택해 주세요"}</strong><i /></button></fieldset>
      <label className="job-picker-field">일하는 방식<button className="job-picker-trigger" type="button" aria-expanded={openPicker === "work"} onClick={() => setOpenPicker((current) => current === "work" ? "" : "work")}><span>{jobFilters.workType || "근무 방식 선택"}</span><i /></button>{openPicker === "work" && <section className="job-option-popover job-work-popover"><div>{workTypes.map((item) => <button className={jobFilters.workType === item ? "is-selected" : ""} type="button" key={item} onClick={() => { setJobFilters((current) => ({ ...current, workType: item })); setOpenPicker(""); }}><span>{item}</span>{jobFilters.workType === item && <i>✓</i>}</button>)}</div></section>}</label>
      <label>희망 시간<button className="job-time-trigger" type="button" aria-expanded={timeOpen} onClick={() => { const [start = "09:00", end = "18:00"] = jobFilters.time.split("~"); setDraftTimeStart(start); setDraftTimeEnd(end); setTimeOpen(true); }}><span className="job-picker-icon">◷</span><strong>{jobFilters.time || "시간을 선택해 주세요"}</strong><i /></button></label>
      <button className="button button-primary" type="submit">조건으로 검색하기</button><button className="button" type="button" onClick={() => { chooseRegion("전체"); setRegionFilter(""); setJobFilters({ tripStart: "", tripEnd: "", workType: "", time: "" }); }}>전체 공고 보기</button></form></section>}
    {view === "map" && <section className="map-canvas-panel"><div className="map-canvas-scroll-content"><div className="map-canvas-heading"><div><p className="eyebrow dark">관광지·일자리 탐색</p><h2>전라도에서 원하는 지역을 선택하세요</h2></div><strong>{selectedRegion === "전체" ? "선택 전" : selectedRegion}</strong></div>{regionsError && <p className="map-api-warning">지역 API 연결 실패: {regionsError}</p>}<div className="map-filter-chips" aria-label="지역 빠른 선택">{mapRegions.map((region) => <button className={selectedRegion === region ? "is-selected" : ""} type="button" key={region} onClick={() => chooseRegion(region)}>{region}</button>)}</div><div className="jeolla-map"><KakaoMarkerMap items={regionRecords} selectedId={selectedRegionRecord?.id} onSelect={(item) => chooseRegion(item.name)} label="전라도 지역 선택 카카오 지도" /></div></div></section>}
    {dateOpen && <div className="travel-calendar-popover job-calendar-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDateOpen(false); }}><section className="travel-calendar-dialog job-calendar-dialog" role="dialog" aria-modal="true"><header><h2>여행 날짜를 선택하세요</h2><button type="button" aria-label="닫기" onClick={() => setDateOpen(false)}>×</button></header><div className="travel-calendar-nav"><button type="button" aria-label="이전 달" disabled={calendarCursor <= new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)} onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="다음 달" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="travel-calendar-months"><JobCalendarMonth monthDate={calendarCursor} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectJobDate} /><JobCalendarMonth monthDate={new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectJobDate} /></div><footer><button type="button" disabled={!draftStart || !draftEnd} onClick={() => { setJobFilters((current) => ({ ...current, tripStart: dateValue(draftStart), tripEnd: dateValue(draftEnd) })); setDateOpen(false); }}>적용하기</button></footer></section></div>}
    {timeOpen && <div className="job-time-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setTimeOpen(false); }}><section className="job-time-dialog" role="dialog" aria-modal="true"><header><div><span>WORK HOURS</span><h2>희망 시간을 선택하세요</h2></div><button type="button" aria-label="닫기" onClick={() => setTimeOpen(false)}>×</button></header><div className="job-time-columns"><label><span>시작 시간</span><select value={draftTimeStart} onChange={(event) => { const next = event.target.value; setDraftTimeStart(next); if (draftTimeEnd <= next) setDraftTimeEnd(timeOptions.find((time) => time > next) || "21:00"); }}>{timeOptions.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label><div className="job-time-line"><i /><span>근무</span><i /></div><label><span>종료 시간</span><select value={draftTimeEnd} onChange={(event) => setDraftTimeEnd(event.target.value)}>{timeOptions.filter((time) => time > draftTimeStart).map((time) => <option key={time}>{time}</option>)}</select></label></div><div className="job-time-presets">{[["오전", "09:00", "13:00"], ["오후", "13:00", "18:00"], ["종일", "09:00", "18:00"]].map(([label, start, end]) => <button type="button" key={label} onClick={() => { setDraftTimeStart(start); setDraftTimeEnd(end); }}>{label}<small>{start}–{end}</small></button>)}</div><footer><button type="button" onClick={() => { setJobFilters((current) => ({ ...current, time: `${draftTimeStart}~${draftTimeEnd}` })); setTimeOpen(false); }}>적용하기</button></footer></section></div>}
    <aside className="map-results-panel">
      {view === "map" ? <><div className="map-results-heading"><div><p className="eyebrow dark">관광지 조회 결과</p><h2>{resultTitle} 관광지</h2></div><strong>{places.length}</strong></div>{reviewLoading ? <div className="jobs-status is-visible">관광지를 불러오는 중입니다.</div> : reviewError ? <div className="jobs-status is-visible">{reviewError}</div> : selectedRegion === "전체" ? <div className="jobs-status is-visible is-empty">지도에서 지역을 선택해 주세요.</div> : places.length ? <div className="map-job-list">{places.map((place) => { const placeId = place.id || place.placeId; return <Link className="map-job-item map-destination-item" to={`/destinations/${placeId}`} key={placeId}><img src={placeImage(place)} alt="" /><div><span>{place.category || place.placeType || "관광지"}</span><h3>{place.name || place.title}</h3><p>{place.description || place.address || `${selectedRegion} 관광지`}</p></div><div className="job-meta"><span>★ {Number(place.averageRating || place.rating || 0).toFixed(1)}</span><span>리뷰 {place.reviewCount || 0}</span></div><footer><b>상세·리뷰 보기 →</b></footer></Link>; })}</div> : <div className="jobs-status is-visible is-empty">등록된 관광지가 없습니다.</div>}</> : <><div className="map-results-heading"><div><p className="eyebrow dark">일자리 조회 결과</p><h2>{resultTitle} 일자리</h2></div><strong>{jobs.length}</strong></div>{jobsApi.loading ? <div className="jobs-status is-visible">데이터를 불러오는 중입니다.</div> : jobsApi.error ? <div className="jobs-status is-visible">{jobsApi.error}</div> : jobs.length ? <div className="map-job-list">{jobs.map((job) => <MapJobItem job={job} key={job.id} />)}</div> : <div className="jobs-status is-visible is-empty">조건에 맞는 일자리가 없습니다.</div>}</>}
    </aside>
  </main>;
}
