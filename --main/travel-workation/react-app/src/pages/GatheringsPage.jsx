import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, Modal, PageIntro, Status } from "../components/UI";
import { regions } from "../data/regions";
import { asList, useApi } from "../hooks/useApi";

function formatDate(value) {
  if (!value) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function GatheringCard({ gathering, onOpen, onAction }) {
  const full = Number(gathering.participant_count) >= Number(gathering.capacity);
  return <article className={`gathering-card-react${gathering.owned ? " is-owned" : ""}`} onClick={() => onOpen(gathering)}><div className="card-label-row"><span>{gathering.region} · {gathering.concept || "자유 모임"}</span>{gathering.owned && <b>내 모임</b>}</div><h3>{gathering.title}</h3><p>{gathering.location}</p><time>{formatDate(gathering.event_time)}</time><footer><span>{gathering.participant_count || 0}/{gathering.capacity}명</span><button disabled={full || gathering.confirmed} onClick={(e) => { e.stopPropagation(); onAction(gathering); }}>{gathering.joined ? "참여 취소" : gathering.confirmed ? "모집 확정" : full ? "정원 마감" : "참여하기"}</button></footer></article>;
}

export default function GatheringsPage() {
  const [region, setRegion] = useState("전체");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const { data, loading, error, run } = useApi("/api/gatherings");
  const gatherings = asList(data, "gatherings");

  function gatheringQuery(nextRegion = region, nextLocation = location, nextStart = startDate, nextEnd = endDate) {
    const params = new URLSearchParams();
    if (nextRegion !== "전체") params.set("region", nextRegion);
    if (nextLocation.trim()) params.set("location", nextLocation.trim());
    if (nextStart) params.set("startDate", nextStart);
    if (nextEnd) params.set("endDate", nextEnd);
    const query = params.toString();
    return `/api/gatherings${query ? `?${query}` : ""}`;
  }

  async function search(event) {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) { setMessage("종료일은 시작일보다 빠를 수 없습니다."); return; }
    setMessage("");
    await run(gatheringQuery()).catch(() => {});
  }

  async function resetFilters() {
    setRegion("전체"); setLocation(""); setStartDate(""); setEndDate(""); setMessage("");
    await run("/api/gatherings").catch(() => {});
  }

  async function action(item) {
    if (!hasSession()) { setMessage("로그인 후 참여할 수 있어요."); return; }
    try { await apiRequest(`/api/gatherings/${item.id}/join`, { method: item.joined ? "DELETE" : "POST" }); setMessage(item.joined ? "참여를 취소했습니다." : "게더링에 참여했습니다."); await run(gatheringQuery()); setSelected(null); }
    catch (e) { setMessage(e.message); }
  }

  return <main className="page-shell-react"><PageIntro eyebrow="LOCAL GATHERINGS" title="지금 같은 지역의 여행자를 만나요" description="가벼운 산책, 미식, 전시 모임을 만들고 참여해보세요." action={<Link className="primary-action-react" to="/gatherings/write">게더링 만들기 +</Link>} /><form className="filter-bar-react gathering-filter-react" onSubmit={search}><label>지역<select value={region} onChange={(e) => setRegion(e.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label><label>장소<input type="search" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="장소명 입력" /></label><label>시작일<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label>종료일<input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></label><button className="primary-action-react" type="submit">조건 검색</button><button className="secondary-action-react" type="button" onClick={resetFilters}>초기화</button></form><p className="gathering-filter-note-react">지역, 장소와 시작일·종료일을 기준으로 게더링을 조회합니다.</p><FormMessage message={message} /><div className="section-row-react"><div><span>OPEN GATHERINGS</span><h2>참여 가능한 게더링</h2></div><b>{gatherings.length}</b></div><Status loading={loading} error={error} empty={!gatherings.length}><div className="gathering-grid-react">{gatherings.map((item) => <GatheringCard key={item.id} gathering={item} onOpen={setSelected} onAction={action} />)}</div></Status><Modal open={Boolean(selected)} title={selected?.title || "게더링 상세"} onClose={() => setSelected(null)} actions={selected && <button className="primary-action-react" onClick={() => action(selected)}>{selected.joined ? "참여 취소" : "참여하기"}</button>}><p>{selected?.description || "함께 지역을 경험하는 가벼운 모임입니다."}</p><dl className="modal-info-react"><div><dt>일정</dt><dd>{formatDate(selected?.event_time)}</dd></div><div><dt>장소</dt><dd>{selected?.location}</dd></div><div><dt>인원</dt><dd>{selected?.participant_count || 0}/{selected?.capacity}명</dd></div><div><dt>만든 사람</dt><dd>{selected?.nickname || selected?.username || "여행자"}</dd></div></dl></Modal></main>;
}
