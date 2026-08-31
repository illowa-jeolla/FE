import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { authApiUrl } from "../config";
import { FormMessage, Status } from "../components/UI";
import { regions } from "../data/regions";
import { asList, useApi } from "../hooks/useApi";

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

function normalizeGathering(item) {
  return {
    ...item,
    region: item.region?.name || item.region || "",
    location: item.meetingPlace,
    event_time: item.startsAt,
    participant_count: item.participantCount,
    nickname: item.creator?.nickname,
    username: item.creator?.nickname,
    owned: Boolean(item.host) || String(item.creator?.id ?? "") === String(sessionStorage.getItem("userId") || ""),
    confirmed: item.status && item.status !== "OPEN"
  };
}

function GatheringCard({ gathering, onOpen, onAction }) {
  const full = Number(gathering.participant_count) >= Number(gathering.capacity);
  const actionDisabled = gathering.owned || (!gathering.joined && (full || gathering.confirmed));
  const actionLabel = gathering.owned
    ? "내가 만든 모임"
    : gathering.joined
      ? "참여 취소"
      : gathering.confirmed
        ? "모집 확정"
        : full
          ? "정원 마감"
          : "참여하기";

  return (
    <article className={`gathering-item gathering-item-compact${gathering.owned ? " is-owned" : ""}${gathering.joined ? " is-joined" : ""}`} onClick={() => onOpen(gathering)}>
      <div className="gathering-head"><div><h3>{gathering.title}</h3><p className="gathering-card-location">{gathering.location || `${gathering.region} 모임 장소`}</p></div><div className="gathering-card-schedule"><time>{formatDate(gathering.event_time)}</time><strong>{gathering.participant_count || 0}/{gathering.capacity}명</strong><small>{gathering.confirmed ? "모집 확정" : `${Math.max(0, Number(gathering.capacity) - Number(gathering.participant_count || 0))}자리 남음`}</small></div></div>
      <footer>
        <span className="gathering-footer-concept">{gathering.concept || "자유 모임"}</span>
        <button className={`button join-button${gathering.joined ? " is-leave" : ""}`} disabled={actionDisabled} onClick={(event) => { event.stopPropagation(); onAction(gathering); }}>
          {actionLabel}
        </button>
      </footer>
    </article>
  );
}

export default function GatheringsPage() {
  const initialStartDate = localDate();
  const initialEndDate = localDate(365);
  const [region, setRegion] = useState("전체");
  const [concept, setConcept] = useState("");
  const [time, setTime] = useState("");
  const [startDate, setStartDate] = useState(initialStartDate);
  const [dateScope, setDateScope] = useState("single");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const initialQuery = authApiUrl(`/gatherings?region=${encodeURIComponent("전체")}&startsOn=${initialStartDate}&endsOn=${initialEndDate}&page=0&size=20`);
  const { data, loading, error, run } = useApi(initialQuery);
  const gatherings = asList(data, "content").map(normalizeGathering);

  function gatheringQuery() {
    const params = new URLSearchParams();
    params.set("region", region);
    params.set("startsOn", startDate);
    params.set("endsOn", dateScope === "single" ? startDate : initialEndDate);
    if (concept.trim()) params.set("concept", concept.trim());
    if (time) params.set("time", time);
    params.set("page", "0");
    params.set("size", "20");
    return authApiUrl(`/gatherings?${params}`);
  }

  async function search(event) {
    event.preventDefault();
    if (!region || !startDate) {
      setMessage("지역과 날짜를 입력해 주세요.");
      return;
    }
    setMessage("");
    await run(gatheringQuery()).catch(() => {});
  }

  async function resetFilters() {
    setRegion("전체");
    setConcept("");
    setTime("");
    setStartDate(initialStartDate);
    setDateScope("single");
    setMessage("");
    await run(initialQuery).catch(() => {});
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
      const endpoint = authApiUrl(`/gatherings/${item.id}/join`);
      await apiRequest(endpoint, { method: item.joined ? "DELETE" : "POST" });
      setMessage(item.joined ? "참여를 취소했습니다." : "게더링에 참여했습니다.");
      await run(gatheringQuery());
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
      if (detail.joined || detail.host) {
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

  const introActions = (
    <div className="page-intro-actions">
      {hasSession() && <Link className="button" to="/gatherings/mine">내 게더링</Link>}
      <Link className="button button-primary" to="/gatherings/write">게더링 만들기 +</Link>
    </div>
  );

  return (
    <main className="feature-page-main gatherings-page-main">
      <section className="page-intro"><div><p className="eyebrow dark">즉석 게더링</p><h1>지금 같은 지역의 여행자를 만나요</h1></div>{introActions}</section>
      <div className="page-workspace gatherings-search-layout"><section className="page-panel gathering-search-panel"><p className="eyebrow dark">FIND A GATHERING</p><h2>게더링 조건 검색</h2><form className="stack-form" onSubmit={search}>
        <label>지역<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item === "전체" ? "전체 지역" : item}</option>)}</select></label>
        <div className="gathering-date-time"><label>날짜<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label>시간<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div>
        <fieldset className="gathering-date-scope"><legend>날짜 검색 범위</legend><label><input type="radio" name="date-scope" checked={dateScope === "single"} onChange={() => setDateScope("single")} /><span>선택한 날만</span></label><label><input type="radio" name="date-scope" checked={dateScope === "after"} onChange={() => setDateScope("after")} /><span>선택한 날 이후 전체</span></label></fieldset>
        <label>콘셉트<input type="search" value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="필수어, 미식, 전시, 산책" /></label>
        <button className="button button-primary" type="submit">조건으로 검색하기</button>
        <button className="button" type="button" onClick={resetFilters}>전체 게더링 보기</button>
      </form><FormMessage message={message} /></section><section className="page-panel"><div className="gathering-results-head"><div><p className="eyebrow dark">OPEN GATHERINGS</p><h2>참여 가능한 게더링</h2></div><strong>{gatherings.length}</strong></div>
      <Status loading={loading} error={error} empty={!gatherings.length}>
        <div className="gathering-list">
          {gatherings.map((item) => <GatheringCard key={item.id} gathering={item} onOpen={openDetails} onAction={action} />)}
        </div>
      </Status></section></div>
      {selected && <div className="gathering-detail-modal"><button className="gathering-detail-backdrop" type="button" aria-label="게더링 상세 창 닫기" onClick={() => setSelected(null)} /><section className="gathering-detail-dialog" role="dialog" aria-modal="true"><button className="gathering-detail-close" type="button" aria-label="닫기" onClick={() => setSelected(null)}>×</button><div><p className="eyebrow dark">GATHERING DETAIL</p><time>{formatDate(selected.event_time)}</time><h2>{selected.title}</h2><p className="gathering-detail-description">{selected.description || "함께 지역을 경험하는 가벼운 모임입니다."}</p><dl className="gathering-detail-info"><div><dt>지역</dt><dd>{selected.region}</dd></div><div><dt>장소</dt><dd>{selected.location}</dd></div><div><dt>참여 인원</dt><dd>{selected.participant_count || 0}/{selected.capacity}명</dd></div><div><dt>올린 사람</dt><dd>{selected.nickname || selected.username || "여행자"}</dd></div></dl>{selected.participants?.length > 0 && <section className="gathering-detail-participants"><strong>참여한 사람</strong><div>{selected.participants.map((participant) => <span key={participant.userId || participant.nickname}>{participant.nickname}{participant.role === "HOST" ? " · 방장" : ""}</span>)}</div></section>}{!selected.owned && <button className="button button-primary" onClick={() => action(selected)}>{selected.joined ? "참여 취소" : "참여하기"}</button>}</div></section></div>}
    </main>
  );
}
