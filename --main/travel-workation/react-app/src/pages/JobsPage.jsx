import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Status } from "../components/UI";
import { getRegions } from "../api/regions";
import { externalJunnamJobsPath, externalTourJobsPath } from "../api/jobs";
import { asList, useApi } from "../hooks/useApi";

export const workTypes = ["상근", "주 5일", "시간제", "주말 근무", "단기 근무", "원격·재택"];
export const timeOptions = Array.from({ length: 31 }, (_, index) => {
  const minutes = 6 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
export function dateValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function sameDate(left, right) { return left && right && dateValue(left) === dateValue(right); }
export function displayDate(value) { if (!value) return ""; const [, month, day] = value.split("-"); return `${month}.${day}`; }

export function JobCalendarMonth({ monthDate, today, start, end, onSelect }) {
  const year = monthDate.getFullYear(); const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); const lastDate = new Date(year, month + 1, 0).getDate();
  return <article className="travel-calendar-month"><h3>{year}.{String(month + 1).padStart(2, "0")}</h3><div className="travel-calendar-week">{"일월화수목금토".split("").map((day) => <span key={day}>{day}</span>)}</div><div className="travel-calendar-days">{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: lastDate }, (_, index) => {
    const date = new Date(year, month, index + 1); const disabled = date < today;
    const selectedStart = sameDate(date, start); const selectedEnd = sameDate(date, end); const inRange = start && end && date > start && date < end;
    return <button type="button" disabled={disabled} className={`${selectedStart ? "is-start " : ""}${selectedEnd ? "is-end " : ""}${inRange ? "is-range" : ""}`} onClick={() => onSelect(date)} key={dateValue(date)}><b>{date.getDate()}</b></button>;
  })}</div></article>;
}

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const [source, setSource] = useState("junnam");
  const initialRegion = params.get("region") || "";
  const [filters, setFilters] = useState({ region: initialRegion, tripStart: "", tripEnd: "", workType: "", time: "" });
  const [openPicker, setOpenPicker] = useState("");
  const [regionQuery, setRegionQuery] = useState(initialRegion);
  const [dateOpen, setDateOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(null); const [draftEnd, setDraftEnd] = useState(null);
  const [timeOpen, setTimeOpen] = useState(false); const [draftTimeStart, setDraftTimeStart] = useState("09:00"); const [draftTimeEnd, setDraftTimeEnd] = useState("18:00");
  const filterRef = useRef(null); const todayRef = useRef(new Date()); todayRef.current.setHours(0, 0, 0, 0);
  const [calendarCursor, setCalendarCursor] = useState(new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
  const [regionRecords, setRegionRecords] = useState([]);
  const { data, loading, error, run } = useApi(null, { immediate: false });
  const jobs = Array.isArray(data?.content) ? data.content : asList(data, "jobs");
  const set = (key) => (event) => setFilters((value) => ({ ...value, [key]: event.target.value }));
  useEffect(() => {
    function closePicker(event) { if (!filterRef.current?.contains(event.target)) { setOpenPicker(""); setRegionQuery(""); } }
    document.addEventListener("pointerdown", closePicker); return () => document.removeEventListener("pointerdown", closePicker);
  }, []);
  useEffect(() => { getRegions().then((result) => setRegionRecords(asList(result, "regions"))).catch(() => {}); }, []);
  function openDatePicker() {
    const start = filters.tripStart ? new Date(`${filters.tripStart}T00:00:00`) : null; const end = filters.tripEnd ? new Date(`${filters.tripEnd}T00:00:00`) : null;
    setDraftStart(start); setDraftEnd(end); setCalendarCursor(start ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)); setDateOpen(true);
  }
  function selectDate(date) { if (!draftStart || draftEnd || date <= draftStart) { setDraftStart(date); setDraftEnd(null); } else setDraftEnd(date); }
  function applyDates() { setFilters((current) => ({ ...current, tripStart: dateValue(draftStart), tripEnd: dateValue(draftEnd) })); setDateOpen(false); }
  function applyTime() { setFilters((current) => ({ ...current, time: `${draftTimeStart}~${draftTimeEnd}` })); setTimeOpen(false); }
  function submit(event) {
    event.preventDefault(); const region = filters.region;
    setParams(region ? { region } : {}); run(source === "tour-external" ? externalTourJobsPath() : externalJunnamJobsPath({ region })).catch(() => {});
  }
  return <main className="feature-page-main">
    <section className="page-intro"><div><p className="eyebrow dark">관광 일자리</p><h1>여행 가까이에서 나에게 맞는 일을 찾아보세요</h1></div><div className="page-intro-actions"><button className={`button${source === "tour-external" ? " button-primary" : ""}`} type="button" onClick={() => setSource("tour-external")}>관광인 일자리</button><button className={`button${source === "junnam" ? " button-primary" : ""}`} type="button" onClick={() => setSource("junnam")}>전남 공공 일자리</button></div></section>
    <div className="page-workspace jobs-search-layout"><section className="page-panel job-search-panel"><header><h2>일자리 검색</h2><span>외부 공고</span></header><form className="job-search-form" onSubmit={submit} ref={filterRef}>
      <label className="job-picker-field">지역 검색<div className="job-picker-trigger job-region-search-trigger"><input value={openPicker === "region" ? regionQuery : filters.region} placeholder="지역을 선택해 주세요" autoComplete="off" aria-expanded={openPicker === "region"} onFocus={() => { setRegionQuery(""); setOpenPicker("region"); }} onChange={(event) => { setRegionQuery(event.target.value); setOpenPicker("region"); }} /><i /></div>{openPicker === "region" && <section className="job-option-popover"><div>{["전체", ...regionRecords.map((region) => region.name)].filter((item) => !regionQuery.trim() || item.includes(regionQuery.trim())).map((item) => <button className={(filters.region || "전체") === item ? "is-selected" : ""} type="button" key={item} onClick={(event) => { event.preventDefault(); const value = item === "전체" ? "" : item; setFilters((current) => ({ ...current, region: value })); setRegionQuery(""); setOpenPicker(""); }}><span>{item}</span>{(filters.region || "전체") === item && <i>✓</i>}</button>)}</div></section>}</label>
      <fieldset><legend>여행 기간</legend><button className="job-date-trigger" type="button" aria-expanded={dateOpen} onClick={openDatePicker}><span className="job-picker-icon">▦</span><strong>{filters.tripStart && filters.tripEnd ? `${displayDate(filters.tripStart)} → ${displayDate(filters.tripEnd)}` : "날짜를 선택해 주세요"}</strong><i /></button></fieldset>
      <div className="job-search-two-fields"><label className="job-picker-field">일하는 방식<button className="job-picker-trigger" type="button" aria-expanded={openPicker === "work"} onClick={() => setOpenPicker((current) => current === "work" ? "" : "work")}><span>{filters.workType || "근무 방식 선택"}</span><i /></button>{openPicker === "work" && <section className="job-option-popover job-work-popover"><div>{workTypes.map((item) => <button className={filters.workType === item ? "is-selected" : ""} type="button" key={item} onClick={() => { setFilters((current) => ({ ...current, workType: item })); setOpenPicker(""); }}><span>{item}</span>{filters.workType === item && <i>✓</i>}</button>)}</div></section>}</label><label>희망 시간<button className="job-time-trigger" type="button" aria-expanded={timeOpen} onClick={() => { const [start = "09:00", end = "18:00"] = filters.time.split("~"); setDraftTimeStart(start); setDraftTimeEnd(end); setTimeOpen(true); }}><span className="job-picker-icon">◷</span><strong>{filters.time || "시간을 선택해 주세요"}</strong><i /></button></label></div>
      <button className="button button-primary" type="submit" disabled={loading}>{loading ? "검색 중..." : "조건으로 검색하기"}</button>
    </form></section><section className="page-panel jobs-results-panel"><p className="result-kind">{filters.region ? `${filters.region} 일자리` : "전체 일자리"} · {data?.totalElements ?? data?.totalCount ?? jobs.length}건</p><Status loading={loading} error={error} empty={!jobs.length}><div className="result-list">{jobs.map((job) => {
      const raw = job.rawFields || {};
      const externalKey = raw.jobKey || job.jobKey;
      const tourKey = job.employmentInfoNo || raw.employmentInfoNo || job.id;
      const title = job.title || job.employmentTitle || raw.employmentTitle || raw.title || "제목 미제공";
      const company = job.companyName || job.employerName || job.company || raw.companyName || raw.company || job.address || "채용 기관 정보 미제공";
      const content = <div><span>{source === "junnam" ? raw.jobCategoryNm || "전남 공공 일자리" : source === "tour-external" ? "광주·전남 관광인 일자리" : `${job.category || "관광 일자리"} · ${job.regionName || ""}`}</span><h3>{title}</h3><p>{company}</p>{source === "tourism" && <div className="job-insight-chips">{[job.workType, job.workHours, job.employmentPeriod, job.salaryText].filter(Boolean).map((value) => <span key={value}>{value}</span>)}</div>}</div>;
      if (source === "tour-external") return tourKey ? <Link className="result-card" to={`/jobs/tour/${encodeURIComponent(tourKey)}`} key={tourKey}>{content}<strong>상세 보기 →</strong></Link> : <article className="result-card" key={title}>{content}</article>;
      if (source === "junnam") return externalKey ? <Link className="result-card" to={`/jobs/junnam/${encodeURIComponent(externalKey)}`} key={externalKey}>{content}<strong>상세 보기 →</strong></Link> : <article className="result-card" key={title}>{content}</article>;
      return <article className="result-card" key={job.id || title}>{content}</article>;
    })}</div></Status></section></div>
    {dateOpen && <div className="travel-calendar-popover job-calendar-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDateOpen(false); }}><section className="travel-calendar-dialog job-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="job-calendar-title"><header><h2 id="job-calendar-title">여행 날짜를 선택하세요</h2><button type="button" aria-label="닫기" onClick={() => setDateOpen(false)}>×</button></header><div className="travel-calendar-nav"><button type="button" aria-label="이전 달" disabled={calendarCursor <= new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)} onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="다음 달" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="travel-calendar-months"><JobCalendarMonth monthDate={calendarCursor} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectDate} /><JobCalendarMonth monthDate={new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectDate} /></div><footer><button type="button" disabled={!draftStart || !draftEnd} onClick={applyDates}>적용하기</button></footer></section></div>}
    {timeOpen && <div className="job-time-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setTimeOpen(false); }}><section className="job-time-dialog" role="dialog" aria-modal="true" aria-labelledby="job-time-title"><header><div><span>WORK HOURS</span><h2 id="job-time-title">희망 시간을 선택하세요</h2></div><button type="button" aria-label="닫기" onClick={() => setTimeOpen(false)}>×</button></header><div className="job-time-columns"><label><span>시작 시간</span><select value={draftTimeStart} onChange={(event) => setDraftTimeStart(event.target.value)}>{timeOptions.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label><div className="job-time-line"><i /><span>근무</span><i /></div><label><span>종료 시간</span><select value={draftTimeEnd} onChange={(event) => setDraftTimeEnd(event.target.value)}>{timeOptions.filter((time) => time > draftTimeStart).map((time) => <option key={time}>{time}</option>)}</select></label></div><div className="job-time-presets">{[["오전", "09:00", "13:00"], ["오후", "13:00", "18:00"], ["종일", "09:00", "18:00"]].map(([label, start, end]) => <button type="button" key={label} onClick={() => { setDraftTimeStart(start); setDraftTimeEnd(end); }}>{label}<small>{start}–{end}</small></button>)}</div><footer><button type="button" onClick={applyTime}>적용하기</button></footer></section></div>}
  </main>;
}
