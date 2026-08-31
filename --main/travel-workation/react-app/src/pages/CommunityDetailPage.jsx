import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createTravelComment, deleteTravelComment, deleteTravelPost, likeTravelPost, unlikeTravelPost, updateTravelComment, updateTravelPost } from "../api/travelPosts";
import { hasSession } from "../auth/session";
import { Status } from "../components/UI";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";
import AuthenticatedImage from "../components/AuthenticatedImage";

function relativeTime(value) { if (!value) return "방금"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "방금"; const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `${minutes}분 전`; if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`; return `${Math.floor(minutes / 1440)}일 전`; }

export default function CommunityDetailPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const { data: post, loading, error, run } = useApi(`/api/v1/community/travel-posts/${id}`);
  const { data: commentData, error: commentError, run: runComments } = useApi(`/api/v1/community/travel-posts/${id}/comments?page=0&size=50`);
  const [message, setMessage] = useState(""); const [activeImage, setActiveImage] = useState(0); const [liked, setLiked] = useState(false); const [busy, setBusy] = useState(false);
  const valid = post && (post.id || post.postId || post.content || post.title); const fetchedComments = asList(commentData, "comments"); const comments = commentData != null ? fetchedComments : valid ? post.comments || [] : []; const images = valid ? postImages(post) : [];
  useEffect(() => { if (post) setLiked(Boolean(post.liked || post.like)); }, [post]);

  function requireLogin() { if (hasSession()) return true; setMessage("로그인 후 이용할 수 있어요."); return false; }
  async function addComment(event) { event.preventDefault(); if (!requireLogin()) return; const form = event.currentTarget; const content = String(new FormData(form).get("content") || "").trim(); if (!content) return; setBusy(true); try { await createTravelComment(id, content); form.reset(); await Promise.all([run(), runComments()]); setMessage("댓글을 등록했습니다."); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function editComment(comment) { if (!requireLogin()) return; const content = window.prompt("댓글을 수정해 주세요.", comment.content); if (!content?.trim()) return; setBusy(true); try { await updateTravelComment(comment.id || comment.commentId, content.trim()); setMessage("댓글을 수정했습니다."); await Promise.all([run(), runComments()]); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function removeComment(comment) { if (!requireLogin() || !window.confirm("댓글을 삭제할까요?")) return; setBusy(true); try { await deleteTravelComment(comment.id || comment.commentId); setMessage("댓글을 삭제했습니다."); await Promise.all([run(), runComments()]); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function toggleLike() { if (!requireLogin()) return; setBusy(true); try { if (liked) await unlikeTravelPost(id); else await likeTravelPost(id); setLiked((current) => !current); setMessage(liked ? "좋아요를 취소했습니다." : "게시글을 좋아합니다."); await run(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function editPost() { if (!requireLogin()) return; const title = window.prompt("제목을 수정해 주세요.", post.title || ""); if (!title?.trim()) return; const content = window.prompt("여행 내용을 수정해 주세요.", post.content || ""); if (!content?.trim()) return; const imageIds = Array.isArray(post.images) ? post.images.map((image) => image.imageId || image.id).filter(Boolean) : []; setBusy(true); try { await updateTravelPost(id, { regionId: post.regionId || post.region?.id, title: title.trim(), concept: post.concept || "", content: content.trim(), imageIds }); setMessage("게시글을 수정했습니다."); await run(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function removePost() { if (!requireLogin() || !window.confirm("이 게시글을 삭제할까요?")) return; setBusy(true); try { await deleteTravelPost(id); navigate("/community"); } catch (e) { setMessage(e.message); setBusy(false); } }

  return <main className="community-detail-main">
    <header className="community-subpage-header community-detail-page-header"><div><p className="eyebrow dark">여행 공유</p><Link className="community-header-back" to="/community"><span aria-hidden="true">←</span><strong>모든 여행 기록</strong></Link></div><p>실시간 여행 기록과 댓글을 확인하세요.</p></header>
    <article className="community-detail-card"><Status loading={loading} error={error} empty={!valid}>{valid && <>
      <div className="community-detail-toolbar"><h1>{post.title || post.concept || "지금의 여행"}</h1><div>{post.editable && <button className="button" type="button" disabled={busy} onClick={editPost}>수정</button>}{post.deletable && <button className="button" type="button" disabled={busy} onClick={removePost}>삭제</button>}</div></div>
      {images.length ? <div className="community-detail-gallery"><AuthenticatedImage className="community-detail-image" src={images[activeImage]} alt={`${post.regionName || "전라도"} 여행 사진`} /><div className="community-detail-thumbs">{images.map((image, index) => <button type="button" className={activeImage === index ? "is-active" : ""} onClick={() => setActiveImage(index)} key={`${image.slice(-40)}-${index}`}><AuthenticatedImage src={image} alt={`여행 사진 ${index + 1}`} /></button>)}</div></div> : <div className="community-detail-image post-image-fallback" />}
      <div className="community-detail-content"><div className="community-detail-meta"><span>{post.regionName || post.region?.name || "전라도"} · {post.authorNickname || post.authorName || post.nickname || post.username || "여행자"}</span><time>{relativeTime(post.createdAt || post.created_at)} · 조회 {post.viewCount || 0}</time></div>{post.concept && <p className="eyebrow dark community-detail-concept">{post.concept}</p>}<p className="community-detail-copy">{post.content}</p>
        <button className={`community-like-button${liked ? " is-liked" : ""}`} type="button" disabled={busy} onClick={toggleLike}>{liked ? "♥" : "♡"} 좋아요 {post.likeCount || 0}</button>
        <section className="community-comments"><h3>댓글 <span>{post.commentCount ?? comments.length}</span></h3><div>{comments.length ? comments.map((comment) => <article key={comment.id || comment.commentId}><strong>{comment.authorNickname || comment.authorName || comment.nickname || comment.username || "여행자"}</strong><p>{comment.content}</p><time>{relativeTime(comment.createdAt || comment.created_at)}</time><footer><button type="button" disabled={busy} onClick={() => editComment(comment)}>수정</button><button type="button" disabled={busy} onClick={() => removeComment(comment)}>삭제</button></footer></article>) : <p className="empty-comment">첫 댓글을 남겨보세요.</p>}</div><form className="community-comment-form" onSubmit={addComment}><input name="content" maxLength="500" placeholder="여행 이야기에 댓글을 남겨보세요" required /><button className="button button-primary" type="submit" disabled={busy}>등록</button></form><div className={`page-status${message || commentError ? " is-visible" : ""}${commentError ? " is-error" : ""}`}>{message || commentError}</div></section>
      </div>
    </>}</Status></article>
  </main>;
}
