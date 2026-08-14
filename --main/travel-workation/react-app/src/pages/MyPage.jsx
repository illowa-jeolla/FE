import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { clearSession, hasSession } from "../auth/session";
import { useApi } from "../hooks/useApi";
import { EmptyCard, FormMessage, Status } from "../components/UI";

const tabs = [
  ["profile", "내 정보"], ["trips", "내가 다닌 여행지"], ["guides", "저장한 여행 가이드"], ["posts", "내 여행 공유"],
  ["applications", "내가 지원한 공고"], ["favoriteJobs", "찜한 일자리"], ["gatherings", "내 게더링"]
];
const jobPhotos = ["/assets/J6aHjc.jpeg", "/assets/JvLTt.jpeg", "/assets/lX3GW.jpeg", "/assets/OZ3bs.jpeg"];

function ItemList({ items, empty, render }) {
  return items?.length ? <div className="mypage-list-react">{items.map(render)}</div> : <EmptyCard title={empty} description="새로운 활동을 시작하면 이곳에서 한 번에 확인할 수 있어요." />;
}

export default function MyPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [message, setMessage] = useState("");
  const { data, loading, error, run } = useApi(hasSession() ? "/api/me" : "", { immediate: hasSession() });
  if (!hasSession()) return <main className="page-shell-react"><EmptyCard title="로그인이 필요합니다" description="내 여행과 지원 내역은 로그인 후 확인할 수 있어요." action={<Link className="primary-action-react" to="/auth">로그인</Link>} /></main>;
  const profile = data?.profile || {};
  const displayName = profile.nickname || profile.email?.split("@")[0] || "여행자";

  async function updateProfile(event) { event.preventDefault(); try { const nickname = new FormData(event.currentTarget).get("nickname"); const next = await apiRequest("/api/me", { method: "PATCH", body: JSON.stringify({ nickname }) }); sessionStorage.setItem("nickname", next.nickname); setMessage("닉네임을 변경했습니다."); await run(); } catch (e) { setMessage(e.message); } }
  function logout() { clearSession(); navigate("/"); window.location.reload(); }
  async function deleteAccount() { if (!window.confirm("계정과 저장된 기록을 모두 삭제할까요?")) return; try { await apiRequest("/api/me", { method: "DELETE" }); clearSession(); navigate("/"); } catch (e) { setMessage(e.message); } }

  return <main className="mypage-react"><Status loading={loading} error={error} empty={!data}>{data && <><header className="mypage-profile-react"><div className="mypage-avatar-react">{displayName.slice(0, 1)}</div><div><span>MY PAGE</span><h1>{displayName}님의 기록</h1><p>{profile.email || profile.username}</p></div><div><button onClick={logout}>로그아웃</button><button className="danger-react" onClick={deleteAccount}>탈퇴하기</button></div></header><FormMessage message={message} /><div className="mypage-layout-react"><nav>{tabs.map(([key, label], index) => <button className={tab === key ? "is-active" : ""} onClick={() => setTab(key)} key={key}><span>{String(index + 1).padStart(2, "0")}</span>{label}{key !== "profile" && <b>{data[key]?.length || 0}</b>}</button>)}</nav><section className="mypage-panel-react">
    {tab === "profile" && <><span className="panel-kicker-react">PROFILE</span><h2>내 정보</h2><p>가입 이메일을 확인하고 서비스에서 사용할 닉네임을 변경할 수 있어요.</p><form className="profile-form-react" onSubmit={updateProfile}><label>이메일<input value={profile.email || profile.username || ""} disabled /></label><label>닉네임<input name="nickname" defaultValue={profile.nickname || displayName} minLength="2" maxLength="20" required /></label><button className="primary-action-react">닉네임 저장</button></form></>}
    {tab === "trips" && <><span className="panel-kicker-react">MY TRIPS</span><h2>내가 다닌 여행지</h2><ItemList items={data.trips} empty="리뷰를 남긴 여행지가 아직 없어요" render={(item) => <article className="dashboard-card-react" key={item.id}><span>{item.region} · ★ {item.rating || 5}</span><h3>{item.destinationName || item.title}</h3><p>{item.note || "여행 리뷰"}</p><small>{item.createdAt?.slice?.(0, 10)}</small></article>} /></>}
    {tab === "guides" && <><span className="panel-kicker-react">SAVED GUIDES</span><h2>저장한 여행 가이드</h2><ItemList items={data.guides} empty="저장한 여행 가이드가 없어요" render={(item) => <article className="dashboard-card-react" key={item.id}><span>{item.region} · SAVED GUIDE</span><h3>{item.title}</h3><p>{item.hotel || "추천 출발지"} · {item.guide?.spots?.length || 0}곳 코스</p><div className="dashboard-card-actions-react"><Link to="/travel-guide" state={item.guide?.conditions || item.guide}>가이드 보기</Link><button onClick={async () => { await apiRequest(`/api/me/guides/${item.id}`, { method: "DELETE" }); setMessage("가이드를 삭제했습니다."); run(); }}>삭제</button></div></article>} /></>}
    {tab === "posts" && <><span className="panel-kicker-react">MY STORIES</span><h2>내 여행 공유</h2><ItemList items={data.posts} empty="공유한 여행 이야기가 없어요" render={(item) => <Link className="dashboard-card-react" to={`/community/${item.id}`} key={item.id}><span>{item.region}</span><h3>{item.concept}</h3><p>{item.content}</p><strong>이야기 보기 →</strong></Link>} /></>}
    {tab === "applications" && <><span className="panel-kicker-react">APPLICATIONS</span><h2>내가 지원한 공고</h2><ItemList items={data.applications} empty="지원한 공고가 없어요" render={(item, index) => <Link className="dashboard-job-react" to={`/jobs/${item.jobId}`} key={item.id || item.jobId}><img src={jobPhotos[index % jobPhotos.length]} alt="" /><div><span>{item.category || "관광 일자리"}</span><h3>{item.title}</h3><p>{item.companyName}</p><strong>{item.pay}</strong></div></Link>} /></>}
    {tab === "favoriteJobs" && <><span className="panel-kicker-react">FAVORITE JOBS</span><h2>찜한 일자리</h2><ItemList items={data.favoriteJobs} empty="찜한 일자리가 없어요" render={(item, index) => <Link className="dashboard-job-react" to={`/jobs/${item.jobId}`} key={item.id || item.jobId}><img src={jobPhotos[index % jobPhotos.length]} alt="" /><div><span>{item.region} · {item.category}</span><h3>{item.title}</h3><p>{item.companyName}</p><strong>{item.pay}</strong></div></Link>} /></>}
    {tab === "gatherings" && <><span className="panel-kicker-react">MY GATHERINGS</span><h2>내 게더링</h2><ItemList items={data.gatherings} empty="만들거나 참여한 게더링이 없어요" render={(item) => <article className="dashboard-card-react" key={item.id}><span>{item.region} · {item.createdByMe ? "내가 만든 모임" : "참여 중"}</span><h3>{item.title}</h3><p>{item.location} · {item.participantCount}/{item.capacity}명</p><small>{item.eventTime && new Date(item.eventTime).toLocaleString("ko-KR")}</small></article>} /></>}
  </section></div></>}</Status></main>;
}
