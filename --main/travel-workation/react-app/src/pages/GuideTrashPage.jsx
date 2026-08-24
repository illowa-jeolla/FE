import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { EmptyCard, FormMessage, PageIntro, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

export default function GuideTrashPage() {
  const [message, setMessage] = useState("");
  const { data, loading, error, run } = useApi(hasSession() ? "/api/me/guides/trash" : "", { immediate: hasSession() });

  if (!hasSession()) return <main className="page-shell-react"><EmptyCard title="로그인이 필요합니다" description="여행 가이드 휴지통은 로그인 후 확인할 수 있어요." action={<Link className="primary-action-react" to="/auth">로그인</Link>} /></main>;

  async function restore(id) {
    try {
      await apiRequest(`/api/me/guides/${id}/restore`, { method: "PATCH" });
      setMessage("여행 가이드를 복원했습니다.");
      await run();
    } catch (requestError) { setMessage(requestError.message); }
  }

  async function removePermanently(id) {
    if (!window.confirm("이 가이드를 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) return;
    try {
      await apiRequest(`/api/me/guides/${id}/permanent`, { method: "DELETE" });
      setMessage("여행 가이드를 영구 삭제했습니다.");
      await run();
    } catch (requestError) { setMessage(requestError.message); }
  }

  const guides = data?.guides || [];
  return <main className="page-shell-react guide-trash-page-react">
    <PageIntro eyebrow="GUIDE TRASH" title="여행 가이드 휴지통" description="삭제한 코스를 복원하거나 영구 삭제할 수 있어요." action={<Link className="secondary-action-react" to="/mypage">마이페이지로 돌아가기</Link>} />
    <FormMessage message={message} />
    <Status loading={loading} error={error} empty={!data}>{guides.length ? <div className="mypage-list-react">{guides.map((item) => <article className="dashboard-card-react" key={item.id}>
      <span>{item.region} · DELETED GUIDE</span>
      <h3>{item.title}</h3>
      <p>{item.hotel || "추천 출발지"} · {item.guide?.spots?.length || 0}곳 코스</p>
      <small>삭제일 {item.deletedAt?.slice?.(0, 10)}</small>
      <div className="dashboard-card-actions-react"><button type="button" onClick={() => restore(item.id)}>복원</button><button className="danger-action-react" type="button" onClick={() => removePermanently(item.id)}>영구 삭제</button></div>
    </article>)}</div> : <EmptyCard title="휴지통이 비어 있어요" description="삭제한 여행 가이드가 이곳에 모입니다." />}</Status>
  </main>;
}
