import BrandCharacter from "../components/BrandCharacter";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getRegions } from "../api/regions";
import { searchAccommodations } from "../api/travelRecommendations";
import { asList } from "../hooks/useApi";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";
import { searchKakaoPlaces } from "../components/kakaoMaps";

const themes = [
  { value: "NATURE_HEALING", label: "자연·힐링" },
  { value: "LOCAL_FOOD", label: "로컬 미식" },
  { value: "PHOTO_SPOTS", label: "감성 사진" },
  { value: "HISTORY_CULTURE", label: "역사·문화" }
];
function locationPayload(item) {
  return item ? {
    kakaoPlaceId: item.kakaoPlaceId,
    name: item.name,
    address: item.roadAddress || item.address,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    imageUrl: item.imageUrl || item.thumbnailUrl || item.firstImage || ""
  } : null;
}
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

function LocationResultCard({ item, onSelect }) {
  const imageUrl = item.imageUrl || item.thumbnailUrl || item.firstImage || "";
  const primaryAddress = item.roadAddress || item.address || "주소 정보 없음";
  const secondaryAddress = item.roadAddress && item.address && item.roadAddress !== item.address ? item.address : "";
  return <button className="location-result-card" type="button" onClick={onSelect}>
    {imageUrl && <img src={imageUrl} alt="" onError={(event) => event.currentTarget.remove()} />}
    <span className="location-result-copy">
      <b>{item.name}</b>
      <small>{primaryAddress}</small>
      {secondaryAddress && <small className="location-result-address-secondary">지번 {secondaryAddress}</small>}
      {item.category && <em>{item.category}</em>}
    </span>
  </button>;
}

export default function RecommendPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRegion = searchParams.get("region") || "";
  const regionPickerRef = useRef(null);
  const dateTriggerRef = useRef(null);
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [region, setRegion] = useState(requestedRegion);
  const [regionRecords, setRegionRecords] = useState([]);
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const [debouncedRegionQuery, setDebouncedRegionQuery] = useState("");
  const [regionFiltering, setRegionFiltering] = useState(false);
  const [regionOptions, setRegionOptions] = useState(["전라도 전체"]);
  const [regionSearching, setRegionSearching] = useState(false);
  const [regionError, setRegionError] = useState("");
  const [hotel, setHotel] = useState("");
  const [hotelOpen, setHotelOpen] = useState(false);
  const [hotelResults, setHotelResults] = useState([]);
  const [hotelSearching, setHotelSearching] = useState(false);
  const [hotelError, setHotelError] = useState("");
  const [accommodation, setAccommodation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [endLocation, setEndLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routeTarget, setRouteTarget] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [routeResults, setRouteResults] = useState([]);
  const [routeSearching, setRouteSearching] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [formError, setFormError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [calendarOrigin, setCalendarOrigin] = useState({ x: 0, y: 0 });
  const [draftStart, setDraftStart] = useState(null);
  const [draftEnd, setDraftEnd] = useState(null);
  const todayRef = useRef(new Date());
  todayRef.current.setHours(0, 0, 0, 0);
  const [calendarCursor, setCalendarCursor] = useState(new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
  const [dailyPlaceCounts, setDailyPlaceCounts] = useState([]);
  const transportType = "CAR";
  const [companionType, setCompanionType] = useState("");

  async function loadRegions() {
    setRegionSearching(true);
    setRegionError("");
    try {
      const data = await getRegions();
      const list = asList(data, "regions");
      setRegionRecords(list); setRegionOptions(["전라도 전체", ...list.map((item) => item.name)]);
      if (requestedRegion && list.some((item) => item.name === requestedRegion)) setRegion(requestedRegion);
    } catch (error) { setRegionRecords([]); setRegionOptions([]); setRegionError(error.message || "여행 지역을 불러오지 못했습니다."); }
    finally { setRegionSearching(false); }
  }

  useEffect(() => {
    sessionStorage.removeItem("travelGuideConditions");
    sessionStorage.removeItem("travelGuideResult");
    loadRegions();
  }, []);

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
    if (!regionOpen || !regionQuery.trim()) {
      setDebouncedRegionQuery("");
      setRegionFiltering(false);
      return undefined;
    }
    setRegionFiltering(true);
    const timer = setTimeout(() => {
      setDebouncedRegionQuery(regionQuery.trim());
      setRegionFiltering(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [regionOpen, regionQuery]);

  useEffect(() => {
    if (!hotelOpen || !hotel.trim()) { setHotelResults([]); setHotelError(""); setHotelSearching(false); return undefined; }
    const controller = new AbortController();
    setHotelError("");
    setHotelSearching(true);
    const timer = setTimeout(() => {
      const selectedRegion = regionRecords.find((item) => item.name === region);
      const regionId = selectedRegion?.regionId ?? selectedRegion?.id;
      if (!regionId) {
        setHotelResults([]);
        setHotelError("숙소를 검색할 여행 지역을 먼저 선택해 주세요.");
        setHotelSearching(false);
        return;
      }
      searchAccommodations({ regionId, query: hotel.trim(), size: 10, signal: controller.signal })
        .then(setHotelResults)
        .catch((error) => {
          if (error.name !== "AbortError") {
            setHotelResults([]);
            setHotelError(error.message || "숙소를 검색하지 못했습니다.");
          }
        })
        .finally(() => { if (!controller.signal.aborted) setHotelSearching(false); });
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [hotel, hotelOpen, region, regionRecords]);

  useEffect(() => {
    if (!routeTarget || !routeQuery.trim()) { setRouteResults([]); setRouteError(""); setRouteSearching(false); return undefined; }
    const controller = new AbortController();
    setRouteError(""); setRouteSearching(true);
    const timer = setTimeout(() => {
      if (!KAKAO_MAP_JAVASCRIPT_KEY) { setRouteResults([]); setRouteError("카카오 지도 키가 설정되지 않았습니다."); setRouteSearching(false); return; }
      searchKakaoPlaces(KAKAO_MAP_JAVASCRIPT_KEY, routeQuery.trim(), 10)
        .then((items) => { if (!controller.signal.aborted) setRouteResults(items); })
        .catch((error) => { if (!controller.signal.aborted) { setRouteResults([]); setRouteError(error.message || "장소를 검색하지 못했습니다."); } })
        .finally(() => { if (!controller.signal.aborted) setRouteSearching(false); });
    }, 1000);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [routeTarget, routeQuery]);

  function submit(event) {
    event.preventDefault();
    const selectedRegion = regionRecords.find((item) => item.name === region);
    const regionId = selectedRegion?.regionId ?? selectedRegion?.id;
    if (!regionId || !startDate || !endDate || !accommodation || !startLocation || !endLocation || !selectedThemes.length || !companionType || dailyPlaceCounts.length !== Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000) + 1) {
      setFormError("지역, 날짜, 숙소, 출발지, 도착지, 여행 테마, 동행 유형을 모두 선택해 주세요.");
      return;
    }
    setFormError("");
    const conditions = { regionId: Number(regionId), regionName: region, startDate, endDate, accommodation, startLocation, endLocation, themes: selectedThemes, dailyPlaceCounts, transportType, companionType };
    sessionStorage.setItem("travelGuideConditions", JSON.stringify(conditions));
    sessionStorage.removeItem("travelGuideResult");
    setIsSubmitting(true);
    window.setTimeout(() => navigate("/travel-guide", { state: conditions }), 520);
  }

  function openCalendar() {
    const triggerRect = dateTriggerRef.current?.getBoundingClientRect();
    if (triggerRect) {
      setCalendarOrigin({
        x: triggerRect.left + triggerRect.width / 2 - window.innerWidth / 2,
        y: triggerRect.top + triggerRect.height / 2 - window.innerHeight / 2
      });
    }
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

  const draftDayCount = draftStart && draftEnd
    ? Math.max(1, Math.min(7, Math.round((draftEnd - draftStart) / 86400000) + 1))
    : 0;

  return <main className="travel-guide-main react-travel-guide-main">
    <form className={`travel-search-bar react-guide-search-react${isSubmitting ? " is-submitting" : ""}`} onSubmit={submit}>
      <div className="recommend-background-image" aria-hidden="true" />
      <header className="recommend-intro">
        <span>JOURNEY TO JEOLLA</span>
        <h1>취향 따라, 전라도 한 바퀴</h1>
        <p>머무는 곳과 날짜를 고르면 나만의 여행이 시작돼요.</p>
      </header>
      <div className="recommend-birds" aria-hidden="true"><i /><i /><i /></div>
      <div className="recommend-birds recommend-birds--two" aria-hidden="true"><i /><i /><i /></div>
      <div className="recommend-birds recommend-birds--three" aria-hidden="true"><i /><i /><i /></div>
      <div className="recommend-form-panel">
      <div className={`travel-search-field travel-search-region${regionOpen ? " is-open" : ""}`} ref={regionPickerRef} onClick={(event) => { if (event.target.closest(".travel-region-picker")) return; if (!regionOpen) setRegionQuery(""); setRegionOpen((current) => !current); }}>
        <span>여행 지역 <small>선택</small></span>
        <div className="travel-region-input-wrap">
          <button className="travel-region-select" type="button" aria-label={region ? `선택 지역: ${region}` : "여행 지역 선택"} aria-expanded={regionOpen} aria-controls="travel-region-picker">
            <i className="travel-field-icon travel-field-icon-location" aria-hidden="true" />
            <strong className={region ? "" : "travel-region-placeholder"}>{region || "지역 선택"}</strong>
            <i className="travel-region-chevron" aria-hidden="true"><i /></i>
          </button>
        </div>
        {regionOpen && <section className="travel-region-picker" id="travel-region-picker" aria-label="전라도 지역 선택">
          <label className="travel-region-search"><i aria-hidden="true" /><input value={regionQuery} onChange={(event) => setRegionQuery(event.target.value)} placeholder="지역 이름 검색" autoComplete="off" aria-label="지역 이름 검색" /></label>
          <div className="travel-region-options">{regionSearching || regionFiltering ? <div className="hotel-search-loading" role="status" aria-label="지역 검색 중"><BrandCharacter pose="loading" /><small>검색 중</small></div> : regionError ? <p className="travel-region-empty" role="alert">{regionError}</p> : regionOptions.filter((item) => item !== "전라도 전체" && item.toLocaleLowerCase().includes(debouncedRegionQuery.toLocaleLowerCase())).length ? regionOptions.filter((item) => item !== "전라도 전체" && item.toLocaleLowerCase().includes(debouncedRegionQuery.toLocaleLowerCase())).map((item, index) => <button className={region === item ? "is-selected" : ""} style={{ "--region-index": index }} type="button" key={item} onClick={() => { setRegion(item); setRegionQuery(""); setAccommodation(null); setStartLocation(null); setEndLocation(null); setHotel(""); setRegionOpen(false); }}><span>{item}</span>{region === item && <i>✓</i>}</button>) : <p className="travel-region-empty">검색 결과가 없어요.</p>}</div>
        </section>}
      </div>
      <button className={`travel-search-field travel-date-trigger${dateOpen ? " is-open" : ""}`} type="button" ref={dateTriggerRef} onClick={openCalendar}><span>여행 날짜 <small>선택</small></span><div><i className="travel-field-icon travel-field-icon-calendar" aria-hidden="true" /><strong>{startDate && endDate ? <><span className="travel-date-value">{shortDate(new Date(`${startDate}T00:00:00`))}</span><i>→</i><span className="travel-date-value">{shortDate(new Date(`${endDate}T00:00:00`))}</span><em>{Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000)}박</em></> : <span className="travel-date-placeholder">날짜 선택</span>}</strong><i className="travel-date-arrow" aria-hidden="true" /></div></button>
      <input name="start" type="hidden" value={startDate} /><input name="end" type="hidden" value={endDate} />
      <button className="travel-search-field travel-hotel-trigger travel-stay-trigger" type="button" onClick={() => { setHotelError(region.trim() ? "" : "숙소를 검색할 여행 지역을 먼저 선택해 주세요."); setHotelOpen(true); }}><span>숙소 위치</span><div><i className="travel-field-icon travel-field-icon-hotel" aria-hidden="true" /><strong>{hotel}</strong></div></button>
      <button className="travel-search-field travel-hotel-trigger" type="button" onClick={() => { setRouteTarget("start"); setRouteQuery(""); }}><span>첫날 출발지</span><div><i className="travel-field-icon travel-field-icon-location" aria-hidden="true" /><strong>{startLocation?.name || ""}</strong></div></button>
      <button className="travel-search-field travel-hotel-trigger" type="button" onClick={() => { setRouteTarget("end"); setRouteQuery(""); }}><span>마지막 날 도착지</span><div><i className="travel-field-icon travel-field-icon-location" aria-hidden="true" /><strong>{endLocation?.name || ""}</strong></div></button>
      <section className="travel-preferences" aria-label="여행 취향 선택"><div className="travel-preference-grid">
        <fieldset className="recommend-choice-group recommend-choice-group--theme"><legend><strong>여행 테마</strong></legend><div className="recommend-options">{themes.map((theme) => <label key={theme.value}><input type="checkbox" name="themes" value={theme.value} checked={selectedThemes.includes(theme.value)} onChange={() => setSelectedThemes((current) => current.includes(theme.value) ? current.filter((item) => item !== theme.value) : current.length < 4 ? [...current, theme.value] : current)} /><span>{theme.label}</span></label>)}</div></fieldset>
        <fieldset className="recommend-choice-group recommend-choice-group--companion"><legend><strong>누구와 함께</strong></legend><div className="recommend-options">{[{ value: "SOLO", label: "혼자" }, { value: "COUPLE", label: "연인" }, { value: "FRIENDS", label: "친구" }, { value: "FAMILY", label: "가족" }].map((item) => <label key={item.value}><input type="radio" name="companionType" value={item.value} checked={companionType === item.value} onChange={() => setCompanionType(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
      </div></section>
      <button className="travel-guide-submit" type="submit">맞춤 여행 추천받기 <span>→</span></button>
      {formError && <p className="page-status is-visible" role="alert">{formError}</p>}
      </div>
    </form>
    {dateOpen && <div className="travel-calendar-popover" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDateOpen(false); }}><section className="travel-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="travel-calendar-title" style={{ width: "min(1040px, calc(100vw - 24px))", left: "50%", top: "50%", "--calendar-shift-x": `${calendarOrigin.x}px`, "--calendar-shift-y": `${calendarOrigin.y}px` }}><header><h2 id="travel-calendar-title">여행 날짜를 선택하세요</h2><button type="button" aria-label="닫기" onClick={() => setDateOpen(false)}>×</button></header><div className="travel-calendar-body"><div className="travel-calendar-main"><div className="travel-calendar-nav"><button type="button" aria-label="이전 달" disabled={calendarCursor <= new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)} onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="다음 달" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="travel-calendar-months"><CalendarMonth monthDate={calendarCursor} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectDate} /><CalendarMonth monthDate={new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)} today={todayRef.current} start={draftStart} end={draftEnd} onSelect={selectDate} /></div></div>{draftDayCount > 0 && <aside className="calendar-daily-counts"><header><strong>방문할 관광지 수</strong><small>1–5곳</small></header><div>{Array.from({ length: draftDayCount }, (_, index) => { const count = dailyPlaceCounts[index] || 3; return <article key={index}><b>DAY {index + 1}</b><div><button type="button" disabled={count <= 1} aria-label={`DAY ${index + 1} 관광지 줄이기`} onClick={() => setDailyPlaceCounts((current) => Array.from({ length: draftDayCount }, (__, itemIndex) => itemIndex === index ? Math.max(1, (current[itemIndex] || 3) - 1) : current[itemIndex] || 3))}>−</button><strong>{count}</strong><button type="button" disabled={count >= 5} aria-label={`DAY ${index + 1} 관광지 늘리기`} onClick={() => setDailyPlaceCounts((current) => Array.from({ length: draftDayCount }, (__, itemIndex) => itemIndex === index ? Math.min(5, (current[itemIndex] || 3) + 1) : current[itemIndex] || 3))}>＋</button></div></article>; })}</div></aside>}</div><footer><button type="button" disabled={!draftStart || !draftEnd} onClick={applyDates}>적용하기</button></footer></section></div>}
    {hotelOpen && <div className="hotel-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHotelOpen(false); }}><section className="hotel-search-dialog" role="dialog" aria-modal="true" aria-labelledby="react-hotel-title"><header><div><span className="travel-guide-eyebrow">STAY LOCATION</span><h2 id="react-hotel-title">어디에 머무시나요?</h2></div><button type="button" aria-label="닫기" onClick={() => setHotelOpen(false)}>×</button></header><p>숙소를 기준으로 가까운 관광지와 효율적인 이동 경로를 추천해 드려요.</p><label className="hotel-search-input"><span>⌕</span><input value={hotel} maxLength="100" onChange={(event) => { setHotel(event.target.value); setAccommodation(null); }} placeholder="호텔명 또는 주소를 검색하세요" autoFocus /></label><div className="hotel-search-results react-hotel-results"><small>검색 결과</small>{hotelSearching ? <div className="hotel-search-loading" role="status" aria-label="숙소 검색 중"><BrandCharacter pose="loading" /></div> : hotelError ? <p className="hotel-search-empty" role="alert">{hotelError}</p> : hotel.trim() ? hotelResults.length ? hotelResults.map((item) => <LocationResultCard item={item} key={item.kakaoPlaceId || `${item.name}-${item.address}`} onSelect={() => { setAccommodation(locationPayload(item)); setHotel(item.name); setHotelOpen(false); }} />) : <p className="hotel-search-empty">검색된 숙소가 없습니다.</p> : <p className="hotel-search-empty">숙소명 또는 주소를 입력해 주세요.</p>}</div></section></div>}
    {routeTarget && <div className="hotel-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRouteTarget(""); }}><section className="hotel-search-dialog" role="dialog" aria-modal="true" aria-labelledby="route-point-title"><header><div><span className="travel-guide-eyebrow">ROUTE POINT</span><h2 id="route-point-title">{routeTarget === "start" ? "첫날 출발지" : "마지막 날 도착지"}를 선택하세요</h2></div><button type="button" aria-label="닫기" onClick={() => setRouteTarget("")}>×</button></header><p>역, 터미널 등 실제 출발하거나 도착할 장소를 검색해 주세요.</p><label className="hotel-search-input"><span>⌕</span><input value={routeQuery} maxLength="100" onChange={(event) => setRouteQuery(event.target.value)} placeholder="장소명 또는 주소를 검색하세요" autoFocus /></label><div className="hotel-search-results react-hotel-results"><small>검색 결과</small>{routeSearching ? <div className="hotel-search-loading" role="status" aria-label="장소 검색 중"><BrandCharacter pose="loading" /></div> : routeError ? <p className="hotel-search-empty" role="alert">{routeError}</p> : routeQuery.trim() ? routeResults.length ? routeResults.map((item) => <LocationResultCard item={item} key={item.kakaoPlaceId || `${item.name}-${item.address}`} onSelect={() => { const point = locationPayload(item); if (routeTarget === "start") setStartLocation(point); else setEndLocation(point); setRouteTarget(""); }} />) : <p className="hotel-search-empty">검색된 장소가 없습니다.</p> : <p className="hotel-search-empty">장소명 또는 주소를 입력해 주세요.</p>}</div></section></div>}
  </main>;
}
