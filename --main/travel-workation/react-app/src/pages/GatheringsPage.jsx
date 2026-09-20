import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { authApiUrl } from "../config";
import { FormMessage } from "../components/UI";
import { getRegions } from "../api/regions";
import { asList, useApi } from "../hooks/useApi";

let gatheringsPageCache = null;
let gatheringRegionsCache = null;

function formatDate(value) {
  if (!value) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDate(left, right) {
  return left && right && localDateFromDate(left) === localDateFromDate(right);
}

function localDateFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function gatheringDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateFromDate(date);
}

const gatheringTimeOptions = [
  ["", "전체 시간"], ["06:00", "오전 6시"], ["09:00", "오전 9시"], ["12:00", "오후 12시"],
  ["15:00", "오후 3시"], ["18:00", "오후 6시"], ["20:00", "오후 8시"]
];

function GatheringCalendarMonth({ monthDate, today, selected, onSelect }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  return <article className="travel-calendar-month"><h3>{year}.{String(month + 1).padStart(2, "0")}</h3><div className="travel-calendar-week">{"일월화수목금토".split("").map((day) => <span key={day}>{day}</span>)}</div><div className="travel-calendar-days">{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: lastDate }, (_, index) => {
    const date = new Date(year, month, index + 1);
    return <button type="button" disabled={date < today} className={sameDate(date, selected) ? "is-single" : ""} onClick={() => onSelect(date)} key={localDateFromDate(date)}><b>{date.getDate()}</b></button>;
  })}</div></article>;
}

function toKoreaOffsetDateTime(value) {
  if (!value) return "";
  if (/([+-]\d{2}:\d{2}|Z)$/.test(value)) return value;
  return `${value.length === 16 ? `${value}:00` : value}+09:00`;
}

function normalizeGathering(item) {
  const startsAt = item.startsAt || item.event_time;
  const expired = Boolean(startsAt) && new Date(startsAt).getTime() <= Date.now();
  return {
    ...item,
    id: item.gatheringId || item.id,
    region: item.region?.name || item.region || "",
    location: item.meetingPlace,
    event_time: startsAt,
    participant_count: item.participantCount,
    nickname: item.creator?.nickname,
    username: item.creator?.nickname,
    owned: Boolean(item.host) || String(item.creator?.id ?? "") === String(sessionStorage.getItem("userId") || ""),
    expired,
    confirmed: expired || (item.status && item.status !== "OPEN")
  };
}

function GatheringCard({ gathering, onOpen, onAction, onCancel }) {
  const full = Number(gathering.participant_count) >= Number(gathering.capacity);
  const actionDisabled = gathering.owned || gathering.cancelled || gathering.expired || (!gathering.joined && (full || gathering.confirmed));
  const actionLabel = gathering.owned
    ? "내가 만든 모임"
    : gathering.expired
      ? "마감됨"
    : gathering.cancelled
      ? "재참여 불가"
    : gathering.joined
      ? "참여 취소"
      : gathering.confirmed
        ? "모집 확정"
        : full
          ? "정원 마감"
          : "참여하기";

  return (
    <article className={`gathering-item gathering-item-compact gathering-story-card${gathering.owned ? " is-owned" : ""}${gathering.joined ? " is-joined" : ""}`} onClick={() => onOpen(gathering)}>
      <div className="gathering-head"><div><span className="gathering-region-chip">{gathering.region || "전라도"}</span><h3>{gathering.title}</h3><p className="gathering-card-location">{gathering.location || `${gathering.region} 모임 장소`}</p></div><div className="gathering-card-schedule"><time>{formatDate(gathering.event_time)}</time><strong>{gathering.participant_count || 0}/{gathering.capacity}명</strong><small>{gathering.confirmed ? "모집 확정" : `${Math.max(0, Number(gathering.capacity) - Number(gathering.participant_count || 0))}자리 남음`}</small></div></div>
      <footer>
        <span className="gathering-footer-concept">{gathering.concept || "자유 모임"}{gathering.owned && gathering.confirmed ? " · 확정됨" : ""}</span>
        {gathering.owned ? <div className="gathering-owner-actions">
          <span className="gathering-owner-status">참여 중</span>
          <button className="button join-button is-cancel" type="button" onClick={(event) => { event.stopPropagation(); onCancel(gathering); }}>취소하기</button>
        </div> : gathering.joined ? <div className="gathering-participation-actions">
          <span>참여중</span>
          <button className="button join-button is-leave" type="button" onClick={(event) => { event.stopPropagation(); onAction(gathering); }}>{actionLabel}</button>
        </div> : <button className="button join-button" type="button" disabled={actionDisabled} onClick={(event) => { event.stopPropagation(); onAction(gathering); }}>
          {actionLabel}
        </button>}
      </footer>
    </article>
  );
}

export default function GatheringsPage() {
  const todayRef = useRef(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  const initialStartDate = localDate();
  const initialEndDate = localDate(365);
  const cachedFilters = gatheringsPageCache?.filters;
  const [region, setRegion] = useState(cachedFilters?.region || "전체");
  const [concept, setConcept] = useState(cachedFilters?.concept || "");
  const [meetingPlace, setMeetingPlace] = useState(cachedFilters?.meetingPlace || "");
  const [time, setTime] = useState(cachedFilters?.time || "");
  const [startDate, setStartDate] = useState(cachedFilters?.startDate || initialStartDate);
  const [dateScope, setDateScope] = useState(cachedFilters?.dateScope || "after");
  const [dateOpen, setDateOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [resultPage, setResultPage] = useState(1);
  const [draftDate, setDraftDate] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1));
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [regionRecords, setRegionRecords] = useState(gatheringRegionsCache || []);
  const [cancelledIds, setCancelledIds] = useState(() => new Set());
  const [joinedIds, setJoinedIds] = useState(() => new Set());
  const { data, loading, error, run, setData } = useApi(null, { immediate: false });
  const normalizedConcept = concept.trim().toLocaleLowerCase();
  const normalizedMeetingPlace = meetingPlace.trim().toLocaleLowerCase();
  const gatherings = asList(data, "content")
    .map(normalizeGathering)
    .filter((item) => !item.expired)
    .filter((item) => region === "전체" || String(item.region || "").includes(region))
    .filter((item) => {
      const eventDate = gatheringDate(item.event_time);
      return dateScope === "single" ? eventDate === startDate : eventDate >= startDate;
    })
    .filter((item) => !normalizedConcept || `${item.title || ""} ${item.concept || ""} ${item.description || ""}`.toLocaleLowerCase().includes(normalizedConcept))
    .filter((item) => !normalizedMeetingPlace || String(item.location || "").toLocaleLowerCase().includes(normalizedMeetingPlace))
    .filter((item) => {
      if (!time) return true;
      const eventDate = new Date(item.event_time);
      if (Number.isNaN(eventDate.getTime())) return false;
      const eventTime = `${String(eventDate.getHours()).padStart(2, "0")}:${String(eventDate.getMinutes()).padStart(2, "0")}`;
      return eventTime >= time;
    })
    .map((item) => ({
      ...item,
      joined: item.joined || joinedIds.has(String(item.id))
    }));
  const orderedGatherings = [...gatherings.filter((item) => item.owned), ...gatherings.filter((item) => !item.owned)];
  const gatheringsPerPage = 6;
  const resultPageCount = Math.max(1, Math.ceil(orderedGatherings.length / gatheringsPerPage));
  const visibleGatherings = orderedGatherings.slice((resultPage - 1) * gatheringsPerPage, resultPage * gatheringsPerPage);
  const visibleOwnedGatherings = visibleGatherings.filter((item) => item.owned);
  const visibleOtherGatherings = visibleGatherings.filter((item) => !item.owned);

  useEffect(() => {
    if (gatheringsPageCache?.data) {
      setData(gatheringsPageCache.data);
      return;
    }
    getRegions().then(async (result) => {
      const records = asList(result, "regions");
      gatheringRegionsCache = records;
      setRegionRecords(records);
      await loadAllRegions({ startDate: initialStartDate, endDate: initialEndDate });
    }).catch((requestError) => setMessage(requestError.message));
  }, []);

  useEffect(() => { setResultPage(1); }, [region, concept, meetingPlace, time, startDate, dateScope]);
  useEffect(() => { if (resultPage > resultPageCount) setResultPage(resultPageCount); }, [resultPage, resultPageCount]);

  useEffect(() => {
    if (!data) return undefined;
    const timer = window.setTimeout(() => {
      setMessage("");
      refreshGatherings().catch(() => {});
    }, 350);
    return () => window.clearTimeout(timer);
  }, [region, concept, meetingPlace, time, startDate, dateScope]);

  function filterSnapshot(overrides = {}) {
    return {
      region: overrides.region ?? region,
      concept: overrides.concept ?? concept,
      meetingPlace: overrides.meetingPlace ?? meetingPlace,
      time: overrides.time ?? time,
      startDate: overrides.startDate ?? startDate,
      dateScope: overrides.dateScope ?? dateScope
    };
  }

  async function loadAllRegions(overrides = {}) {
    const response = await run(buildGatheringQuery({ ...overrides, region: "전체" }));
    return mergeWithHosted(asList(response, "content"), filterSnapshot({ ...overrides, region: "전체" }));
  }

  async function mergeWithHosted(generalItems, filters = filterSnapshot()) {
    let hostedResponse = null;
    if (hasSession()) {
      try {
        hostedResponse = await apiRequest(authApiUrl("/gatherings/me?type=hosted&page=0&size=20"));
      } catch {
        // 내가 만든 게더링은 목록을 보완하는 선택 데이터이므로,
        // 조회에 실패해도 일반 게더링 목록은 그대로 표시한다.
      }
    }
    const hostedItems = asList(hostedResponse, "content").map((item) => ({ ...item, host: true }));
    const unique = new Map([...generalItems, ...hostedItems].map((item) => [item.id || item.gatheringId, item]));
    const content = [...unique.values()];
    const nextData = { content, page: 0, size: content.length, totalElements: content.length, hasNext: false };
    gatheringsPageCache = { data: nextData, filters };
    setData(nextData);
    return content;
  }

  async function loadSelectedRegion() {
    const generalResponse = await run(buildGatheringQuery());
    return mergeWithHosted(asList(generalResponse, "content"), filterSnapshot());
  }

  async function refreshGatherings() {
    return region === "전체" ? loadAllRegions() : loadSelectedRegion();
  }

  function buildGatheringQuery(overrides = {}) {
    const selectedRegion = overrides.region ?? region;
    const selectedStartDate = overrides.startDate ?? startDate;
    const selectedDateScope = overrides.dateScope ?? dateScope;
    const selectedConcept = overrides.concept ?? concept;
    const selectedMeetingPlace = overrides.meetingPlace ?? meetingPlace;
    const selectedTime = overrides.time ?? time;
    const selectedEndDate = overrides.endDate ?? (selectedDateScope === "single" ? selectedStartDate : initialEndDate);
    const params = new URLSearchParams();
    params.set("region", selectedRegion === "전체" ? "" : selectedRegion || "");
    params.set("startsOn", selectedStartDate);
    params.set("endsOn", selectedEndDate);
    if (selectedConcept.trim()) params.set("concept", selectedConcept.trim());
    if (selectedMeetingPlace.trim()) params.set("meetingPlace", selectedMeetingPlace.trim());
    if (selectedTime) params.set("time", selectedTime);
    params.set("page", "0");
    params.set("size", "100");
    return authApiUrl(`/gatherings?${params}`);
  }

  async function search(event) {
    event.preventDefault();
    if (!region || !startDate) {
      setMessage("지역과 날짜를 입력해 주세요.");
      return;
    }
    setMessage("");
    await refreshGatherings().catch(() => {});
  }

  async function resetFilters() {
    const resetStartDate = localDate();
    setRegion("전체");
    setConcept("");
    setMeetingPlace("");
    setTime("");
    setStartDate(resetStartDate);
    setDateScope("after");
    setFiltersCollapsed(true);
    setMessage("");
    await loadAllRegions({ region: "전체", concept: "", meetingPlace: "", time: "", startDate: resetStartDate, dateScope: "after", endDate: initialEndDate }).catch(() => {});
  }

  function openDatePicker() {
    const current = new Date(`${startDate}T00:00:00`);
    setDraftDate(current);
    setCalendarCursor(new Date(current.getFullYear(), current.getMonth(), 1));
    setDateOpen(true);
  }

  async function action(item) {
    if (item.owned) {
      setMessage("내가 만든 모임은 '내가 만든 게더링'에서 관리할 수 있어요.");
      return;
    }
    if (!hasSession()) {
      setMessage("로그인 후 참여할 수 있어요.");
      return;
    }
    try {
      const endpoint = authApiUrl(item.joined ? `/gatherings/${item.id}/participants/me` : `/gatherings/${item.id}/participants`);
      const result = await apiRequest(endpoint, { method: item.joined ? "PATCH" : "POST" });
      if (item.joined && result?.participantStatus === "CANCELLED") {
        setCancelledIds((current) => new Set(current).add(String(item.id)));
      }
      setJoinedIds((current) => {
        const next = new Set(current);
        if (item.joined) next.delete(String(item.id));
        else next.add(String(item.id));
        return next;
      });
      setMessage(item.joined ? "참여를 취소했습니다." : "게더링에 참여했습니다.");
      await refreshGatherings();
      setSelected(null);
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  async function openDetails(item) {
    setMessage("");
    try {
      const detail = await apiRequest(authApiUrl(`/gatherings/${item.id}`));
      let participantData = null;
      if (detail.host || detail.joined) {
        participantData = await apiRequest(authApiUrl(`/gatherings/${item.id}/participants`));
      }
      setSelected(normalizeGathering({
        ...detail,
        participants: participantData?.participants || [],
        participantCount: participantData?.participantCount ?? detail.participantCount
      }));
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  async function editGathering(item) {
    if (!item.host) { setMessage("게더링 방장만 수정할 수 있어요."); return; }
    const title = window.prompt("게더링 제목을 수정해 주세요.", item.title || "");
    if (title == null) return;
    const description = window.prompt("게더링 설명을 수정해 주세요.", item.description || "");
    if (description == null) return;
    const concept = window.prompt("게더링 콘셉트를 수정해 주세요.", item.concept || "");
    if (concept == null) return;
    const meetingPlace = window.prompt("만날 장소를 수정해 주세요.", item.meetingPlace || "");
    if (meetingPlace == null) return;
    const startsAt = window.prompt("시작 시각을 입력해 주세요. (예: 2026-08-20T20:00)", String(item.startsAt || "").slice(0, 16));
    if (startsAt == null) return;
    const capacityInput = window.prompt("정원을 입력해 주세요.", String(item.capacity || 2));
    if (capacityInput == null) return;
    const capacity = Number(capacityInput);
    if (!title.trim() || title.trim().length > 150) { setMessage("제목은 1~150자로 입력해 주세요."); return; }
    if (concept.trim().length > 100) { setMessage("콘셉트는 100자 이하로 입력해 주세요."); return; }
    if (meetingPlace.trim().length > 255) { setMessage("장소는 255자 이하로 입력해 주세요."); return; }
    if (!Number.isInteger(capacity) || capacity < Math.max(2, Number(item.participant_count || 0)) || capacity > 100) { setMessage("정원은 현재 참여 인원 이상, 100명 이하로 입력해 주세요."); return; }
    const normalizedStartsAt = toKoreaOffsetDateTime(startsAt);
    if (!normalizedStartsAt || new Date(normalizedStartsAt).getTime() <= Date.now()) { setMessage("시작 시각은 현재보다 미래여야 합니다."); return; }
    try {
      const result = await apiRequest(authApiUrl(`/gatherings/${item.id}`), { method: "PATCH", body: JSON.stringify({ title: title.trim(), description: description.trim(), concept: concept.trim(), meetingPlace: meetingPlace.trim(), startsAt: normalizedStartsAt, capacity }) });
      setSelected(normalizeGathering({ ...item, ...result, participants: item.participants || [] }));
      setMessage("게더링을 수정했습니다.");
      await refreshGatherings();
    } catch (requestError) { setMessage(requestError.message); }
  }

  async function deleteGathering(item) {
    if (!item.host) { setMessage("게더링 방장만 삭제할 수 있어요."); return; }
    if (!window.confirm("이 게더링을 삭제할까요? 삭제하면 목록에서 바로 숨겨집니다.")) return;
    try {
      await apiRequest(authApiUrl(`/gatherings/${item.id}`), { method: "DELETE" });
      setSelected(null);
      setMessage("게더링을 삭제했습니다.");
      await refreshGatherings();
    } catch (requestError) { setMessage(requestError.message); }
  }

  const introActions = (
    <div className="page-intro-actions">
      <Link className="button button-primary gathering-create-card" to="/gatherings/write">게더링 만들기 +</Link>
    </div>
  );

  return (
    <main className="feature-page-main gatherings-page-main gathering-experience">
      <section className="page-intro gathering-hero-intro"><div><p className="eyebrow dark">MEET IN JEOLLA</p><h1>여행의 한 장면을<br />함께 만들어요</h1><span>같은 취향, 같은 지역의 여행자와 가볍게 만나는 로컬 게더링</span></div>{introActions}</section>
      <div className={`page-workspace gatherings-search-layout gathering-glass-workspace${filtersCollapsed ? " is-results-only" : ""}`}><section className="page-panel gathering-search-panel gathering-glass-panel"><p className="eyebrow dark">FIND A GATHERING</p><h2>게더링 조건 검색</h2><form className="stack-form" onSubmit={(event) => event.preventDefault()}>
        <div className={`gathering-toggle-field${regionOpen ? " is-open" : ""}`}><span>지역</span><button className="gathering-toggle-trigger" type="button" aria-expanded={regionOpen} onClick={() => { setRegionOpen((open) => !open); setTimeOpen(false); }}><strong>{region === "전체" ? "전체 지역" : region}</strong><i /></button>{regionOpen && <div className="gathering-toggle-menu" role="listbox"><button className={region === "전체" ? "is-selected" : ""} type="button" onClick={() => { setRegion("전체"); setRegionOpen(false); }}>전체 지역 <b>✓</b></button>{regionRecords.map((item) => <button className={region === item.name ? "is-selected" : ""} type="button" role="option" aria-selected={region === item.name} key={item.regionId || item.id || item.name} onClick={() => { setRegion(item.name); setRegionOpen(false); }}>{item.name}<b>✓</b></button>)}</div>}</div>
        <div className="gathering-date-time"><label>날짜<button className="job-date-trigger gathering-calendar-trigger" type="button" aria-expanded={dateOpen} onClick={() => { setRegionOpen(false); setTimeOpen(false); openDatePicker(); }}><span className="job-picker-icon">▦</span><strong>{startDate.replaceAll("-", ".")}</strong><i /></button></label><div className={`gathering-toggle-field gathering-time-toggle${timeOpen ? " is-open" : ""}`}><span>시간</span><button className="gathering-toggle-trigger" type="button" aria-expanded={timeOpen} onClick={() => { setTimeOpen((open) => !open); setRegionOpen(false); }}><strong>{gatheringTimeOptions.find(([value]) => value === time)?.[1] || time}</strong><i /></button>{timeOpen && <div className="gathering-toggle-menu gathering-time-menu" role="listbox">{gatheringTimeOptions.map(([value, label]) => <button className={time === value ? "is-selected" : ""} type="button" role="option" aria-selected={time === value} key={value || "all"} onClick={() => { setTime(value); setTimeOpen(false); }}>{label}<b>✓</b></button>)}</div>}</div></div>
        <fieldset className="gathering-date-scope"><legend>날짜 검색 범위</legend><label><input type="radio" name="date-scope" checked={dateScope === "after"} onChange={() => setDateScope("after")} /><span>선택한 날 이후 전체</span></label><label><input type="radio" name="date-scope" checked={dateScope === "single"} onChange={() => setDateScope("single")} /><span>선택한 날만</span></label></fieldset>
        <label>콘셉트<input type="search" maxLength="100" value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="예: 미식, 전시, 산책" /></label>
        <label>만날 장소<input type="search" maxLength="255" value={meetingPlace} onChange={(event) => setMeetingPlace(event.target.value)} placeholder="예: 여수역" /></label>
        <button className="button" type="button" onClick={resetFilters}>전체 게더링 보기</button>
      </form><FormMessage message={message} /></section><section className="page-panel gathering-results-panel"><div className="gathering-results-head"><div><p className="eyebrow dark">OPEN GATHERINGS</p><h2>참여 가능한 게더링</h2></div><div className="gathering-results-actions"><strong>{gatherings.length}</strong>{filtersCollapsed && <button type="button" onClick={() => setFiltersCollapsed(false)}>조건 다시 선택</button>}</div></div>
      {loading ? <div className="gathering-result-state is-loading" role="status"><i aria-hidden="true" /><strong>참여 가능한 게더링을 찾고 있어요</strong><p>선택한 지역과 날짜의 모임을 확인하고 있습니다.</p></div>
        : error ? <div className="gathering-result-state is-error" role="alert"><span aria-hidden="true">!</span><strong>게더링을 불러오지 못했어요</strong><p>{error}</p><button className="button" type="button" onClick={() => refreshGatherings()}>다시 불러오기</button></div>
          : !gatherings.length ? <div className="gathering-result-state is-empty" role="status"><span aria-hidden="true">○</span><strong>현재 조건에 참여 가능한 게더링이 없어요</strong><p>{region !== "전체" ? region + " 지역의 " : ""}{startDate.replaceAll("-", ".")} {dateScope === "single" ? "당일" : "이후"} 모임이 아직 등록되지 않았습니다.<br />조건을 넓히거나 새로운 게더링을 만들어 보세요.</p><div><button className="button" type="button" onClick={resetFilters}>전체 게더링 보기</button><Link className="button button-primary" to="/gatherings/write">게더링 만들기</Link></div></div>
            : <><div className="gathering-result-notice" role="status"><span>✓</span><p><strong>지금 참여 가능한 모임이 {gatherings.length}개 있어요.</strong><small>카드를 눌러 상세 일정과 참여자를 확인해 보세요.</small></p></div><div className="gathering-list">
              {visibleOwnedGatherings.map((item) => <GatheringCard key={item.id} gathering={{ ...item, cancelled: item.participantStatus === "CANCELLED" || cancelledIds.has(String(item.id)) }} onOpen={openDetails} onAction={action} onCancel={deleteGathering} />)}
              {visibleOwnedGatherings.length > 0 && visibleOtherGatherings.length > 0 && <div className="gathering-list-divider"><span>다른 게더링</span></div>}
              {visibleOtherGatherings.map((item) => <GatheringCard key={item.id} gathering={{ ...item, cancelled: item.participantStatus === "CANCELLED" || cancelledIds.has(String(item.id)) }} onOpen={openDetails} onAction={action} onCancel={deleteGathering} />)}
            </div>{resultPageCount > 1 && <nav className="gathering-pagination" aria-label="게더링 결과 페이지"><button type="button" disabled={resultPage === 1} onClick={() => setResultPage((page) => Math.max(1, page - 1))}>이전</button><div>{Array.from({ length: resultPageCount }, (_, index) => index + 1).map((page) => <button className={resultPage === page ? "is-active" : ""} type="button" aria-current={resultPage === page ? "page" : undefined} key={page} onClick={() => setResultPage(page)}>{page}</button>)}</div><button type="button" disabled={resultPage === resultPageCount} onClick={() => setResultPage((page) => Math.min(resultPageCount, page + 1))}>다음</button></nav>}</>}</section></div>
      {dateOpen && <div className="travel-calendar-popover job-calendar-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setDateOpen(false); }}><section className="travel-calendar-dialog job-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="gathering-calendar-title"><header><h2 id="gathering-calendar-title">게더링 날짜를 선택하세요</h2><button type="button" aria-label="닫기" onClick={() => setDateOpen(false)}>×</button></header><div className="travel-calendar-nav"><button type="button" aria-label="이전 달" disabled={calendarCursor <= new Date(todayRef.current.getFullYear(), todayRef.current.getMonth(), 1)} onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><button type="button" aria-label="다음 달" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><div className="travel-calendar-months"><GatheringCalendarMonth monthDate={calendarCursor} today={todayRef.current} selected={draftDate} onSelect={setDraftDate} /><GatheringCalendarMonth monthDate={new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1)} today={todayRef.current} selected={draftDate} onSelect={setDraftDate} /></div><footer><button type="button" disabled={!draftDate} onClick={() => { setStartDate(localDateFromDate(draftDate)); setDateOpen(false); }}>적용하기</button></footer></section></div>}
      {selected && <div className="gathering-detail-modal"><button className="gathering-detail-backdrop" type="button" aria-label="게더링 상세 창 닫기" onClick={() => setSelected(null)} /><section className="gathering-detail-dialog" role="dialog" aria-modal="true"><button className="gathering-detail-close" type="button" aria-label="닫기" onClick={() => setSelected(null)}>×</button><div className="gathering-detail-content"><p className="eyebrow dark">GATHERING DETAIL</p><time>{formatDate(selected.event_time)}</time><h2>{selected.title}</h2><dl className="gathering-detail-info"><div><dt>지역</dt><dd>{selected.region}</dd></div><div><dt>장소</dt><dd>{selected.location}</dd></div><div><dt>참여 인원</dt><dd>{selected.participant_count || 0}/{selected.capacity}명</dd></div><div><dt>올린 사람</dt><dd>{selected.nickname || selected.username || "여행자"}</dd></div></dl><p className="gathering-detail-description">{selected.description || "함께 지역을 경험하는 가벼운 모임입니다."}</p>{selected.participants?.length > 0 && <section className="gathering-detail-participants"><strong>참여한 사람</strong><div>{selected.participants.map((participant) => <span key={participant.userId || participant.nickname}>{participant.nickname}{participant.role === "HOST" ? " · 방장" : ""}</span>)}</div></section>}{selected.host && <div className="gathering-detail-host-actions"><Link className="button" to={`/gatherings/${selected.id}/edit`}>수정</Link><button className="button" type="button" onClick={() => deleteGathering(selected)}>삭제</button></div>}{!selected.owned && <button className="button button-primary" onClick={() => action(selected)}>{selected.joined ? "참여 취소" : "참여하기"}</button>}</div></section></div>}
    </main>
  );
}
