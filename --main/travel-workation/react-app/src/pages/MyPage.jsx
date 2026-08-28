import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logoutFromBackend } from "../api/client";
import { clearSession, getSessionUser, hasSession } from "../auth/session";
import { useApi } from "../hooks/useApi";
import { EmptyCard, FormMessage, Status } from "../components/UI";

const tabs = [["profile", "내 정보"], ["trips", "내가 다닌 여행지"], ["guides", "저장한 여행 가이드"], ["posts", "내 여행 공유"], ["applications", "내가 지원한 공고"], ["favoriteJobs", "찜한 일자리"], ["gatherings", "내 게더링"]];

function PendingApi({ title }) {
  return <div className="mypage-empty"><strong>{title} API 명세 대기</strong><p>백엔드 명세를 받는 대로 실제 데이터와 연결됩니다.</p></div>;
}

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => tabs.some(([key]) => key === searchParams.get("tab")) ? searchParams.get("tab") : "profile");
  const [message, setMessage] = useState("");
  const { data: savedGuideData, loading, error } = useApi(hasSession() ? "/api/v1/travel-guides/saved" : "", { immediate: hasSession() });

  if (!hasSession()) return <main className="mypage-main"><section className="page-panel"><EmptyCard title="로그인이 필요합니다" description="내 여행과 지원 내역은 로그인 후 확인할 수 있어요." action={<Link className="button button-primary" to="/auth">로그인</Link>} /></section></main>;

  const user = getSessionUser();
  const displayName = user.name || user.email.split("@")[0] || "여행자";
  const savedGuides = Array.isArray(savedGuideData) ? savedGuideData : [];

  async function logout() {
    try { setMessage("로그아웃 중입니다."); await logoutFromBackend(); clearSession(); navigate("/"); }
    catch (requestError) { setMessage(requestError.message); }
  }

  return <main className="mypage-main"><Status loading={loading} error={error} empty={false}>
    <section className="mypage-profile-card"><div className="mypage-avatar">{displayName.slice(0, 1)}</div><div className="mypage-profile-copy"><span>MY PAGE</span><h1>{displayName}님의 기록</h1><p>{user.email}</p></div><div className="mypage-profile-actions"><button onClick={logout}>로그아웃</button></div></section>
    <FormMessage message={message} />
    <section className="mypage-layout"><nav className="mypage-tabs">{tabs.map(([key, label], index) => <button className={tab === key ? "is-active" : ""} onClick={() => setTab(key)} key={key}><span>{String(index + 1).padStart(2, "0")}</span>{label}{key === "guides" && <b>{savedGuides.length}</b>}</button>)}</nav><div className="mypage-panels"><section className="mypage-panel is-active">
      {tab === "profile" && <><span className="mypage-kicker">PROFILE</span><h2>내 정보</h2><p>로그인한 계정 정보를 표시하고 있습니다.</p><div className="mypage-empty"><strong>{user.email}</strong><p>닉네임 수정과 회원 탈퇴는 사용자 정보 API 명세를 받은 뒤 연결됩니다.</p></div></>}
      {tab === "guides" && <><span className="mypage-kicker">SAVED GUIDES</span><h2>내가 저장한 여행 가이드</h2><Link className="button" to="/mypage/drafts">임시 일정 보기</Link>{savedGuides.length ? <div className="mypage-card-list">{savedGuides.map((guide) => <Link className="mypage-guide-card" to={`/travel-guide/${guide.guideId}`} key={guide.guideId}><div className="mypage-guide-copy"><span>SAVED GUIDE · {guide.regionName}</span><h3>{guide.title}</h3><p>{guide.summary || "저장한 여행 일정"}</p><div className="mypage-guide-summary"><b>{guide.startsOn} — {guide.endsOn}</b><b>{guide.generatedByAi ? "AI 추천" : "직접 구성"}</b></div></div></Link>)}</div> : <div className="mypage-empty"><strong>저장한 여행 가이드가 없어요</strong><p>여행 가이드를 저장하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "trips" && <PendingApi title="여행 기록" />}
      {tab === "posts" && <PendingApi title="여행 공유" />}
      {tab === "applications" && <PendingApi title="지원 공고" />}
      {tab === "favoriteJobs" && <PendingApi title="찜한 일자리" />}
      {tab === "gatherings" && <PendingApi title="내 게더링" />}
    </section></div></section>
  </Status></main>;
}
