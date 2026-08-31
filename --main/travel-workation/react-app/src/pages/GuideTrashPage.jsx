import { useState } from "react";
import { Link } from "react-router-dom";
import { hasSession } from "../auth/session";
import { EmptyCard, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";
import { restoreSavedTravelGuide } from "../api/travelRecommendations";

export default function GuideTrashPage() {
  const [message, setMessage] = useState("");
  const { data, loading, error, run } = useApi(hasSession() ? "/api/v1/travel-guides/saved/deleted" : "", { immediate: hasSession() });
  if (!hasSession()) return <main className="mypage-main"><section className="page-panel"><EmptyCard title="로그인이 필요합니다" description="여행 가이드 휴지통은 로그인 후 확인할 수 있어요." action={<Link className="button button-primary" to="/auth">로그인</Link>} /></section></main>;

  const guides = Array.isArray(data) ? data : [];
  async function restore(guideId) {
    try { await restoreSavedTravelGuide(guideId); setMessage("여행 가이드를 복원했습니다."); await run(); }
    catch (requestError) { setMessage(requestError.message); }
  }

  return <main className="mypage-main"><section className="page-intro"><div><p className="eyebrow dark">GUIDE TRASH</p><h1>여행 가이드 휴지통</h1></div><div className="page-intro-actions"><Link className="button" to="/mypage?tab=guides">마이페이지로 돌아가기</Link></div></section>
    {message && <div className="page-status is-visible">{message}</div>}
    <Status loading={loading} error={error} empty={false}>{guides.length ? <div className="mypage-card-list">{guides.map((item) => <article className="mypage-guide-card" key={item.guideId}><div className="mypage-guide-copy"><span>DELETED GUIDE · {item.regionName}</span><h3>{item.title}</h3><p>{item.summary || "저장 취소한 여행 일정"}</p><div className="mypage-guide-summary"><b>{item.startsOn} — {item.endsOn}</b><b>삭제일 {item.deletedAt?.slice?.(0, 10)}</b></div><div className="mypage-guide-actions"><button type="button" onClick={() => restore(item.guideId)}>복원</button></div></div></article>)}</div> : <EmptyCard title="휴지통이 비어 있어요" description="저장 취소한 여행 가이드가 이곳에 모입니다." />}</Status>
  </main>;
}
