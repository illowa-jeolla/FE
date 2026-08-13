import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { EmptyCard, FormMessage, PageIntro, Status } from "../components/UI";
import { asList, useApi } from "../hooks/useApi";

function formatDate(value) {
  if (!value) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function MyGatheringsPage() {
  const signedIn = hasSession();
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const { data, loading, error, run } = useApi(signedIn ? "/api/gatherings?mine=true&includePast=true" : "", { immediate: signedIn });
  const gatherings = asList(data, "gatherings");

  if (!signedIn) {
    return (
      <main className="page-shell-react">
        <EmptyCard
          title="로그인이 필요합니다"
          description="내가 만든 게더링은 로그인 후 확인하고 관리할 수 있어요."
          action={<Link className="primary-action-react" to="/auth">로그인</Link>}
        />
      </main>
    );
  }

  async function toggleConfirmed(item) {
    try {
      setMessageError(false);
      const result = await apiRequest(`/api/gatherings/${item.id}/confirm`, { method: "PATCH" });
      setMessage(result.message);
      await run();
    } catch (requestError) {
      setMessageError(true);
      setMessage(requestError.message);
    }
  }

  async function cancelGathering(item) {
    if (!window.confirm(`'${item.title}' 게더링을 취소할까요?`)) return;
    try {
      setMessageError(false);
      const result = await apiRequest(`/api/gatherings/${item.id}`, { method: "DELETE" });
      setMessage(result.message);
      await run();
    } catch (requestError) {
      setMessageError(true);
      setMessage(requestError.message);
    }
  }

  const introActions = (
    <div className="page-intro-actions-react">
      <Link className="secondary-action-react" to="/gatherings">전체 게더링</Link>
      <Link className="primary-action-react" to="/gatherings/write">새 게더링 만들기 +</Link>
    </div>
  );

  return (
    <main className="page-shell-react">
      <PageIntro
        eyebrow="MY GATHERINGS"
        title="내가 만든 게더링"
        description="직접 만든 게더링의 일정과 참여 현황을 확인하고 모집 상태를 관리하세요."
        action={introActions}
      />
      <FormMessage message={message} error={messageError} />
      <div className="section-row-react"><div><span>CREATED BY ME</span><h2>내 게더링 관리</h2></div><b>{gatherings.length}</b></div>
      <Status loading={loading} error={error} empty={!gatherings.length}>
        <div className="gathering-grid-react">
          {gatherings.map((item) => {
            const past = new Date(item.event_time).getTime() < Date.now();
            return (
              <article className="gathering-card-react is-owned gathering-manage-card-react" key={item.id}>
                <div className="card-label-row">
                  <span>{item.region} · {item.concept || "자유 모임"}</span>
                  <b>{past ? "종료" : item.confirmed ? "모집 확정" : "모집 중"}</b>
                </div>
                <h3>{item.title}</h3>
                <p>{item.location}</p>
                <time>{formatDate(item.event_time)}</time>
                <div className="gathering-participants-react">
                  <strong>{item.participant_count || 0}/{item.capacity}명 참여</strong>
                  <span>{item.participants?.length ? item.participants.join(", ") : "아직 참여자가 없어요"}</span>
                </div>
                <footer>
                  <button className="secondary-action-react" type="button" disabled={past} onClick={() => toggleConfirmed(item)}>
                    {item.confirmed ? "확정 해제" : "모집 확정"}
                  </button>
                  <button className="danger-action-react" type="button" onClick={() => cancelGathering(item)}>모임 취소</button>
                </footer>
              </article>
            );
          })}
        </div>
      </Status>
    </main>
  );
}
