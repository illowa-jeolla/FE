import "../styles/mypage-refresh.css";
import "../styles/mypage-account.css";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { logoutFromBackend } from "../api/client";
import { cancelJobApplication, externalJobDetailPath, updateJobApplicationStatus } from "../api/jobs";
import { deleteTravelPost } from "../api/travelPosts";
import { updateMyNickname } from "../api/myPage";
import { getSavedTravelGuide, removeSavedTravelGuide } from "../api/travelRecommendations";
import { clearSession, getSessionUser, hasSession } from "../auth/session";
import { useApi } from "../hooks/useApi";
import { favoriteKey, useJobFavorites } from "../hooks/useJobFavorites";
import { EmptyCard, FormMessage } from "../components/UI";
import AuthenticatedImage from "../components/AuthenticatedImage";
import { postImages } from "./communityUtils";

const AI_MATCH_STORAGE_KEYS = ["illowa:ai-match:latest:v1", "illowa:ai-match:history:v1"];
const APPLICATION_STATUS_OPTIONS = [
  ["APPLIED", "지원 완료"],
  ["DOCUMENT_PASS", "서류 합격"],
  ["INTERVIEW", "면접 진행"],
  ["ACCEPTED", "최종 합격"],
  ["REJECTED", "불합격"]
];
const APPLICATION_STATUS_LABELS = Object.fromEntries(APPLICATION_STATUS_OPTIONS);

function clearAiMatchStorage() {
  AI_MATCH_STORAGE_KEYS.forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
}

const tabs = [["profile", "내 정보"], ["guides", "저장한 여행 가이드"], ["posts", "내 여행 공유"], ["applications", "내가 지원한 공고"], ["favoriteJobs", "찜한 일자리"], ["gatherings", "내 게더링"]];

function pageItems(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function guidePlaces(detail = {}) {
  return (detail.days || []).flatMap((day) => day.items || day.places || []).map((item) => item.title || item.name).filter(Boolean).slice(0, 6);
}

function formatGatheringDate(value) {
  if (!value) return "일정 미정";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isPastGathering(item = {}) {
  const timing = String(item.timing || "").toUpperCase();
  const status = String(item.status || "").toUpperCase();
  const startsAt = item.startsAt || item.eventTime || item.event_time;
  return timing === "PAST" || ["COMPLETED", "FINISHED", "ENDED"].includes(status) || (startsAt && new Date(startsAt).getTime() < Date.now());
}

function gatheringStatus(item) {
  if (isPastGathering(item)) return "종료됨";
  if (String(item.status || "").toUpperCase() === "CANCELLED") return "취소됨";
  if (item.status === "CLOSED" || item.participantCount >= item.capacity) return "모집 확정";
  return "참여 중";
}

function profileImageUrl(user = {}) {
  const socialProfile = user.socialProfile || user.profile || user.properties || {};
  const candidates = [
    user.avatarUrl,
    user.profileImageUrl,
    user.profileImage,
    user.profileImageURL,
    user.imageUrl,
    user.picture,
    socialProfile.avatarUrl,
    socialProfile.profileImageUrl,
    socialProfile.profileImage,
    socialProfile.imageUrl,
    socialProfile.picture
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function ProfileAvatar({ src, name }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return <img className="mypage-default-avatar" src="/brand/empty-character.png" alt="일로와 전라 강아지 로고" />;
  }

  return <img src={src} alt={`${name} 프로필`} referrerPolicy="no-referrer" decoding="async" onError={() => setFailed(true)} />;
}

export default function MyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => tabs.some(([key]) => key === searchParams.get("tab")) ? searchParams.get("tab") : "profile");
  const [message, setMessage] = useState("");
  const [guideDetails, setGuideDetails] = useState({});
  const [gatheringFilter, setGatheringFilter] = useState("joined");
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
  const [deletingApplicationId, setDeletingApplicationId] = useState("");
  const [applicationDeleteTarget, setApplicationDeleteTarget] = useState(null);
  const { data: profileData, loading: profileLoading, error: profileError, setData: setProfileData } = useApi(hasSession() ? "/api/v1/users/me" : "", { immediate: hasSession() });
  const { data: summary } = useApi(hasSession() ? "/api/v1/me/summary" : "", { immediate: hasSession() });
  const { data: savedGuideData, loading: guidesLoading, error: guidesError, run: reloadGuides, setData: setSavedGuideData } = useApi(hasSession() ? "/api/v1/travel-guides/saved" : "", { immediate: hasSession() });
  const { data: applicationData, loading: applicationsLoading, error: applicationsError, run: reloadApplications, setData: setApplicationData } = useApi(hasSession() ? "/api/v1/jobs/applications?page=0&size=20" : "", { immediate: hasSession() });
  const favorites = useJobFavorites();
  const { items: favoriteJobs, loading: favoritesLoading, error: favoritesError } = favorites;
  const { data: myPostData, loading: postsLoading, error: postsError, run: reloadPosts, setData: setMyPostData } = useApi(hasSession() ? "/api/v1/community/travel-posts/me?page=0&size=20" : "", { immediate: hasSession() });
  const { data: hostedGatheringData, loading: hostedGatheringsLoading, error: hostedGatheringsError } = useApi(hasSession() ? "/api/v1/gatherings/me?type=hosted&page=0&size=20" : "", { immediate: hasSession() });
  const { data: joinedGatheringData, loading: joinedGatheringsLoading, error: joinedGatheringsError } = useApi(hasSession() ? "/api/v1/gatherings/me?type=joined&page=0&size=20" : "", { immediate: hasSession() });

  const sessionUser = getSessionUser();
  const user = profileData || sessionUser;
  const email = user.email || user.username || sessionUser.email || "";
  const displayName = user.nickname || user.name || sessionUser.name || email.split("@")[0] || "여행자";
  const avatarUrl = profileImageUrl(user);
  const savedGuides = pageItems(savedGuideData, "guides");
  const applications = pageItems(applicationData, "applications");
  const myPosts = pageItems(myPostData, "posts");
  const hostedGatherings = pageItems(hostedGatheringData, "gatherings").map((item) => ({ ...item, relationshipType: "hosted" }));
  const joinedGatherings = pageItems(joinedGatheringData, "gatherings").map((item) => ({ ...item, relationshipType: "joined" }));
  const gatherings = Array.from(new Map([...joinedGatherings, ...hostedGatherings].map((item) => [String(item.id || item.gatheringId), item])).values());
  const gatheringsLoading = hostedGatheringsLoading || joinedGatheringsLoading;
  const gatheringsError = hostedGatheringsError && joinedGatheringsError ? hostedGatheringsError : "";
  const filteredGatherings = (gatheringFilter === "hosted" ? hostedGatherings : gatheringFilter === "joined" ? gatherings.filter((item) => !isPastGathering(item)) : gatherings)
    .sort((left, right) => Number(isPastGathering(left)) - Number(isPastGathering(right)) || new Date(left.startsAt || left.eventTime || left.event_time || 0) - new Date(right.startsAt || right.eventTime || right.event_time || 0));

  useEffect(() => {
    let cancelled = false;
    const ids = savedGuides.map((guide) => guide.guideId || guide.id).filter(Boolean);
    if (!ids.length) return () => { cancelled = true; };
    Promise.all(ids.map(async (id) => {
      try { return [id, await getSavedTravelGuide(id)]; }
      catch { return [id, null]; }
    })).then((entries) => { if (!cancelled) setGuideDetails(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [savedGuideData]);

  if (!hasSession()) return <main className="mypage-main mypage-refresh"><section className="page-panel"><EmptyCard title="로그인이 필요합니다" description="내 여행과 지원 내역은 로그인 후 확인할 수 있어요." action={<Link className="button button-primary" to="/auth">로그인</Link>} /></section></main>;

  async function removeGuide(guide) {
    const guideId = guide.guideId || guide.id;
    if (!window.confirm("이 여행 가이드를 삭제할까요?")) return;
    try {
      await removeSavedTravelGuide(guideId);
      setSavedGuideData((current) => Array.isArray(current) ? current.filter((item) => (item.guideId || item.id) !== guideId) : { ...current, content: pageItems(current, "guides").filter((item) => (item.guideId || item.id) !== guideId) });
      setMessage("저장한 여행 가이드를 삭제했습니다.");
    } catch (requestError) { setMessage(requestError.message); reloadGuides().catch(() => {}); }
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

  async function cancelApplication(application, confirmed = false) {
    if (!confirmed) {
      setApplicationDeleteTarget({ ...application, ...(application.job || {}) });
      return;
    }
    const applicationId = application.id || application.applicationId;
    if (!applicationId || deletingApplicationId) return;
    setDeletingApplicationId(String(applicationId));
    setMessage("지원 기록을 삭제하고 있습니다.");
    try {
      await cancelJobApplication(applicationId);
      setApplicationData((current) => Array.isArray(current) ? current.filter((item) => (item.id || item.applicationId) !== applicationId) : { ...current, content: pageItems(current, "applications").filter((item) => (item.id || item.applicationId) !== applicationId) });
      setMessage("지원 기록을 삭제했습니다.");
      setApplicationDeleteTarget(null);
    } catch (requestError) { setMessage(requestError.message); reloadApplications().catch(() => {}); }
    finally { setDeletingApplicationId(""); }
  }

  async function removeFavorite(favorite) {
    try {
      await favorites.toggle(favorite.job || favorite);
      setMessage("찜을 취소했습니다.");
    } catch (requestError) { setMessage(requestError.message); }
  }

  async function logout() {
    try { setMessage("로그아웃 중입니다."); await logoutFromBackend(); clearAiMatchStorage(); clearSession(); navigate("/"); }
    catch (requestError) { setMessage(requestError.message); }
  }

  async function changeApplicationStatus(application, status) {
    const applicationId = application.id || application.applicationId;
    if (!applicationId || application.status === status || updatingApplicationId) return;
    setUpdatingApplicationId(String(applicationId));
    setMessage("지원 상태를 변경하고 있습니다.");
    try {
      const updated = await updateJobApplicationStatus(applicationId, status);
      const nextApplication = { ...application, ...(updated || {}), status };
      const replaceApplication = (item) => String(item.id || item.applicationId) === String(applicationId) ? nextApplication : item;
      setApplicationData((current) => {
        if (Array.isArray(current)) return current.map(replaceApplication);
        if (Array.isArray(current?.content)) return { ...current, content: current.content.map(replaceApplication) };
        if (Array.isArray(current?.applications)) return { ...current, applications: current.applications.map(replaceApplication) };
        if (Array.isArray(current?.items)) return { ...current, items: current.items.map(replaceApplication) };
        return current;
      });
      setMessage(`지원 상태를 '${APPLICATION_STATUS_LABELS[status]}'(으)로 변경했습니다.`);
    } catch (requestError) { setMessage(requestError.message); }
    finally { setUpdatingApplicationId(""); }
  }

  async function changeNickname(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const nickname = String(new FormData(form).get("nickname") || "").trim();
    if (!nickname || nickname.length > 10) { setMessage("닉네임은 공백 없이 1자 이상 10자 이하로 입력해 주세요."); return; }
    try {
      setMessage("닉네임을 변경하고 있습니다.");
      const updatedUser = await updateMyNickname(nickname);
      const responseUser = updatedUser?.data?.user ?? updatedUser?.data ?? updatedUser?.user ?? updatedUser ?? {};
      setProfileData((current) => ({ ...(current || {}), ...responseUser, nickname }));
      sessionStorage.setItem("nickname", nickname);
      window.dispatchEvent(new CustomEvent("session-user-changed", { detail: { nickname } }));
      setMessage("닉네임을 변경했습니다.");
    } catch (requestError) { setMessage(requestError.message); }
  }

  const tabCounts = { guides: summary?.savedGuideCount, posts: summary?.travelPostCount, applications: summary?.jobApplicationCount, favoriteJobs: favorites.ready ? favoriteJobs.length : summary?.favoriteJobCount, gatherings: summary?.gatheringCount };

  return <main className="mypage-main mypage-refresh">
    <aside className="mypage-side-panel mypage-side-panel-left" aria-hidden="true"><img src="/마이페이지.png" alt="" /></aside>
    {applicationDeleteTarget && <div className="mypage-application-delete-modal"><button className="mypage-application-delete-backdrop" type="button" aria-label="삭제 확인 창 닫기" disabled={Boolean(deletingApplicationId)} onClick={() => setApplicationDeleteTarget(null)} /><section role="dialog" aria-modal="true" aria-labelledby="application-delete-title"><span className="mypage-application-delete-icon" aria-hidden="true">!</span><small>APPLICATION RECORD</small><h2 id="application-delete-title">지원 기록을 삭제할까요?</h2><p><strong>{applicationDeleteTarget.title || applicationDeleteTarget.jobTitle || "선택한 공고"}</strong>의 지원 상태와 기록이 모두 삭제됩니다.</p><em>삭제한 기록은 되돌릴 수 없습니다.</em><div><button type="button" disabled={Boolean(deletingApplicationId)} onClick={() => setApplicationDeleteTarget(null)}>취소</button><button className="is-danger" type="button" disabled={Boolean(deletingApplicationId)} onClick={() => cancelApplication(applicationDeleteTarget, true)}>{deletingApplicationId ? "삭제 중..." : "지원 기록 삭제"}</button></div></section></div>}
    <section className="mypage-profile-card"><div className="mypage-avatar"><ProfileAvatar src={avatarUrl} name={displayName} /></div><div className="mypage-profile-copy"><span>MY LOCAL LIFE</span><h1>{displayName}님의 전라도 이야기</h1><p className="mypage-profile-description">여행의 추억부터 새로운 일까지, 나의 활동을 한곳에서 확인해요.</p><p>{email || "이메일 정보 없음"}</p></div><div className="mypage-profile-actions"><button onClick={logout}>로그아웃</button></div></section>
    <FormMessage message={message} />
    <section className="mypage-layout"><nav className="mypage-tabs" aria-label="나의 활동">{tabs.map(([key, label], index) => <button className={tab === key ? "is-active" : ""} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined} key={key}><span className="mypage-tab-character" aria-hidden="true"><span className="mypage-tab-mark">{String(index + 1).padStart(2, "0")}</span></span><span className="mypage-tab-label">{label}</span>{tabCounts[key] != null && <b>{tabCounts[key]}</b>}</button>)}</nav><div className="mypage-panels"><section className="mypage-panel is-active">
      {tab === "profile" && <><span className="mypage-kicker">PROFILE</span><h2>내 정보</h2><p>서비스에서 사용할 닉네임을 변경할 수 있어요.</p>{profileLoading ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span>내 정보를 불러오는 중입니다.</div> : profileError ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>내 정보를 불러오지 못했습니다.</strong><p>{profileError}</p></div> : <form id="nickname-form" onSubmit={changeNickname}><label>아이디<input value={email || "이메일 정보 없음"} readOnly /></label><label htmlFor="mypage-nickname">닉네임<input id="mypage-nickname" name="nickname" defaultValue={displayName} maxLength="10" autoComplete="nickname" required /></label><button type="submit">닉네임 저장</button></form>}</>}
      {tab === "guides" && <><span className="mypage-kicker">SAVED GUIDES</span><h2>내가 저장한 여행 가이드</h2><p>저장한 코스와 여행 일정을 확인할 수 있어요.</p>{guidesLoading ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span>저장한 가이드를 불러오는 중입니다.</div> : guidesError ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>가이드를 불러오지 못했습니다.</strong><p>{guidesError}</p></div> : savedGuides.length ? <div className="mypage-card-list mypage-saved-guides">{savedGuides.map((guide) => { const guideId = guide.guideId || guide.id; const detail = guideDetails[guideId] || {}; const places = guidePlaces(detail); const lodging = detail.accommodation?.name || guide.summary || "저장한 여행 일정"; return <article className="mypage-guide-card" key={guideId}><Link className="mypage-guide-copy" to={`/travel-guide/${guideId}`}><span>SAVED GUIDE · {guide.regionName || detail.regionName || "전라도"}</span><h3>{guide.title}</h3><p>{lodging}</p><div className="mypage-guide-summary"><b>{places.length ? `${places.length}곳 코스` : "저장한 코스"}</b><b>{guide.endsOn ? `${guide.endsOn}까지` : guide.startsOn || "날짜 확인"}</b></div><div className="mypage-guide-spots">{places.length ? places.map((place, index) => <div key={`${place}-${index}`}><span>{index + 1}</span><b>{place}</b></div>) : <div className="is-empty"><b>{guide.summary || "가이드에서 상세 코스를 확인해 주세요."}</b></div>}</div><small>{guide.savedAt ? `${new Date(guide.savedAt).toLocaleDateString("ko-KR")} 저장` : "저장한 여행 가이드"}</small></Link><div className="mypage-guide-actions"><Link to={`/travel-guide/${guideId}`}>가이드 보기</Link><button className="guide-delete-button" type="button" onClick={() => removeGuide(guide)}>삭제</button></div></article>; })}</div> : <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>저장한 여행 가이드가 없어요</strong><p>여행 가이드를 저장하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "posts" && <><span className="mypage-kicker">MY STORIES</span><h2>내 여행 공유</h2><p>직접 작성한 여행 후기를 모아보는 화면이에요.</p>{postsLoading ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span>여행 글을 불러오는 중입니다.</div> : postsError ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>여행 글을 불러오지 못했습니다.</strong><p>{postsError}</p></div> : myPosts.length ? <div className="mypage-card-list" id="post-list">{myPosts.map((post) => { const postId = post.id || post.postId; const thumbnailUrl = postImages(post)[0]; return <article className="mypage-story-card" key={postId}><div className="mypage-story-body"><span>{post.regionName || post.region?.name || "전라도"}</span><h3>{post.title || post.concept}</h3><p>{post.contentPreview || post.content || "작성한 여행 이야기"}</p><footer><small>{post.createdAt?.slice?.(0, 10) || "작성일 정보 없음"} · 조회 {post.viewCount || 0} · 댓글 {post.commentCount || 0}</small><strong><Link to={`/community/${postId}`}>글 보기 →</Link></strong></footer></div>{thumbnailUrl ? <AuthenticatedImage src={thumbnailUrl} alt={`${post.title || "여행 게시물"} 대표 사진`} /> : <div className="mypage-story-placeholder"><b>旅</b><span>TRAVEL STORY</span></div>}</article>; })}</div> : <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>작성한 여행 글이 없어요</strong><p>여행의 순간을 공유하면 이곳에서 관리할 수 있어요.</p></div>}</>}
      {tab === "applications" && <><span className="mypage-kicker">APPLICATIONS</span><h2>내가 지원한 공고</h2><p>지원한 공고의 핵심 조건과 현재 진행 상태를 관리할 수 있어요.</p>{applicationsLoading ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span>지원 내역을 불러오는 중입니다.</div> : applicationsError ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>지원 내역을 불러오지 못했습니다.</strong><p>{applicationsError}</p></div> : applications.length ? <div className="mypage-card-list" id="application-list">{applications.map((application) => { const job = application.job || application; const applicationId = application.id || application.applicationId; const source = String(job.source || ""); const detailPath = externalJobDetailPath({ externalSource: source.includes("JUNNAM") ? "junnam" : "tour", externalId: job.externalId }); const currentStatus = application.status || "APPLIED"; const statusLabel = APPLICATION_STATUS_LABELS[currentStatus] || currentStatus; const isUpdating = updatingApplicationId === String(applicationId); const isDeleting = deletingApplicationId === String(applicationId); return <article className="mypage-favorite-job" key={applicationId}><div className="mypage-favorite-job-body"><span>{statusLabel} · {job.address || "근무지 정보 없음"}</span><h3>{job.title || application.jobTitle}</h3><p>{job.companyName || application.companyName || "기업 정보 없음"}</p><div className="mypage-favorite-job-meta"><b>{job.deadline ? `${job.deadline} 마감` : "마감일 확인"}</b></div><div className="mypage-application-status"><span>지원 상태</span><div className="mypage-application-status-options" role="group" aria-label={`${job.title || application.jobTitle} 지원 상태`}>{APPLICATION_STATUS_OPTIONS.map(([value, label]) => <button className={currentStatus === value ? "is-active" : ""} type="button" disabled={Boolean(updatingApplicationId || deletingApplicationId)} aria-pressed={currentStatus === value} key={value} onClick={() => changeApplicationStatus(application, value)}>{label}</button>)}</div><small>{isUpdating ? "변경 중..." : "단계를 누르면 즉시 저장됩니다."}</small></div><footer><small>{application.appliedAt?.slice?.(0, 10) || "지원일 정보 없음"}</small><strong><Link to={detailPath}>공고 보기 →</Link></strong><button className="mypage-application-delete" type="button" disabled={Boolean(updatingApplicationId || deletingApplicationId)} onClick={() => cancelApplication(application)}>{isDeleting ? "삭제 중..." : "지원 기록 삭제"}</button></footer></div></article>; })}</div> : <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>지원한 공고가 없어요</strong><p>관광 일자리에 지원하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "favoriteJobs" && <><span className="mypage-kicker">FAVORITE JOBS</span><h2>내가 찜한 일자리</h2><p>관심 있는 공고를 모아두고 상세 조건을 다시 확인할 수 있어요.</p>{favoritesLoading ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span>찜 목록을 불러오는 중입니다.</div> : favoritesError ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>찜 목록을 불러오지 못했습니다.</strong><p>{favoritesError}</p></div> : favoriteJobs.length ? <div className="mypage-card-list" id="favorite-list">{favoriteJobs.map((favorite) => { const job = favorite.job || favorite; const source = String(job.source || ""); const detailPath = externalJobDetailPath({ externalSource: source.includes("JUNNAM") ? "junnam" : "tour", externalId: job.externalId }); return <article className="mypage-favorite-job" key={favoriteKey(favorite)}><div className="mypage-favorite-job-body"><span>{job.address || "근무지 정보 없음"}</span><h3>{job.title}</h3><p>{job.companyName || "기업 정보 없음"}</p><div className="mypage-favorite-job-meta"><b>{job.deadline ? `${job.deadline} 마감` : "마감일 확인"}</b></div><footer><small>{favorite.favoritedAt?.slice?.(0, 10) || "저장일 정보 없음"}</small><strong><Link to={detailPath}>공고 보기 →</Link></strong><button type="button" className="button job-favorite-button is-favorite" disabled={favorites.pending.has(favoriteKey(favorite))} onClick={() => removeFavorite(favorite)} aria-label={`${job.title} 찜취소`}>♥ 찜취소</button></footer></div></article>; })}</div> : <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>찜한 일자리가 없어요</strong><p>관심 있는 관광 일자리를 찜하면 이곳에서 확인할 수 있어요.</p></div>}</>}
      {tab === "gatherings" && <><span className="mypage-kicker">MY GATHERINGS</span><h2>내 게더링</h2><p>{gatheringFilter === "hosted" ? "필터: 내가 올린 게더링만 표시한 상태예요." : gatheringFilter === "joined" ? "필터: 참여 중 게더링만 표시한 상태예요." : `내가 올린 게더링 ${pageItems(hostedGatheringData, "gatherings").length}개와 참여 중인 게더링 ${pageItems(joinedGatheringData, "gatherings").length}개를 보고 관리할 수 있어요.`}</p><div className="mypage-gathering-filters"><button className={gatheringFilter === "joined" ? "is-active" : ""} type="button" onClick={() => setGatheringFilter("joined")}>참여 중 게더링</button><button className={gatheringFilter === "hosted" ? "is-active" : ""} type="button" onClick={() => setGatheringFilter("hosted")}>내가 올린 게더링</button><button className={gatheringFilter === "all" ? "is-active" : ""} type="button" onClick={() => setGatheringFilter("all")}>참여한 게더링</button></div>{gatheringsLoading ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span>게더링을 불러오는 중입니다.</div> : gatheringsError ? <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>게더링을 불러오지 못했습니다.</strong><p>{gatheringsError}</p></div> : filteredGatherings.length ? <div className="mypage-card-list" id="gathering-list">{filteredGatherings.map((gathering) => { const item = gathering.gathering || gathering; const participantCount = Number(item.participantCount || item.participant_count || 0); const capacity = Number(item.capacity || 0); const left = Math.max(0, capacity - participantCount); const status = gatheringStatus(item); return <article className={`mypage-gathering-card ${gathering.relationshipType === "hosted" ? "is-owned" : "is-joined"}${isPastGathering(item) ? " is-past" : ""}`} key={`${gathering.relationshipType}-${item.id || item.gatheringId}`}><div className="mypage-gathering-copy"><span>{gathering.relationshipType === "hosted" ? "내가 올린 게더링" : "참여 중"}</span><h3>{item.title}</h3><p>{item.meetingPlace || item.location || "장소 확인"}</p><time>{formatGatheringDate(item.startsAt || item.eventTime || item.event_time)}</time><div className="mypage-gathering-meta"><b>{participantCount}/{capacity || "-"}명</b><b>{status === "참여 중" && left ? `${left}자리 남음` : status}</b></div><footer><strong>{item.concept || "함께하는 지역 모임"}</strong><span>{status}</span><Link to="/gatherings">게더링 보기</Link></footer></div></article>; })}</div> : <div className="mypage-empty"><span className="mypage-status-mark" aria-hidden="true">•</span><strong>해당하는 게더링이 없어요</strong><p>게더링을 만들거나 참여하면 이곳에서 확인할 수 있어요.</p></div>}</>}
    </section></div></section>
  </main>;
}
