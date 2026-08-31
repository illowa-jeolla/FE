import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageIntro, Status } from "../components/UI";
import { getRegions } from "../api/regions";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";

function PostCard({ post }) {
  const images = postImages(post);
  return <Link className="post-card" to={`/community/${post.id}`}>{images[0] && <img src={images[0]} alt="" />}<div className="post-card-body"><div className="post-card-meta"><span>{post.regionName || post.region?.name || "전라도"}</span><time>{(post.createdAt || post.created_at)?.slice?.(0, 10)}</time></div><h3>{post.title || post.concept || "전라도 여행 이야기"}</h3><p>{post.content}</p><div className="post-card-footer"><span>@{post.authorName || post.nickname || post.username || "여행자"}</span><span>♥ {post.likeCount || 0} · 댓글 {post.commentCount || post.comment_count || 0}</span></div></div></Link>;
}

export default function CommunityPage() {
  const [region, setRegion] = useState("전체");
  const [regionRecords, setRegionRecords] = useState([]);
  const path = "/api/v1/travel-posts?page=0&size=12";
  const { data, loading, error, run } = useApi(path);
  const posts = Array.isArray(data?.content) ? data.content : asList(data, "posts");
  useEffect(() => { getRegions({ parentId: 1 }).then((result) => setRegionRecords(asList(result, "regions"))).catch(() => {}); }, []);
  function applyRegion(event) { event.preventDefault(); const selected = regionRecords.find((item) => item.name === region); const query = new URLSearchParams({ page: "0", size: "12" }); if (selected?.id) query.set("regionId", selected.id); run(`/api/v1/travel-posts?${query}`).catch(() => {}); }
  return <main className="feature-page-main community-page-main"><section className="page-intro"><div><p className="eyebrow dark">지금의 여행</p><h1>전라도를 공유해요</h1></div><div className="page-intro-actions"><Link className="button button-primary" to="/community/write">여행 올리기 +</Link></div></section><div className="page-workspace community-layout"><section className="page-panel"><form className="filter-row" onSubmit={applyRegion}><select aria-label="게시글 지역 필터" value={region} onChange={(event) => setRegion(event.target.value)}><option>전체</option>{regionRecords.map((item) => <option key={item.id}>{item.name}</option>)}</select><button className="button button-primary" type="submit">지역 적용</button></form><div className="community-filter-notice">{region === "전체" ? "모든 여행 기록을 모아보고 있어요." : `${region} 여행 기록을 모아보고 있어요.`}</div><Status loading={loading} error={error} empty={!posts.length}><div className="post-feed">{posts.map((post) => <PostCard post={post} key={post.id} />)}</div></Status></section></div></main>;
}
