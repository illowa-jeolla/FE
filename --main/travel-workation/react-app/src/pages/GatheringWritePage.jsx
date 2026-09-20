import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import { authApiUrl } from "../config";
import { asList } from "../hooks/useApi";

function toKoreaOffsetDateTime(value) {
  return value ? `${value.length === 16 ? `${value}:00` : value}+09:00` : "";
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const writeTimeGroups = [
  ["오전", Array.from({ length: 24 }, (_, index) => { const hour = Math.floor(index / 2); return `${String(hour).padStart(2, "0")}:${index % 2 ? "30" : "00"}`; })],
  ["오후", Array.from({ length: 24 }, (_, index) => { const hour = 12 + Math.floor(index / 2); return `${String(hour).padStart(2, "0")}:${index % 2 ? "30" : "00"}`; })]
];

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function WriteCalendar({ cursor, selectedDate, onSelect }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return <div className="gathering-write-calendar"><div className="gathering-write-week">{"일월화수목금토".split("").map((day) => <span key={day}>{day}</span>)}</div><div className="gathering-write-days">{Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: lastDate }, (_, index) => { const date = new Date(year, month, index + 1); const key = dateKey(date); return <button className={selectedDate === key ? "is-selected" : ""} type="button" disabled={date < today} onClick={() => onSelect(key)} key={key}>{index + 1}</button>; })}</div></div>;
}

export default function GatheringWritePage() {
  const navigate = useNavigate(); const { id } = useParams(); const editing = Boolean(id); const formRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [regions, setRegions] = useState([]);
  const [busy, setBusy] = useState(editing);
  const [exitOpen, setExitOpen] = useState(false);
  const [regionValue, setRegionValue] = useState("");
  const [regionOpen, setRegionOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("18:00");
  const [calendarCursor, setCalendarCursor] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  useEffect(() => {
    if (!hasSession()) { navigate("/auth"); return; }
    let cancelled = false; setBusy(true);
    Promise.all([getRegions(), editing ? apiRequest(authApiUrl(`/gatherings/${id}`)) : Promise.resolve(null)]).then(([regionResult, gathering]) => {
      if (cancelled) return;
      setRegions(asList(regionResult, "regions"));
      if (gathering) setTimeout(() => { const form = formRef.current; if (!form || cancelled) return; form.elements.title.value = gathering.title || ""; setRegionValue(gathering.region?.name || gathering.region || ""); form.elements.capacity.value = gathering.capacity || 2; form.elements.meetingPlace.value = gathering.meetingPlace || ""; setStartsAt(toDateTimeLocal(gathering.startsAt)); form.elements.concept.value = gathering.concept || ""; form.elements.description.value = gathering.description || ""; }, 0);
      setMessage(editing ? "게더링 정보를 불러왔습니다." : "");
    }).catch((requestError) => { if (!cancelled) { setError(true); setMessage(requestError.message); } }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [editing, id, navigate]);
  function openSchedulePicker() {
    const [datePart, timePart] = String(startsAt || "").split("T");
    const base = datePart ? new Date(`${datePart}T00:00:00`) : new Date();
    setDraftDate(datePart || dateKey(base));
    setDraftTime(timePart || "18:00");
    setCalendarCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    setRegionOpen(false);
    setScheduleOpen(true);
  }
  async function submit(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const selectedRegion = event.currentTarget.elements.region.value;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (!selectedRegion || !body.startsAt) { setError(true); setMessage("지역과 날짜·시간을 선택해 주세요."); return; }
    if (editing) delete body.region;
    body.capacity = Number(body.capacity);
    body.startsAt = toKoreaOffsetDateTime(body.startsAt);
    if (new Date(body.startsAt).getTime() <= Date.now()) {
      setError(true); setMessage("날짜와 시간은 현재보다 미래여야 합니다."); return;
    }
    try { setBusy(true); setError(false); setMessage(editing ? "게더링을 수정하는 중입니다." : "게더링을 만드는 중입니다."); await apiRequest(authApiUrl(editing ? `/gatherings/${id}` : "/gatherings"), { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) }); const date = body.startsAt.slice(0, 10); navigate("/gatherings", { state: { region: selectedRegion, startsOn: date, endsOn: date } }); }
    catch (e) { setError(true); setMessage(e.message); setBusy(false); }
  }
  return <main className="feature-page-main gathering-write-main gathering-write-experience"><section className="page-intro gathering-write-hero"><div><p className="eyebrow dark">{editing ? "EDIT A GATHERING" : "CREATE A GATHERING"}</p><h1>{editing ? "게더링 정보를 수정해보세요" : "함께할 여행자를 초대해요"}</h1><span>{editing ? "일정과 모임 정보를 확인하고 필요한 내용을 바꿔보세요." : "모임의 분위기와 일정을 알려주면 같은 취향의 여행자가 찾아올 거예요."}</span></div><div className="page-intro-actions">{editing ? <button className="button" type="button" onClick={() => setExitOpen(true)}>목록으로 돌아가기</button> : <Link className="button" to="/gatherings">목록으로 돌아가기</Link>}</div></section><section className="page-panel gathering-write-panel gathering-write-card"><form className="stack-form" ref={formRef} onSubmit={submit}><label>모임 이름<input name="title" maxLength="150" placeholder="예: 여수 밤바다 펍투어" required /></label><div className="form-row"><label className="gathering-write-picker-card">지역<input type="hidden" name="region" value={regionValue} /><button className="gathering-write-picker-trigger" type="button" disabled={editing} aria-expanded={regionOpen} onClick={() => { setRegionOpen((open) => !open); setScheduleOpen(false); }}><span>{regionValue || "지역을 선택해 주세요"}</span><i /></button>{regionOpen && <div className="gathering-write-option-cards" role="listbox">{regions.map((item) => <button className={regionValue === item.name ? "is-selected" : ""} type="button" role="option" aria-selected={regionValue === item.name} key={item.regionId || item.id || item.name} onClick={() => { setRegionValue(item.name); setRegionOpen(false); }}><span>{item.name}</span><b>✓</b></button>)}</div>}{editing && <small>게더링 지역은 생성 후 변경할 수 없습니다.</small>}</label><label>정원<input name="capacity" type="number" min="2" max="100" defaultValue="4" required /></label></div><label>만날 장소<input name="meetingPlace" maxLength="255" placeholder="예: 여수역 1번 출구 앞" required /></label><div className="form-row"><label className="gathering-write-picker-card">날짜와 시간<input type="hidden" name="startsAt" value={startsAt} /><button className="gathering-write-picker-trigger" type="button" onClick={openSchedulePicker}><span>{startsAt ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(startsAt)) : "날짜와 시간을 선택해 주세요"}</span><i /></button></label><label>콘셉트<input name="concept" maxLength="100" placeholder="예: 펍투어, 미식, 전시, 산책" required /></label></div><label>모임 설명<textarea name="description" rows="5" placeholder="어떤 모임인지, 무엇을 함께 하는지, 준비물이나 참고 사항을 알려주세요." required /></label><div className="community-write-actions">{editing && <button className="button" type="button" disabled={busy} onClick={() => setExitOpen(true)}>취소하기</button>}<button className="button button-primary" type="submit" disabled={busy}>{editing ? "수정 완료" : "게더링 만들기"}</button></div><div className={`page-status${message ? " is-visible" : ""}${error ? " is-error" : ""}`} role="status">{message}</div></form></section>{scheduleOpen && <div className="gathering-write-schedule-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleOpen(false); }}><section className="gathering-write-schedule-card" role="dialog" aria-modal="true" aria-labelledby="write-schedule-title"><header><div><span>SCHEDULE</span><h2 id="write-schedule-title">날짜와 시간을 선택하세요</h2></div><button type="button" aria-label="닫기" onClick={() => setScheduleOpen(false)}>×</button></header><div className="gathering-write-month-nav"><button type="button" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>‹</button><strong>{calendarCursor.getFullYear()}.{String(calendarCursor.getMonth() + 1).padStart(2, "0")}</strong><button type="button" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>›</button></div><WriteCalendar cursor={calendarCursor} selectedDate={draftDate} onSelect={setDraftDate} /><div className="gathering-write-time-cards"><strong>시간 선택 <small>30분 단위</small></strong>{writeTimeGroups.map(([period, values]) => <section className="gathering-write-time-group" key={period}><h3>{period}</h3><div>{values.map((value) => <button className={draftTime === value ? "is-selected" : ""} type="button" key={value} onClick={() => setDraftTime(value)}>{value}</button>)}</div></section>)}</div><footer><button type="button" onClick={() => setScheduleOpen(false)}>취소</button><button type="button" disabled={!draftDate || !draftTime} onClick={() => { setStartsAt(`${draftDate}T${draftTime}`); setScheduleOpen(false); }}>선택 완료</button></footer></section></div>}{editing && exitOpen && <div className="community-exit-modal"><button className="community-exit-backdrop" type="button" aria-label="수정 취소 안내 닫기" onClick={() => setExitOpen(false)} /><section className="community-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="gathering-exit-title"><span>게더링 수정 중</span><h2 id="gathering-exit-title">수정을 취소할까요?</h2><p>변경한 내용은 저장되지 않고 게더링 목록으로 돌아갑니다.</p><div><button className="button" type="button" onClick={() => setExitOpen(false)}>계속 수정</button><button className="button button-primary" type="button" onClick={() => navigate("/gatherings")}>수정 취소</button></div></section></div>}</main>;
}
