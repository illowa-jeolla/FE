import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PageIntro, Status } from "../components/UI";
import { getRegions } from "../api/regions";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";
import AuthenticatedImage from "../components/AuthenticatedImage";

function PostCard({ post }) {
  const images = postImages(post);
  const postId = post.postId || post.id;
  return <Link className="post-card" to={`/community/${postId}`}>{images[0] && <AuthenticatedImage src={images[0]} alt="" />}<div className="post-body"><div className="post-meta"><span>{post.regionName || post.region?.name || "전라도"}</span><time>{(post.createdAt || post.created_at)?.slice?.(0, 10)}</time></div><h3>{post.title || post.concept || "전라도 여행 이야기"}</h3><p>{post.contentPreview || post.content}</p><div className="post-card-footer"><span>@{post.authorNickname || post.authorName || post.nickname || post.username || "여행자"}</span><span>조회 {post.viewCount || 0} · 댓글 {post.commentCount || post.comment_count || 0}</span></div></div></Link>;
}

export default function CommunityPage() {
  const location = useLocation(); const navigate = useNavigate();
  const [regionId, setRegionId] = useState("");
  const [regionRecords, setRegionRecords] = useState([]);
  const [savedToast, setSavedToast] = useState(Boolean(location.state?.draftSaved));
  const path = "/api/v1/community/travel-posts?page=0&size=12&sort=createdAt,desc";
  const { data, loading, error, run } = useApi(path);
  const posts = Array.isArray(data?.content) ? data.content : asList(data, "posts");
  const sortedPosts = [...posts].sort((left, right) => {
    const rightTime = new Date(right.createdAt || right.created_at || 0).getTime() || 0;
    const leftTime = new Date(left.createdAt || left.created_at || 0).getTime() || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return Number(right.postId || right.id || 0) - Number(left.postId || left.id || 0);
  });
  useEffect(() => { getRegions().then((result) => setRegionRecords(asList(result, "regions"))).catch(() => {}); }, []);
  useEffect(() => {
    if (!savedToast) return undefined;
    navigate(location.pathname, { replace: true, state: null });
    const timer = window.setTimeout(() => setSavedToast(false), 2600);
    return () => window.clearTimeout(timer);
  }, [location.pathname, navigate, savedToast]);
  const selectedRegion = regionRecords.find((item) => String(item.regionId || item.id) === regionId);
  function applyRegion(event) { event.preventDefault(); const query = new URLSearchParams({ page: "0", size: "12", sort: "createdAt,desc" }); if (regionId) query.set("regionId", regionId); run(`/api/v1/community/travel-posts?${query}`).catch(() => {}); }
  return <main className="feature-page-main community-page-main">{savedToast && <div className="community-saved-toast" role="status"><span>✓</span>저장되었습니다</div>}<section className="page-intro"><div><p className="eyebrow dark">지금의 여행</p><h1>전라도를 공유해요</h1></div><div className="page-intro-actions"><Link className="button button-primary" to="/community/write">여행 올리기 +</Link></div></section><div className="page-workspace community-layout"><section className="page-panel"><form className="filter-row" onSubmit={applyRegion}><select aria-label="게시글 지역 필터" value={regionId} onChange={(event) => setRegionId(event.target.value)}><option value="">전체</option>{regionRecords.map((item) => { const id = item.regionId || item.id; return <option value={id} key={id || item.name}>{item.name}</option>; })}</select><button className="button button-primary" type="submit">지역 적용</button></form><div className="community-filter-notice">{selectedRegion ? `${selectedRegion.name} 여행 기록을 모아보고 있어요.` : "모든 여행 기록을 모아보고 있어요."}</div><Status loading={loading} error={error} empty={!sortedPosts.length}><div className="post-feed">{sortedPosts.map((post) => <PostCard post={post} key={post.postId || post.id} />)}</div></Status></section></div></main>;
}
