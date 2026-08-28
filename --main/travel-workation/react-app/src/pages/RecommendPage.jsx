import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mapRegions } from "../data/regions";

const themes = ["자연·힐링", "로컬 미식", "감성 사진", "역사·문화"];
function dateValue(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function shortDate(date) { return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`; }
function sameDate(left, right) { return left && right && dateValue(left) === dateValue(right); }

function CalendarMonth({ monthDate, today, start, end, onSelect }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const maxEnd = start && !end ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6) : null;
  return <article className="travel-calendar-month"><h3>{year}.{String(month + 1).padStart(2, "0")}</h3><div className="travel-calendar-week">{"일월화수목금토".split("").map((day) => <span key={day}>{day}</span>)}</div><div className="travel-calendar-days">{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: lastDate }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const disabled = date < today || (maxEnd && date > maxEnd);
    const selectedStart = sameDate(date, start); const selectedEnd = sameDate(date, end);
    const inRange = start && end && date > start && date < end;
    return <button type="button" disabled={disabled} className={`${selectedStart ? "is-start " : ""}${selectedEnd ? "is-end " : ""}${inRange ? "is-range" : ""}`} onClick={() => onSelect(date)} key={dateValue(date)}><b>{date.getDate()}</b>{selectedStart ? <small>출발</small> : selectedEnd ? <small>도착</small> : null}</button>;
  })}</div></article>;
}

export default function RecommendPage() {
  const navigate = useNavigate();
  const regionPickerRef = useRef(null);
  const dateTriggerRef = useRef(null);
  const [selectedThemes, setSelectedThemes] = useState(["자연·힐링", "로컬 미식"]);
  const [region, setRegion] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionOptions, setRegionOptions] = useState(["전라도 전체", ...mapRegions]);
  const [regionSearching, setRegionSearching] = useState(false);
  const [hotel, setHotel] = useState("");
  const [hotelOpen, setHotelOpen] = useState(false);
  const [hotelResults, setHotelResults] = useState([]);
  const [hotelSearching, setHotelSearching] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(null);
  const [draftEnd, setDraftEnd] = useState(null);
  const todayRef = useRef(new Date());
  todayRef.current.setHours(0, 0, 0, 0);
  const [calendarCursor, setCalendarCursor] = useState(new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
  const [dailyPlaceCounts, setDailyPlaceCounts] = useState([]);

  useEffect(() => {
    function closeRegionPicker(event) {
      if (!regionPickerRef.current?.contains(event.target)) setRegionOpen(false);
    }

    function closeRegionPickerWithEscape(event) {
      if (event.key === "Escape") setRegionOpen(false);
    }

    document.addEventListener("pointerdown", closeRegionPicker);
    document.addEventListener("keydown", closeRegionPickerWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeRegionPicker);
      document.removeEventListener("keydown", closeRegionPickerWithEscape);
    };
  }, []);

  useEffect(() => {
    if (!regionOpen) return undefined;
    setRegionSearching(true);
    const timer = setTimeout(() => {
      const query = region.trim();
      setRegionOptions(["전라도 전체", ...mapRegions].filter((item) => !query || item.includes(query)));
      setRegionSearching(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [region, regionOpen]);

  useEffect(() => {
    if (!hotelOpen || !hotel.trim()) { setHotelResults([]); setHotelSearching(false); return undefined; }
    const controller = new AbortController();
    setHotelSearching(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: hotel.trim(), region: region.trim() });
      fetch(`/api/hotels/search?${params}`, { signal: controller.signal, headers: { Accept: "application/json" } })
        .then(async (response) => { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message); return data; })
        .then((data) => setHotelResults(data.hotels || []))
        .catch((error) => { if (error.name !== "AbortError") setHotelResults([]); })
        .finally(() => { if (!controller.signal.aborted) setHotelSearching(false); });
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [hotel, hotelOpen, region]);

  function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const conditions = { ...values, themes: selectedThemes, dailyPlaceCounts, placeCount: dailyPlaceCounts[0] || 3, hotel: values.hotel || `${values.region || "전라도"} 추천 숙소` };
    sessionStorage.setItem("travelGuideConditions", JSON.stringify(conditions));
    navigate("/travel-guide", { state: conditions });
  }

  function openCalendar() {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T00:00:00`) : null;
    setDraftStart(start); setDraftEnd(end);
    setCalendarCursor(start ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
    setDateOpen(true);
  }

  function selectDate(date) {
    if (!draftStart || draftEnd || date <= draftStart) { setDraftStart(date); setDraftEnd(null); }
    else setDraftEnd(date);
  }

  function applyDates() {
    const nextStart = dateValue(draftStart); const nextEnd = dateValue(draftEnd);
    setStartDate(nextStart); setEndDate(nextEnd);
    const days = Math.max(1, Math.min(7, Math.round((draftEnd - draftStart) / 86400000) + 1));
    setDailyPlaceCounts((current) => Array.from({ length: days }, (_, index) => current[index] || 3));
    setDateOpen(false);
  }

  const hotelSuggestions = ["여수 베네치아 호텔", "순천만 스테이", "군산 근대마을 게스트하우스"];

  return <main className="travel-guide-main react-travel-guide-main">
    <section className="travel-guide-hero"><div><span className="travel-guide-eyebrow">LOCAL TRAVEL GUIDE</span><h1>머무는 곳에서 시작하는<br /><em>가벼운 전라도 여행</em></h1></div></section>
    <form className="travel-search-bar react-guide-search-react" onSubmit={submit}>
      <div className="travel-search-side-heading"><span className="travel-guide-eyebrow">TRIP DETAILS</span><b>여행 조건</b><h2>여행 정보 입력</h2></div>
      <div className={`travel-search-field travel-search-region${regionOpen ? " is-open" : ""}`} ref={regionPickerRef}>
        <span>여행 지역 <small>선택</small></span>
        <div className="travel-region-input-wrap">
          <i className="travel-field-icon travel-field-icon-location" aria-hidden="true" />
          <input name="region" value={region} placeholder="전라도 전체" autoComplete="off" aria-label="여행 지역" aria-expanded={regionOpen} aria-controls="travel-region-picker" onFocus={() => setRegionOpen(true)} onClick={() => setRegionOpen(true)} onChange={(event) => { setRegion(event.target.value); setRegionOpen(true); }} />
          <button className="travel-region-chevron" type="button" aria-label={regionOpen ? "지역 선택 닫기" : "지역 선택 열기"} onClick={() => setRegionOpen((current) => !current)}><i aria-hidden="true" /></button>
        </div>
        {regionOpen && <section className="travel-region-picker" id="travel-region-picker" aria-label="전라도 지역 선택">
          <div className="travel-region-options">{regionSearching ? <div className="hotel-search-loading" role="status" aria-label="지역 검색 중"><i aria-hidden="true" /></div> : regionOptions.length ? regionOptions.map((item) => { const value = item === "전라도 전체" ? "" : item; return <button className={region === value ? "is-selected" : ""} type="button" key={item} onClick={() => { setRegion(value); setRegionOpen(false); }}><span>{item}</span>{region === value && <i>✓</i>}</button>; }) : <p className="travel-region-empty">일치하는 지역이 없어요.</p>}</div>
        </section>}
      </div>
      <button className="travel-search-field travel-date-trigger" type="button" ref={dateTriggerRef} onClick={openCalendar}><span>여행 날짜 <small>선택</small></span><div><i className="travel-field-icon travel-field-icon-calendar" aria-hidden="true" /><strong>{startDate && endDate ? <><span className="travel-date-value">{shortDate(new Date(`${startDate}T00:00:00`))}</span><i>→</i><span className="travel-date-value">{shortDate(new Date(`${endDate}T00:00:00`))}</span><em>{Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000)}박</em></> : <span className="travel-date-placeholder">날짜를 선택해 주세요</span>}</strong><i className="travel-date-arrow" aria-hidden="true" /></div></button>
      <input name="start" type="hidden" value={startDate} /><input name="end" type="hidden" value={endDate} />
      {dailyPlaceCounts.length > 0 && <section className="travel-daily-counts"><header><strong>방문할 관광지 수</strong><small>1–5곳</small></header><div id="travel-daily-count-list">{dailyPlaceCounts.map((count, index) => <article key={index}><b>DAY {index + 1}</b><div><button type="button" disabled={count <= 1} aria-label={`DAY ${index + 1} 관광지 줄이기`} onClick={() => setDailyPlaceCounts((current) => current.map((value, itemIndex) => itemIndex === index ? Math.max(1, value - 1) : value))}>−</button><strong>{count}</strong><button type="button" disabled={count >= 5} aria-label={`DAY ${index + 1} 관광지 늘리기`} onClick={() => setDailyPlaceCounts((current) => current.map((value, itemIndex) => itemIndex === index ? Math.min(5, value + 1) : value))}>＋</button></div></article>)}</div></section>}
      <button className="travel-search-field travel-hotel-trigger" type="button" onClick={() => setHotelOpen(true)}><span>숙소 위치</span><div><i className="travel-field-icon travel-field-icon-hotel" aria-hidden="true" /><strong>{hotel || "숙소 위치 검색하기"}</strong></div></button>
      <input type="hidden" name="hotel" value={hotel} />
      <button className="travel-guide-submit" type="submit">맞춤 여행 추천받기 <span>→</span></button>
      <section className="travel-preferences" aria-labelledby="react-travel-preference-title"><header><div><span className="travel-guide-eyebrow">TRAVEL STYLE</span><h2 id="react-travel-preference-title">어떤 여행을 원하시나요?</h2></div></header><div className="travel-preference-grid">
        <fieldset className="recommend-choice-group recommend-choice-group--theme"><legend><strong>여행 테마</strong><span>여러 개 선택 가능</span></legend><div className="recommend-options">{themes.map((theme) => <label key={theme}><input type="checkbox" name="themes" value={theme} checked={selectedThemes.includes(theme)} onChange={() => setSelectedThemes((current) => current.includes(theme) ? current.filter((item) => item !== theme) : [...current, theme])} /><span>{theme}</span></label>)}</div></fieldset>
        <fieldset className="recommend-choice-group recommend-choice-group--transport"><legend><strong>이동 방식</strong><span>하나 선택</span></legend><div className="recommend-options recommend-options--three">{["대중교통", "자가용", "도보 중심"].map((item, index) => <label key={item}><input type="radio" name="transport" value={item} defaultChecked={index === 0} /><span>{item}</span></label>)}</div></fieldset>
        <fieldset className="recommend-choice-group recommend-choice-group--companion"><legend><strong>누구와 함께</strong><span>하나 선택</span></legend><div className="recommend-options">{["혼자", "연인", "친구", "가족"].map((item) => <label key={item}><input type="radio" name="companion" value={item} defaultChecked={item === "친구"} /><span>{item}</span></label>)}</div></fieldset>
      </div></section>
    </form>
    {dateOpen && <div className="travel-calendar-popover" role="presentation"><section className="travel-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="travel-calendar-title" style={{ width: "min(760px, calc(100vw - 24px))", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}><header><h2 id="travel-calendar-title">여행 날짜를 선택하세요</h2><button type="button" aria-label="닫기" onClick={() => setDateOpen(false)}>×</button></header><div className="travel-calendar-nav"><button type="button" aria-label="이전 달" disabled={calendarCursor <= new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)} onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="다음 달" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="travel-calendar-months"><CalendarMonth monthDate={calendarCursor} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectDate} /><CalendarMonth monthDate={new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectDate} /></div><footer><button type="button" disabled={!draftStart || !draftEnd} onClick={applyDates}>적용하기</button></footer></section></div>}
    {hotelOpen && <div className="hotel-search-backdrop" role="presentation"><section className="hotel-search-dialog" role="dialog" aria-modal="true" aria-labelledby="react-hotel-title"><header><div><span className="travel-guide-eyebrow">STAY LOCATION</span><h2 id="react-hotel-title">어디에 머무시나요?</h2></div><button type="button" aria-label="닫기" onClick={() => setHotelOpen(false)}>×</button></header><p>숙소를 기준으로 가까운 관광지와 효율적인 이동 경로를 추천해 드려요.</p><label className="hotel-search-input"><span>⌕</span><input value={hotel} onChange={(event) => setHotel(event.target.value)} placeholder="호텔명 또는 주소를 검색하세요" autoFocus /></label><div className="hotel-search-results react-hotel-results"><small>{hotel.trim() ? "검색 결과" : "추천 숙소"}</small>{hotelSearching ? <div className="hotel-search-loading" role="status" aria-label="숙소 검색 중"><i aria-hidden="true" /></div> : hotel.trim() ? <>{hotelResults.map((item) => <button type="button" key={`${item.name}-${item.address}`} onClick={() => { setHotel(item.name); setHotelOpen(false); }}><span><b>{item.name}</b><small>{item.address}</small></span><i>선택 →</i></button>)}{!hotelResults.length && <button type="button" onClick={() => setHotelOpen(false)}><span><b>‘{hotel}’ 직접 입력</b><small>입력한 숙소명으로 추천받기</small></span><i>선택 →</i></button>}</> : hotelSuggestions.map((item) => <button type="button" key={item} onClick={() => { setHotel(item); setHotelOpen(false); }}>{item}<span>선택 →</span></button>)}</div></section></div>}
  </main>;
}
