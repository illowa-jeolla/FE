import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { Status } from "../components/UI";
import { useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";

function relativeTime(value) { if (!value) return "방금"; const date = new Date(value.endsWith?.("Z") ? value : `${value}Z`); if (Number.isNaN(date.getTime())) return "방금"; const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `${minutes}분 전`; if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`; return `${Math.floor(minutes / 1440)}일 전`; }
function tagsFor(post) { if (Array.isArray(post.hashtags)) return post.hashtags; try { const tags = JSON.parse(post.hashtags || "[]"); return Array.isArray(tags) ? tags : []; } catch { return String(post.hashtags || "").split(/[\s,]+/).filter(Boolean); } }

export default function CommunityDetailPage() {
  const { id } = useParams(); const { data: post, loading, error, run } = useApi(`/api/posts/${id}`);
  const [message, setMessage] = useState(""); const [activeImage, setActiveImage] = useState(0);
  const valid = post && (post.id || post.content || post.concept); const comments = valid ? post.comments || [] : []; const images = valid ? postImages(post) : []; const tags = valid ? tagsFor(post) : [];
  async function addComment(event) { event.preventDefault(); if (!hasSession()) { setMessage("로그인 후 댓글을 남길 수 있어요."); return; } const content = new FormData(event.currentTarget).get("content"); try { await apiRequest(`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }); event.currentTarget.reset(); setMessage(""); await run(); } catch (e) { setMessage(e.message); } }
  return <main className="community-detail-main">
    <header className="community-subpage-header"><div><p className="eyebrow dark">여행 공유</p><h1>게시글 상세</h1></div><p>실시간 여행 기록과 댓글을 확인하세요.</p></header>
    <article className="community-detail-card"><Status loading={loading} error={error} empty={!valid}>{valid && <>
      <Link className="community-back" to="/community">← 모든 여행 기록으로</Link>
      {images.length ? <div className="community-detail-gallery"><img className="community-detail-image" src={images[activeImage]} alt={`${post.region || "전라도"} 여행 사진`} /><div className="community-detail-thumbs">{images.map((image, index) => <button type="button" className={activeImage === index ? "is-active" : ""} onClick={() => setActiveImage(index)} key={image.slice(-40)}><img src={image} alt={`여행 사진 ${index + 1}`} /></button>)}</div></div> : <div className="community-detail-image post-image-fallback" />}
      <div className="community-detail-content"><div className="community-detail-meta"><span>{post.region || "전라도"} · {post.nickname || post.username || "여행자"}</span><time>{relativeTime(post.created_at || post.createdAt)}</time></div><h2>{post.concept || "지금의 여행"}</h2><p className="community-detail-copy">{post.content}</p><div className="tag-row">{(tags.length ? tags : [post.region, "여행기록"]).filter(Boolean).map((tag) => <span key={tag}>#{String(tag).replace(/^#/, "")}</span>)}</div>
        <section className="community-comments"><h3>댓글 <span>{comments.length}</span></h3><div>{comments.length ? comments.map((comment) => <article key={comment.id}><strong>{comment.nickname || comment.username || "여행자"}</strong><p>{comment.content}</p><time>{relativeTime(comment.created_at || comment.createdAt)}</time></article>) : <p className="empty-comment">첫 댓글을 남겨보세요.</p>}</div><form className="community-comment-form" onSubmit={addComment}><input name="content" maxLength="120" placeholder="여행 이야기에 댓글을 남겨보세요" required /><button className="button button-primary">등록</button></form><div className={`page-status${message ? " is-visible" : ""}`}>{message}</div></section>
      </div>
    </>}</Status></article>
  </main>;
}
