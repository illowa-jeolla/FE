import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BrandCharacter from "../components/BrandCharacter";
import { externalJobDetailPath, getExternalJobsBatch } from "../api/jobs";
import { getRegions } from "../api/regions";
import { jeonnamRegionName } from "../data/jeonnam";
import { asList } from "../hooks/useApi";

const RESULTS_PER_PAGE = 20;
const PAGE_GROUP_SIZE = 5;

function sourceText(job) {
  const raw = job.rawFields || {};
  return String(job.content || job.jobContent || raw.jobContent || raw.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractedPay(job) {
  const text = sourceText(job);
  const labeled = text.match(/(?:급여|임금|보수)\s*[:：]\s*([^■|]{2,32})/);
  if (labeled) return labeled[1].trim();
  const amount = text.match(/(?:시급|일급|월급|연봉)\s*[:：]?\s*[0-9,.]+\s*(?:원|만원)?/);
  return amount?.[0]?.trim() || "";
}

function extractedWorkTime(job) {
  const text = sourceText(job);
  const labeled = text.match(/(?:근무시간(?:\s*및\s*교대)?|근로시간)\s*[:：]\s*([^■]{2,55})/);
  if (!labeled) return "";
  const timeRanges = labeled[1].match(/\d{1,2}:\d{2}\s*[~-]\s*\d{1,2}:\d{2}(?:\s*[/,]\s*\d{1,2}:\d{2}\s*[~-]\s*\d{1,2}:\d{2})*/);
  return (timeRanges?.[0] || labeled[1].split(/\s+(?:접수방법|추가내용|복리후생|근무요일|성별|모집인원)\b/)[0]).trim();
}

function salaryOf(job) {
  const raw = job.rawFields || {};
  return job.salaryText || job.wageAmount || raw.salaryText || raw.wageAmount || raw.salary || raw.pay || raw.salaryAmount || extractedPay(job) || "급여 정보 확인";
}

function regionOf(job) {
  const raw = job.rawFields || {};
  return job.regionName || job.location || job.address || raw.jobCategoryNm || raw.workplaceAddress || "지역 미정";
}

function workTimeOf(job) {
  const raw = job.rawFields || {};
  return job.workHours || job.workTime || raw.workTimeContent || raw.workTime || raw.workingHours || raw.workHours || extractedWorkTime(job) || "시간 정보 확인";
}

function registeredAtOf(job) {
  const raw = job.rawFields || {};
  const value = job.registeredAt || job.insertedAt || job.createdAt || job.registrationDate || raw.jobInsertDt || raw.regDate || raw.registeredAt || raw.createdAt || raw.writeDate;
  if (!value) return "등록일 미정";
  const text = String(value).trim().replaceAll(".", "-").replaceAll("/", "-");
  const date = new Date(text.includes("T") ? text : text.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  const hasTime = /\d{1,2}:\d{2}/.test(text);
  const elapsed = Date.now() - date.getTime();
  if (hasTime && elapsed >= -60_000) {
    const minutes = Math.floor(Math.max(0, elapsed) / 60_000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
  }
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const registeredDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.floor((dayStart - registeredDay) / 86_400_000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days > 1 && days < 30) return `${days}일 전`;
  const match = text.match(/\d{4}-\d{1,2}-\d{1,2}/);
  return match ? match[0] : text.slice(0, 10);
}

function JobCard({ job }) {
  const salary = salaryOf(job);
  return <Link className="job-search-row" to={externalJobDetailPath(job)} aria-label={`${job.title}, ${salary}`}>
    <span>{regionOf(job)}</span>
    <h3>{job.title || "제목 미제공"}</h3>
    <strong>{salary}</strong>
    <span>{workTimeOf(job)}</span>
    <time>{registeredAtOf(job)}</time>
  </Link>;
}

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const selectedRegion = jeonnamRegionName(params.get("region")) || "전체";
  const initialQuery = params.get("q") || "";
  const [draftRegion, setDraftRegion] = useState(selectedRegion);
  const [regionRecords, setRegionRecords] = useState([]);
  const [regionFilter, setRegionFilter] = useState("");
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [changingPage, setChangingPage] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(null);
  const [regionScroll, setRegionScroll] = useState({ top: 0, height: 0, visible: false });
  const pickerRef = useRef(null);
  const resultsScrollRef = useRef(null);
  const regionScrollRef = useRef(null);
  const regionDragRef = useRef(null);

  const normalizedQuery = submittedQuery.trim().toLocaleLowerCase();
  const filteredJobs = jobs.filter((job) => String(job.title || "").toLocaleLowerCase().includes(normalizedQuery));
  const pageCount = Math.max(1, Math.ceil((normalizedQuery ? filteredJobs.length : totalCount) / RESULTS_PER_PAGE));
  const pageStart = (currentPage - 1) * RESULTS_PER_PAGE;
  const visibleJobs = filteredJobs.slice(pageStart, pageStart + RESULTS_PER_PAGE);
  const displayedPage = pendingPage || currentPage;
  const pageGroupStart = Math.floor((displayedPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const pageNumbers = Array.from({ length: Math.min(PAGE_GROUP_SIZE, pageCount - pageGroupStart + 1) }, (_, index) => pageGroupStart + index);
  const regionNames = regionRecords.map((region) => region.name);
  const visibleRegionNames = ["전체", ...regionNames].filter((region) => !regionFilter.trim() || region.includes(regionFilter.trim()));

  function updateRegionScrollbar(element = regionScrollRef.current) {
    if (!element) return;
    const { clientHeight, scrollHeight, scrollTop } = element;
    if (scrollHeight <= clientHeight) {
      setRegionScroll({ top: 0, height: clientHeight, visible: false });
      return;
    }
    const height = Math.max(34, clientHeight * (clientHeight / scrollHeight));
    const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
    setRegionScroll({ top, height, visible: true });
  }

  function moveRegionScrollbar(event) {
    if (!regionDragRef.current || !regionScrollRef.current) return;
    const { track, offset } = regionDragRef.current;
    const bounds = track.getBoundingClientRect();
    const maxTop = bounds.height - regionScroll.height;
    const nextTop = Math.min(maxTop, Math.max(0, event.clientY - bounds.top - offset));
    const list = regionScrollRef.current;
    list.scrollTop = maxTop > 0 ? (nextTop / maxTop) * (list.scrollHeight - list.clientHeight) : 0;
  }

  function startRegionScrollbarDrag(event) {
    const track = event.currentTarget;
    const thumb = track.firstElementChild;
    const thumbBounds = thumb.getBoundingClientRect();
    const onThumb = event.target === thumb;
    regionDragRef.current = { track, offset: onThumb ? event.clientY - thumbBounds.top : regionScroll.height / 2 };
    track.setPointerCapture(event.pointerId);
    moveRegionScrollbar(event);
  }

  useEffect(() => {
    let cancelled = false;
    getRegions().then((result) => {
      if (cancelled) return;
      setRegionRecords(asList(result, "regions")
        .filter((region) => jeonnamRegionName(region.name))
        .map((region) => ({ ...region, name: jeonnamRegionName(region.name) })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setDraftRegion(selectedRegion);
  }, [selectedRegion]);

  useEffect(() => {
    function closePicker(event) {
      if (!pickerRef.current?.contains(event.target)) setRegionPickerOpen(false);
    }
    document.addEventListener("pointerdown", closePicker);
    return () => document.removeEventListener("pointerdown", closePicker);
  }, []);

  useEffect(() => {
    resultsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  useEffect(() => {
    if (!regionPickerOpen) return undefined;
    const frame = requestAnimationFrame(() => updateRegionScrollbar());
    return () => cancelAnimationFrame(frame);
  }, [regionPickerOpen, regionFilter, regionNames.length]);

  useEffect(() => {
    let cancelled = false;
    setJobs([]);
    setLoading(true);
    setError("");
    setPage(1);
    setHasMore(true);
    setCurrentPage(1);
    setPendingPage(null);
    getExternalJobsBatch({ region: selectedRegion === "전체" ? "" : selectedRegion, page: 1 })
      .then((result) => {
        if (cancelled) return;
        setJobs(result.items);
        setHasMore(result.hasMore);
        setTotalCount(result.total);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedRegion]);

  function selectRegion(region) {
    setDraftRegion(region);
    setRegionFilter("");
    setRegionPickerOpen(false);
  }

  function submit(event) {
    event.preventDefault();
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    setCurrentPage(1);
    const next = {};
    if (draftRegion !== "전체") next.region = draftRegion;
    if (nextQuery) next.q = nextQuery;
    setParams(next);
  }

  async function moveToPage(targetPage) {
    const safeTarget = Math.min(Math.max(1, targetPage), pageCount);
    if (safeTarget === currentPage || changingPage) return;
    if (normalizedQuery || safeTarget * RESULTS_PER_PAGE <= jobs.length || !hasMore) {
      setCurrentPage(safeTarget);
      return;
    }

    setPendingPage(safeTarget);
    setChangingPage(true);
    try {
      let loadedJobs = jobs;
      let sourcePage = page;
      let moreAvailable = hasMore;
      while (loadedJobs.length < safeTarget * RESULTS_PER_PAGE && moreAvailable) {
        const result = await getExternalJobsBatch({ region: selectedRegion === "전체" ? "" : selectedRegion, page: sourcePage + 1 });
        const seen = new Set(loadedJobs.map((job) => job.id));
        loadedJobs = [...loadedJobs, ...result.items.filter((job) => !seen.has(job.id))];
        sourcePage += 1;
        moreAvailable = result.hasMore;
        setTotalCount(result.total);
      }
      setJobs(loadedJobs);
      setPage(sourcePage);
      setHasMore(moreAvailable);
      setCurrentPage(safeTarget);
    } catch (requestError) { setError(requestError.message); }
    finally { setPendingPage(null); setChangingPage(false); }
  }

  const emptyMessage = normalizedQuery
    ? "검색 조건에 맞는 일자리가 없습니다."
    : selectedRegion === "전체" ? "등록된 일자리가 없습니다." : `${selectedRegion}에 등록된 일자리가 없습니다.`;

  return <main className="jobs-search-page jobs-search-page-enter">
    <section className="jobs-search-hero">
      <div className="jobs-search-intro"><p>LOCAL JOBS</p><h1>지역 일자리 찾기</h1><span>지역과 공고 제목으로 원하는 일자리를 빠르게 찾아보세요.</span></div>
      <form className="jobs-search-bar" onSubmit={submit} ref={pickerRef}>
        <div className="jobs-region-field">
          <label htmlFor="job-region-search">지역</label>
          <input id="job-region-search" value={regionPickerOpen ? regionFilter : draftRegion === "전체" ? "" : draftRegion} placeholder="전체 지역" autoComplete="off" onFocus={() => { setRegionFilter(""); setRegionPickerOpen(true); }} onChange={(event) => { setRegionFilter(event.target.value); setRegionPickerOpen(true); }} />
          {regionPickerOpen && <div className="jobs-region-options"><div className="jobs-region-options-scroll" ref={regionScrollRef} onScroll={(event) => updateRegionScrollbar(event.currentTarget)}>{visibleRegionNames.map((region) => <button className={draftRegion === region ? "is-selected" : ""} type="button" key={region} onClick={() => selectRegion(region)}>{region}<span>{draftRegion === region ? "✓" : ""}</span></button>)}</div>{regionScroll.visible && <span className="jobs-region-scrollbar" aria-hidden="true" onPointerDown={startRegionScrollbarDrag} onPointerMove={moveRegionScrollbar} onPointerUp={(event) => { regionDragRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { regionDragRef.current = null; }}><i style={{ height: `${regionScroll.height}px`, transform: `translateY(${regionScroll.top}px)` }} /></span>}</div>}
        </div>
        <label className="jobs-title-field" htmlFor="job-title-search"><span>공고 제목</span><input id="job-title-search" value={query} placeholder="찾고 싶은 일자리를 입력하세요" onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="button button-primary" type="submit">검색</button>
      </form>
    </section>

    <section className="jobs-search-results">
      <div className="jobs-results-heading"><div><p>검색 결과</p><h2>{selectedRegion === "전체" ? "전체 지역" : selectedRegion} 일자리</h2></div><span>총 {normalizedQuery ? filteredJobs.length : totalCount}건</span></div>
      <div className="jobs-list-columns" aria-hidden="true"><span>지역</span><span>모집 제목</span><span>급여</span><span>근무시간</span><span>등록일</span></div>
      {loading ? <div className="jobs-card-status"><BrandCharacter pose="loading" /><p>일자리를 불러오고 있어요.</p></div>
        : error && !jobs.length ? <div className="jobs-card-status is-error"><BrandCharacter pose="error" /><p>{error}</p></div>
          : visibleJobs.length ? <div className="jobs-list-scroll" ref={resultsScrollRef}><div className={`job-search-list${changingPage ? " is-loading" : ""}`}>{visibleJobs.map((job) => <JobCard job={job} key={job.id} />)}</div>{pageCount > 1 && <nav className="jobs-pagination" aria-label="일자리 검색 결과 페이지">{pageGroupStart > 1 && <button className="jobs-pagination-move" type="button" aria-label="첫 페이지" disabled={changingPage} onClick={() => moveToPage(1)}>«</button>}<button className="jobs-pagination-move" type="button" aria-label="이전 페이지 묶음" disabled={pageGroupStart === 1 || changingPage} onClick={() => moveToPage(pageGroupStart - 1)}>‹</button>{pageNumbers.map((pageNumber) => <button className={pageNumber === displayedPage ? "is-active" : ""} type="button" aria-current={pageNumber === displayedPage ? "page" : undefined} disabled={changingPage} key={pageNumber} onClick={() => moveToPage(pageNumber)}>{pageNumber}</button>)}<button className="jobs-pagination-move" type="button" aria-label="다음 페이지 묶음" disabled={pageGroupStart + PAGE_GROUP_SIZE > pageCount || changingPage} onClick={() => moveToPage(pageGroupStart + PAGE_GROUP_SIZE)}>›</button></nav>}</div>
            : <div className="jobs-card-status"><BrandCharacter pose="empty" /><p>{emptyMessage}</p></div>}
    </section>
  </main>;
}
