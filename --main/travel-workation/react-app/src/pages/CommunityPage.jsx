import { useState } from "react";
import { Link } from "react-router-dom";
import { PageIntro, Status } from "../components/UI";
import { regions } from "../data/regions";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";

function PostCard({ post }) {
  const images = postImages(post);
  return <Link className="post-card-react" to={`/community/${post.id}`}><div className="post-image-react">{images[0] ? <img src={images[0]} alt="" /> : <span>{post.region}</span>}</div><div><div className="card-label-row"><span>{post.region}</span><small>{post.created_at?.slice?.(0, 10)}</small></div><h3>{post.concept}</h3><p>{post.content}</p><footer><span>{post.nickname || post.username || "여행자"}</span><b>댓글 {post.comment_count || 0}</b></footer></div></Link>;
}

export default function CommunityPage() {
  const [region, setRegion] = useState("전체");
  const path = `/api/posts${region !== "전체" ? `?region=${encodeURIComponent(region)}` : ""}`;
  const { data, loading, error, run } = useApi(path);
  const posts = asList(data, "posts");
  return <main className="page-shell-react"><PageIntro eyebrow="TRAVEL STORIES" title="전라도를 공유해요" description="실시간 여행 기록과 사진으로 다음 여행의 힌트를 만나보세요." action={<Link className="primary-action-react" to="/community/write">여행 올리기 +</Link>} />
    <div className="filter-bar-react"><label>지역<select value={region} onChange={(e) => { setRegion(e.target.value); const next = e.target.value; run(`/api/posts${next !== "전체" ? `?region=${encodeURIComponent(next)}` : ""}`).catch(() => {}); }}>{regions.map((item) => <option key={item}>{item}</option>)}</select></label><p>{region === "전체" ? "모든 여행 기록을 모아보고 있어요." : `${region} 여행 기록을 모아보고 있어요.`}</p></div>
    <Status loading={loading} error={error} empty={!posts.length}><div className="post-feed-react">{posts.map((post) => <PostCard post={post} key={post.id} />)}</div></Status>
  </main>;
}
