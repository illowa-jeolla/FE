import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, Modal, PageIntro, Status } from "../components/UI";
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

function GatheringCard({ gathering, onOpen, onAction }) {
  const full = Number(gathering.participant_count) >= Number(gathering.capacity);
  const actionDisabled = gathering.owned || full || gathering.confirmed;
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
    <article className={`gathering-card-react${gathering.owned ? " is-owned" : ""}`} onClick={() => onOpen(gathering)}>
      <div className="card-label-row">
        <span>{gathering.region} · {gathering.concept || "자유 모임"}</span>
        {gathering.owned && <b>내 모임</b>}
      </div>
      <h3>{gathering.title}</h3>
      <p>{gathering.location}</p>
      <time>{formatDate(gathering.event_time)}</time>
      <footer>
        <span>{gathering.participant_count || 0}/{gathering.capacity}명</span>
        <button disabled={actionDisabled} onClick={(event) => { event.stopPropagation(); onAction(gathering); }}>
          {actionLabel}
        </button>
      </footer>
    </article>
  );
}

export default function GatheringsPage() {
  const [region, setRegion] = useState("전체");
  const [location, setLocation] = useState("");
  const [concept, setConcept] = useState("");
  const [time, setTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const { data, loading, error, run } = useApi("/api/gatherings");
  const gatherings = asList(data, "gatherings");

  function gatheringQuery() {
    const params = new URLSearchParams();
    if (region !== "전체") params.set("region", region);
    if (location.trim()) params.set("location", location.trim());
    if (concept.trim()) params.set("concept", concept.trim());
    if (time) params.set("time", time);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString();
    return `/api/gatherings${query ? `?${query}` : ""}`;
  }

  async function search(event) {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      setMessage("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    setMessage("");
    await run(gatheringQuery()).catch(() => {});
  }

  async function resetFilters() {
    setRegion("전체");
    setLocation("");
    setConcept("");
    setTime("");
    setStartDate("");
    setEndDate("");
    setMessage("");
    await run("/api/gatherings").catch(() => {});
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
      await apiRequest(`/api/gatherings/${item.id}/join`, { method: item.joined ? "DELETE" : "POST" });
      setMessage(item.joined ? "참여를 취소했습니다." : "게더링에 참여했습니다.");
      await run(gatheringQuery());
      setSelected(null);
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  const introActions = (
    <div className="page-intro-actions-react">
      {hasSession() && <Link className="secondary-action-react" to="/gatherings/mine">내가 만든 게더링</Link>}
      <Link className="primary-action-react" to="/gatherings/write">게더링 만들기 +</Link>
    </div>
  );

  return (
    <main className="page-shell-react">
      <PageIntro
        eyebrow="LOCAL GATHERINGS"
        title="지금 같은 지역의 여행자를 만나요"
        description="가벼운 산책, 미식, 전시 모임을 만들고 참여해보세요."
        action={introActions}
      />
      <form className="filter-bar-react gathering-filter-react" onSubmit={search}>
        <label>지역<select value={region} onChange={(event) => setRegion(event.target.value)}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>장소<input type="search" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="장소명 입력" /></label>
        <label>컨셉<input type="search" value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="산책, 미식, 전시" /></label>
        <label>시작 시간<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        <label>시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>종료일<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
        <div className="gathering-filter-actions-react">
          <button className="primary-action-react" type="submit">조건 검색</button>
          <button className="secondary-action-react" type="button" onClick={resetFilters}>초기화</button>
        </div>
      </form>
      <p className="gathering-filter-note-react">지역, 장소, 컨셉, 날짜와 시작 시간을 기준으로 게더링을 조회합니다.</p>
      <FormMessage message={message} />
      <div className="section-row-react"><div><span>OPEN GATHERINGS</span><h2>참여 가능한 게더링</h2></div><b>{gatherings.length}</b></div>
      <Status loading={loading} error={error} empty={!gatherings.length}>
        <div className="gathering-grid-react">
          {gatherings.map((item) => <GatheringCard key={item.id} gathering={item} onOpen={setSelected} onAction={action} />)}
        </div>
      </Status>
      <Modal
        open={Boolean(selected)}
        title={selected?.title || "게더링 상세"}
        onClose={() => setSelected(null)}
        actions={selected && !selected.owned && <button className="primary-action-react" onClick={() => action(selected)}>{selected.joined ? "참여 취소" : "참여하기"}</button>}
      >
        <p>{selected?.description || "함께 지역을 경험하는 가벼운 모임입니다."}</p>
        <dl className="modal-info-react">
          <div><dt>일정</dt><dd>{formatDate(selected?.event_time)}</dd></div>
          <div><dt>장소</dt><dd>{selected?.location}</dd></div>
          <div><dt>인원</dt><dd>{selected?.participant_count || 0}/{selected?.capacity}명</dd></div>
          <div><dt>만든 사람</dt><dd>{selected?.nickname || selected?.username || "여행자"}</dd></div>
        </dl>
      </Modal>
    </main>
  );
}
