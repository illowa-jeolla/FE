import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logoutFromBackend } from "../api/client";
import { cancelJobApplication, unfavoriteJob } from "../api/jobs";
import { deleteTravelPost } from "../api/travelPosts";
import { deleteMyAccount, updateMyProfile } from "../api/myPage";
import { clearSession, getSessionUser, hasSession } from "../auth/session";
import { useApi } from "../hooks/useApi";
import { EmptyCard, FormMessage, Status } from "../components/UI";

const tabs = [["profile", "내 정보"], ["trips", "내가 다닌 여행지"], ["guides", "저장한 여행 가이드"], ["posts", "내 여행 공유"], ["applications", "내가 지원한 공고"], ["favoriteJobs", "찜한 일자리"], ["gatherings", "내 게더링"]];

function pageItems(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => tabs.some(([key]) => key === searchParams.get("tab")) ? searchParams.get("tab") : "profile");
  const [message, setMessage] = useState("");
  const { data: profile, loading: profileLoading, error: profileError, run: reloadProfile } = useApi(hasSession() ? "/api/v1/me" : "", { immediate: hasSession() });
  const { data: summary } = useApi(hasSession() ? "/api/v1/me/summary" : "", { immediate: hasSession() });
  const { data: visitedData, loading: visitedLoading, error: visitedError } = useApi(hasSession() ? "/api/v1/me/visited-places?page=0&size=20" : "", { immediate: hasSession() });
  const { data: savedGuideData, loading: guidesLoading, error: guidesError } = useApi(hasSession() ? "/api/v1/me/travel-guides?page=0&size=20" : "", { immediate: hasSession() });
  const { data: applicationData, loading: applicationsLoading, error: applicationsError, run: reloadApplications, setData: setApplicationData } = useApi(hasSession() ? "/api/v1/me/job-applications" : "", { immediate: hasSession() });
  const { data: favoriteJobData, loading: favoritesLoading, error: favoritesError, run: reloadFavorites, setData: setFavoriteJobData } = useApi(hasSession() ? "/api/v1/me/favorite-jobs" : "", { immediate: hasSession() });
  const { data: myPostData, loading: postsLoading, error: postsError, run: reloadPosts, setData: setMyPostData } = useApi(hasSession() ? "/api/v1/me/travel-posts?page=0&size=20" : "", { immediate: hasSession() });
  const { data: gatheringData, loading: gatheringsLoading, error: gatheringsError } = useApi(hasSession() ? "/api/v1/me/gatherings?page=0&size=20" : "", { immediate: hasSession() });

  if (!hasSession()) return <main className="mypage-main"><section className="page-panel"><EmptyCard title="로그인이 필요합니다" description="내 여행과 지원 내역은 로그인 후 확인할 수 있어요." action={<Link className="button button-primary" to="/auth">로그인</Link>} /></section></main>;

  const sessionUser = getSessionUser();
  const user = profile?.profile || profile || sessionUser;
  const email = user.email || user.username || sessionUser.email;
  const displayName = user.nickname || user.name || sessionUser.name || email.split("@")[0] || "여행자";
  const visitedPlaces = pageItems(visitedData, "places");
  const savedGuides = pageItems(savedGuideData, "guides");
  const applications = pageItems(applicationData, "applications");
  const favoriteJobs = pageItems(favoriteJobData, "jobs");
  const myPosts = pageItems(myPostData, "posts");
  const gatherings = pageItems(gatheringData, "gatherings");

  async function saveProfile(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await updateMyProfile({ nickname: values.nickname.trim(), profileImageUrl: values.profileImageUrl.trim() || null });
      sessionStorage.setItem("nickname", values.nickname.trim());
      setMessage("프로필을 수정했습니다.");
      await reloadProfile();
    } catch (requestError) { setMessage(requestError.message); }
  }

  async function withdraw() {
    if (!window.confirm("회원 탈퇴 후에는 계정을 복구할 수 없습니다. 탈퇴할까요?")) return;
    try { await deleteMyAccount(); clearSession(); navigate("/"); }
    catch (requestError) { setMessage(requestError.message); }
  }

  async function removeMyPost(post) {
    const postId = post.id || post.postId;
    if (!window.confirm("이 여행 글을 삭제할까요?")) return;
    try {
      await deleteTravelPost(postId);
      setMyPostData((current) => Array.isArray(current) ? current.filter((item) => (item.id || item.postId) !== postId) : { ...current, content: pageItems(current, "posts").filter((item) => (item.id || item.postId) !== postId) });
      setMessage("여행 글을 삭제했습니다.");
    } catch (requestError) { setMessage(requestError.message); reloadPosts().catch(() => {}); }
  }

  async function cancelApplication(application) {
    const applicationId = application.id || application.applicationId;
    try {
      await cancelJobApplication(applicationId);
      setApplicationData((current) => Array.isArray(current) ? current.filter((item) => (item.id || item.applicationId) !== applicationId) : { ...current, content: pageItems(current, "applications").filter((item) => (item.id || item.applicationId) !== applicationId) });
      setMessage("지원을 취소했습니다.");
    } catch (requestError) { setMessage(requestError.message); reloadApplications().catch(() => {}); }
  }

  async function removeFavorite(job) {
    const jobId = job.jobId || job.id || job.job?.id;
    try {
      await unfavoriteJob(jobId);
      setFavoriteJobData((current) => Array.isArray(current) ? current.filter((item) => (item.jobId || item.id || item.job?.id) !== jobId) : { ...current, content: pageItems(current, "jobs").filter((item) => (item.jobId || item.id || item.job?.id) !== jobId) });
      setMessage("찜을 취소했습니다.");
    } catch (requestError) { setMessage(requestError.message); reloadFavorites().catch(() => {}); }
  }

  async function logout() {
    try { setMessage("로그아웃 중입니다."); await logoutFromBackend(); clearSession(); navigate("/"); }
    catch (requestError) { setMessage(requestError.message); }
  }

  const tabCounts = { trips: summary?.visitedPlaceCount, guides: summary?.savedGuideCount, posts: summary?.travelPostCount, applications: summary?.jobApplicationCount, favoriteJobs: summary?.favoriteJobCount, gatherings: summary?.gatheringCount };

  return <main className="mypage-main"><Status loading={profileLoading} error={profileError} empty={false}>
    <section className="mypage-profile-card"><div className="mypage-avatar">{displayName.slice(0, 1)}</div><div className="mypage-profile-copy"><span>MY PAGE</span><h1>{displayName}님의 기록</h1><p>{email}</p></div><div className="mypage-profile-actions"><button onClick={logout}>로그아웃</button><button className="is-danger" onClick={withdraw}>회원 탈퇴</button></div></section>
    <FormMessage message={message} />
    <section className="mypage-layout"><nav className="mypage-tabs">{tabs.map(([key, label], index) => <button className={tab === key ? "is-active" : ""} onClick={() => setTab(key)} key={key}><span>{String(index + 1).padStart(2, "0")}</span>{label}{tabCounts[key] != null && <b>{tabCounts[key]}</b>}</button>)}</nav><div className="mypage-panels"><section className="mypage-panel is-active">
      {tab === "profile" && <><span className="mypage-kicker">PROFILE</span><h2>내 정보</h2><p>닉네임과 프로필 이미지를 수정할 수 있습니다.</p><form id="nickname-form" onSubmit={saveProfile}><label>이메일<input value={email} readOnly /></label><label>닉네임<input name="nickname" defaultValue={displayName} maxLength="50" required /></label><label>프로필 이미지 URL<input name="profileImageUrl" defaultValue={user.profileImageUrl || user.profileImage || ""} placeholder="https://..." /></label><button type="submit">프로필 저장</button></form></>}
      {tab === "guides" && <><span className="mypage-kicker">SAVED GUIDES</span><h2>내가 저장한 여행 가이드</h2><Link className="button" to="/mypage/drafts">임시 일정 보기</Link>{guidesLoading ? <div className="mypage-empty">저장한 가이드를 불러오는 중입니다.</div> : guidesError ? <div className="mypage-empty"><strong>가이드를 불러오지 못했습니다.</strong><p>{guidesError}</p></div> : savedGuides.length ? <div className="mypage-card-list">{savedGuides.map((guide) => <Link className="mypage-guide-card" to={`/travel-guide/${guide.guideId || guide.id}`} key={guide.guideId || guide.id}><div className="mypage-guide-copy"><span>SAVED GUIDE · {guide.regionName}</span><h3>{guide.title}</h3><p>{guide.summary || "저장한 여행 일정"}</p><div className="mypage-guide-summary"><b>{guide.startsOn} — {guide.endsOn}</b><b>{guide.generatedByAi ? "AI 추천" : "직접 구성"}</b></div></div></Link>)}</div> : <div className="mypage-empty"><strong>저장한 여행 가이드가 없어요</strong><p>여행 가이드를 저장하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "trips" && <><span className="mypage-kicker">VISITED PLACES</span><h2>내가 다녀온 관광지</h2>{visitedLoading ? <div className="mypage-empty">방문 기록을 불러오는 중입니다.</div> : visitedError ? <div className="mypage-empty"><strong>방문 기록을 불러오지 못했습니다.</strong><p>{visitedError}</p></div> : visitedPlaces.length ? <div className="mypage-card-list">{visitedPlaces.map((visit) => { const place = visit.place || visit; const placeId = place.id || visit.placeId; return <Link className="mypage-guide-card" to={`/destinations/${placeId}`} key={placeId}><div className="mypage-guide-copy"><span>VISITED · {place.regionName || "전라도"}</span><h3>{place.name || visit.placeName}</h3><p>{place.address || visit.visitedAt?.slice?.(0, 10) || "방문한 관광지"}</p></div></Link>; })}</div> : <div className="mypage-empty"><strong>방문한 관광지가 없어요</strong><p>관광지 상세에서 방문 등록을 하면 이곳에 표시됩니다.</p></div>}</>}
      {tab === "posts" && <><span className="mypage-kicker">MY TRAVEL POSTS</span><h2>내 여행 공유</h2>{postsLoading ? <div className="mypage-empty">여행 글을 불러오는 중입니다.</div> : postsError ? <div className="mypage-empty"><strong>여행 글을 불러오지 못했습니다.</strong><p>{postsError}</p></div> : myPosts.length ? <div className="mypage-card-list">{myPosts.map((post) => { const postId = post.id || post.postId; return <article className="mypage-job-card" key={postId}><div><span>{post.regionName || post.region?.name || "전라도"} · ♥ {post.likeCount || 0}</span><h3>{post.title || post.concept}</h3><p>{post.content}</p></div><div><Link className="button" to={`/community/${postId}`}>글 보기</Link><button className="button" type="button" onClick={() => removeMyPost(post)}>삭제</button></div></article>; })}</div> : <div className="mypage-empty"><strong>작성한 여행 글이 없어요</strong><p>여행의 순간을 공유하면 이곳에서 관리할 수 있어요.</p></div>}</>}
      {tab === "applications" && <><span className="mypage-kicker">JOB APPLICATIONS</span><h2>내가 지원한 공고</h2>{applicationsLoading ? <div className="mypage-empty">지원 내역을 불러오는 중입니다.</div> : applicationsError ? <div className="mypage-empty"><strong>지원 내역을 불러오지 못했습니다.</strong><p>{applicationsError}</p></div> : applications.length ? <div className="mypage-card-list">{applications.map((application) => { const job = application.job || application; const applicationId = application.id || application.applicationId; return <article className="mypage-job-card" key={applicationId}><div><span>{application.status || "지원 완료"} · {job.regionName || "관광 일자리"}</span><h3>{job.title || application.jobTitle}</h3><p>{job.employerName || application.employerName}</p></div><div><Link className="button" to={`/jobs/${job.id || application.jobId}`}>공고 보기</Link><button className="button" type="button" onClick={() => cancelApplication(application)}>지원 취소</button></div></article>; })}</div> : <div className="mypage-empty"><strong>지원한 공고가 없어요</strong><p>관광 일자리에 지원하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "favoriteJobs" && <><span className="mypage-kicker">FAVORITE JOBS</span><h2>찜한 일자리</h2>{favoritesLoading ? <div className="mypage-empty">찜 목록을 불러오는 중입니다.</div> : favoritesError ? <div className="mypage-empty"><strong>찜 목록을 불러오지 못했습니다.</strong><p>{favoritesError}</p></div> : favoriteJobs.length ? <div className="mypage-card-list">{favoriteJobs.map((favorite) => { const job = favorite.job || favorite; const jobId = job.id || favorite.jobId; return <article className="mypage-job-card" key={jobId}><div><span>{job.category || "관광 일자리"} · {job.regionName}</span><h3>{job.title}</h3><p>{job.employerName} · {job.salaryText || "급여 협의"}</p></div><div><Link className="button" to={`/jobs/${jobId}`}>공고 보기</Link><button className="button" type="button" onClick={() => removeFavorite(favorite)}>찜 취소</button></div></article>; })}</div> : <div className="mypage-empty"><strong>찜한 일자리가 없어요</strong><p>관심 있는 관광 일자리를 찜하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "gatherings" && <><span className="mypage-kicker">MY GATHERINGS</span><h2>내 게더링</h2>{gatheringsLoading ? <div className="mypage-empty">게더링을 불러오는 중입니다.</div> : gatheringsError ? <div className="mypage-empty"><strong>게더링을 불러오지 못했습니다.</strong><p>{gatheringsError}</p></div> : gatherings.length ? <div className="mypage-card-list">{gatherings.map((gathering) => { const item = gathering.gathering || gathering; return <Link className="mypage-guide-card" to="/gatherings" key={item.id || item.gatheringId}><div className="mypage-guide-copy"><span>{gathering.role || gathering.status || "참여"} · {item.regionName || item.region || "전라도"}</span><h3>{item.title}</h3><p>{item.location || item.description || "게더링 상세 보기"}</p><div className="mypage-guide-summary"><b>{item.eventTime?.slice?.(0, 10) || item.event_time?.slice?.(0, 10)}</b><b>{item.participantCount || item.participant_count || 0}/{item.capacity || "-"}명</b></div></div></Link>; })}</div> : <div className="mypage-empty"><strong>참여한 게더링이 없어요</strong><p>게더링을 만들거나 참여하면 이곳에서 확인할 수 있어요.</p></div>}</>}
    </section></div></section>
  </Status></main>;
}
