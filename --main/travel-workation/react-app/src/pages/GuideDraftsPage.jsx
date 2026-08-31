import { Link } from "react-router-dom";
import { hasSession } from "../auth/session";
import { EmptyCard, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

export default function GuideDraftsPage() {
  const { data, loading, error } = useApi(hasSession() ? "/api/v1/travel-guides/drafts" : "", { immediate: hasSession() });
  if (!hasSession()) return <main className="mypage-main"><section className="page-panel"><EmptyCard title="로그인이 필요합니다" description="임시 여행 일정은 로그인 후 확인할 수 있어요." action={<Link className="button button-primary" to="/auth">로그인</Link>} /></section></main>;
  const drafts = Array.isArray(data) ? data : [];
  return <main className="mypage-main"><section className="page-intro"><div><p className="eyebrow dark">TRAVEL DRAFTS</p><h1>임시 여행 일정</h1><p>저장 전 일정은 생성 후 24시간 동안 보관됩니다.</p></div><div className="page-intro-actions"><Link className="button" to="/mypage?tab=guides">저장한 가이드</Link></div></section><Status loading={loading} error={error} empty={false}>{drafts.length ? <div className="mypage-card-list">{drafts.map((draft) => <Link className="mypage-guide-card" to={`/travel-guide/draft/${draft.draftId}`} key={draft.draftId}><div className="mypage-guide-copy"><span>DRAFT · {draft.regionName}</span><h3>{draft.title}</h3><p>{draft.generatedByAi ? "AI 추천 일정" : "직접 구성한 일정"}</p><div className="mypage-guide-summary"><b>{draft.startsOn} — {draft.endsOn}</b><b>24시간 보관</b></div></div></Link>)}</div> : <EmptyCard title="임시 여행 일정이 없어요" description="추천받거나 직접 만든 일정이 이곳에 표시됩니다." />}</Status></main>;
}
