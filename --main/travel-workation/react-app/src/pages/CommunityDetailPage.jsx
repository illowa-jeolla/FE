import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createTravelComment, deleteTravelComment, deleteTravelPost, likeTravelPost, unlikeTravelPost, updateTravelComment } from "../api/travelPosts";
import { hasSession } from "../auth/session";
import { Status } from "../components/UI";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";
import AuthenticatedImage from "../components/AuthenticatedImage";

function relativeTime(value) { if (!value) return "방금"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "방금"; const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `${minutes}분 전`; if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`; return `${Math.floor(minutes / 1440)}일 전`; }

function SecretCommentToggle({ name, checked, onChange }) {
  return <label className={`community-secret-option${checked ? " is-active" : ""}`}>
    <input name={name} type="checkbox" checked={checked} onChange={onChange} />
    <span className="community-secret-icon" aria-hidden="true">🔒</span>
    <span className="community-secret-copy"><strong>비밀댓글</strong><small>작성자와 게시글 주인만 볼 수 있어요</small></span>
    <i className="community-secret-switch" aria-hidden="true"><b /></i>
  </label>;
}

export default function CommunityDetailPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const { data: post, loading, error, run } = useApi(`/api/v1/community/travel-posts/${id}`);
  const { data: commentData, error: commentError, run: runComments } = useApi(`/api/v1/community/travel-posts/${id}/comments`);
  const [message, setMessage] = useState(""); const [activeImage, setActiveImage] = useState(0); const [liked, setLiked] = useState(false); const [busy, setBusy] = useState(false);
  const [galleryHovered, setGalleryHovered] = useState(false);
  const [galleryMove, setGalleryMove] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null); const [editingCommentContent, setEditingCommentContent] = useState(""); const [editingCommentSecret, setEditingCommentSecret] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null); const [commentSelectionMode, setCommentSelectionMode] = useState(false); const [selectedCommentIds, setSelectedCommentIds] = useState(() => new Set());
  const valid = post && (post.id || post.postId || post.content || post.title); const fetchedComments = asList(commentData, "comments"); const comments = commentData != null ? fetchedComments : valid ? post.comments || [] : []; const images = valid ? postImages(post) : [];
  const allCommentsSelected = comments.length > 0 && comments.every((comment) => selectedCommentIds.has(String(comment.id || comment.commentId)));
  useEffect(() => { if (post) setLiked(Boolean(post.liked || post.like)); }, [post]);
  useEffect(() => { setActiveImage(0); setGalleryMove(null); }, [images.length]);
  useEffect(() => {
    if (galleryHovered || galleryMove || images.length < 2) return undefined;
    const timer = window.setTimeout(() => moveGallery(1), 5000);
    return () => window.clearTimeout(timer);
  }, [activeImage, galleryHovered, galleryMove, images.length]);
  useEffect(() => {
    if (!openCommentMenuId) return undefined;
    const closeMenu = (event) => { if (!(event.target instanceof Element) || !event.target.closest(".community-comment-menu-wrap")) setOpenCommentMenuId(null); };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openCommentMenuId]);
  useEffect(() => {
    const submitOnEnter = (event) => {
      const textarea = event.target instanceof Element ? event.target.closest(".community-comment-form textarea, .community-comment-edit-form textarea") : null;
      if (!textarea || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      textarea.form?.requestSubmit();
    };
    document.addEventListener("keydown", submitOnEnter);
    return () => document.removeEventListener("keydown", submitOnEnter);
  }, []);

  function requireLogin() { if (hasSession()) return true; setMessage("로그인 후 이용할 수 있어요."); return false; }
  async function addComment(event) { event.preventDefault(); if (!requireLogin()) return; const form = event.currentTarget; const formData = new FormData(form); const content = String(formData.get("content") || "").trim(); const secret = formData.get("secret") === "on"; if (!content) return; setBusy(true); try { await createTravelComment(id, content, secret); form.reset(); await Promise.all([run(), runComments()]); setMessage("댓글을 등록했습니다."); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function startEditingComment(comment) { setOpenCommentMenuId(null); setEditingCommentId(comment.id || comment.commentId); setEditingCommentContent(comment.content || ""); setEditingCommentSecret(Boolean(comment.secret)); }
  function cancelEditingComment() { setEditingCommentId(null); setEditingCommentContent(""); setEditingCommentSecret(false); }
  async function editComment(event, comment) { event.preventDefault(); if (!requireLogin() || !editingCommentContent.trim()) return; setBusy(true); try { await updateTravelComment(id, comment.id || comment.commentId, editingCommentContent.trim(), editingCommentSecret); cancelEditingComment(); setMessage("댓글을 수정했습니다."); await Promise.all([run(), runComments()]); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function removeComment(comment) { setOpenCommentMenuId(null); if (!requireLogin() || !window.confirm("댓글을 삭제할까요?")) return; setBusy(true); try { await deleteTravelComment(id, comment.id || comment.commentId); setMessage("댓글을 삭제했습니다."); await Promise.all([run(), runComments()]); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function toggleCommentSelection(commentId) { setSelectedCommentIds((current) => { const next = new Set(current); const key = String(commentId); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  function selectAllComments() { setSelectedCommentIds(allCommentsSelected ? new Set() : new Set(comments.map((comment) => String(comment.id || comment.commentId)))); }
  function cancelCommentSelection() { setCommentSelectionMode(false); setSelectedCommentIds(new Set()); }
  async function deleteSelectedComments() { if (!selectedCommentIds.size || !window.confirm(`선택한 댓글 ${selectedCommentIds.size}개를 삭제할까요?`)) return; setBusy(true); let failed = 0; for (const commentId of selectedCommentIds) { try { await deleteTravelComment(id, commentId); } catch { failed += 1; } } await Promise.all([run(), runComments()]); if (failed) setMessage(`${selectedCommentIds.size - failed}개를 삭제했고, ${failed}개는 삭제하지 못했습니다.`); else setMessage("선택한 댓글을 삭제했습니다."); cancelCommentSelection(); setBusy(false); }
  async function toggleLike() { if (!requireLogin()) return; setBusy(true); try { if (liked) { const result = await unlikeTravelPost(id); setLiked(result?.liked ?? false); setMessage("좋아요를 취소했습니다."); } else { const result = await likeTravelPost(id); setLiked(result?.liked ?? true); setMessage("게시글을 좋아합니다."); } await run(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function removePost() { if (!requireLogin() || !window.confirm("이 게시글을 삭제할까요?")) return; setBusy(true); try { await deleteTravelPost(id); navigate("/community"); } catch (e) { setMessage(e.message); setBusy(false); } }
  function moveGallery(direction) {
    if (images.length < 2 || galleryMove) return;
    setGalleryMove({ from: activeImage, to: (activeImage + direction + images.length) % images.length, direction });
  }
  function finishGallerySlide() { if (!galleryMove) return; setActiveImage(galleryMove.to); setGalleryMove(null); }
  function selectGalleryImage(index) { if (galleryMove) return; setActiveImage(index); }

  return <main className="community-detail-main">
    <header className="community-subpage-header community-detail-page-header"><div><p className="eyebrow dark">여행 공유</p><Link className="community-header-back" to="/community"><span aria-hidden="true">←</span><strong>모든 여행 기록</strong></Link></div><p>실시간 여행 기록과 댓글을 확인하세요.</p></header>
    <article className="community-detail-card"><Status loading={loading} error={error} empty={!valid}>{valid && <>
      <div className="community-detail-toolbar"><h1>{post.title || post.concept || "지금의 여행"}</h1><div>{post.editable && <Link className="button" to={`/community/${id}/edit`}>수정</Link>}{post.deletable && <button className="button" type="button" disabled={busy} onClick={removePost}>삭제</button>}</div></div>
      {images.length ? <div className="community-detail-gallery" onMouseEnter={() => setGalleryHovered(true)} onMouseLeave={() => setGalleryHovered(false)} onFocus={() => setGalleryHovered(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setGalleryHovered(false); }}><div className="community-detail-stage"><div className={`community-detail-slides${galleryMove ? galleryMove.direction > 0 ? " is-moving-next" : " is-moving-prev" : ""}`}>{galleryMove ? <><AuthenticatedImage className="community-detail-image is-outgoing" src={images[galleryMove.from]} alt="" /><AuthenticatedImage className="community-detail-image is-incoming" src={images[galleryMove.to]} alt={`${post.regionName || "전라도"} 여행 사진 ${galleryMove.to + 1}`} onAnimationEnd={finishGallerySlide} /></> : <AuthenticatedImage className="community-detail-image is-current" src={images[activeImage]} alt={`${post.regionName || "전라도"} 여행 사진 ${activeImage + 1}`} />}</div>{images.length > 1 && <><button className="community-gallery-arrow is-prev" type="button" aria-label="이전 사진" onClick={() => moveGallery(-1)}>‹</button><button className="community-gallery-arrow is-next" type="button" aria-label="다음 사진" onClick={() => moveGallery(1)}>›</button><span className="community-gallery-count">{(galleryMove?.to ?? activeImage) + 1} / {images.length}</span></>}</div><div className="community-detail-thumbs">{images.map((image, index) => <button type="button" className={(galleryMove?.to ?? activeImage) === index ? "is-active" : ""} aria-label={`${index + 1}번째 사진 보기`} onClick={() => selectGalleryImage(index)} key={`${image.slice(-40)}-${index}`}><AuthenticatedImage src={image} alt="" /></button>)}</div></div> : <div className="community-detail-image post-image-fallback" />}
      <div className="community-detail-content"><div className="community-detail-meta"><span>{post.regionName || post.region?.name || "전라도"} · {post.authorNickname || post.authorName || post.nickname || post.username || "여행자"}</span><time>{relativeTime(post.createdAt || post.created_at)} · 조회 {post.viewCount || 0}</time></div>{post.concept && <p className="eyebrow dark community-detail-concept">{post.concept}</p>}<p className="community-detail-copy">{post.content}</p>
        <div className="community-engagement-row"><button className={`community-like-button${liked ? " is-liked" : ""}`} type="button" disabled={busy} onClick={toggleLike}>{liked ? "♥" : "♡"} 좋아요 {post.likeCount || 0}</button>{(post.editable || post.deletable) && (commentSelectionMode ? <div className="community-comment-selection-bar"><button type="button" onClick={selectAllComments}>모두 선택</button><button className="is-danger" type="button" disabled={!selectedCommentIds.size || busy} onClick={deleteSelectedComments}>선택 삭제</button><button type="button" disabled={busy} onClick={cancelCommentSelection}>취소</button></div> : <button className="community-comment-select-trigger" type="button" disabled={busy || !comments.length} onClick={() => { setOpenCommentMenuId(null); setCommentSelectionMode(true); }}>댓글 선택</button>)}</div>
        <section className="community-comments"><div className="community-comments-heading"><h3>댓글 <span>{post.commentCount ?? comments.length}</span></h3></div><div>{comments.length ? comments.map((comment) => { const commentId = comment.id || comment.commentId; const commentKey = String(commentId); const editing = editingCommentId === commentId; const canManage = Boolean(comment.editable || comment.deletable || post.editable || post.deletable); const menuOpen = openCommentMenuId === commentKey; const selectedComment = selectedCommentIds.has(commentKey); return <article className={`${selectedComment ? "is-selected" : ""}${commentSelectionMode ? " is-selection-mode" : ""}`} key={commentId}>{commentSelectionMode && <label className="community-comment-check"><input type="checkbox" checked={selectedComment} onChange={() => toggleCommentSelection(commentId)} /><span>댓글 선택</span></label>}<div className="community-comment-head"><strong>{comment.authorNickname || comment.authorName || comment.nickname || comment.username || "여행자"}{comment.secret ? " · 비밀댓글" : ""}</strong><div className="community-comment-head-actions"><time>{relativeTime(comment.createdAt || comment.created_at)}</time>{!commentSelectionMode && canManage && <div className="community-comment-menu-wrap"><button className="community-comment-menu-trigger" type="button" aria-label="댓글 메뉴" aria-expanded={menuOpen} onClick={() => setOpenCommentMenuId(menuOpen ? null : commentKey)}>•••</button>{menuOpen && <div className="community-comment-menu">{comment.editable && <button type="button" onClick={() => startEditingComment(comment)}>수정</button>}<button className="is-danger" type="button" onClick={() => removeComment(comment)}>삭제</button></div>}</div>}</div></div>{editing ? <form className="community-comment-edit-form" onSubmit={(event) => editComment(event, comment)}><textarea value={editingCommentContent} maxLength="2000" onChange={(event) => setEditingCommentContent(event.target.value)} required /><div className="community-comment-compose-actions"><SecretCommentToggle checked={editingCommentSecret} onChange={(event) => setEditingCommentSecret(event.target.checked)} /><span className="community-comment-action-buttons"><button className="button" type="button" disabled={busy} onClick={cancelEditingComment}>취소</button><button className="button button-primary" type="submit" disabled={busy || !editingCommentContent.trim()}>저장</button></span></div></form> : <p>{comment.contentVisible === false ? "비밀댓글입니다." : comment.content}</p>}</article>; }) : <p className="empty-comment">첫 댓글을 남겨보세요.</p>}</div><form className="community-comment-form" onSubmit={addComment}><textarea name="content" maxLength="2000" placeholder="여행 이야기에 댓글을 남겨보세요" required /><div className="community-comment-compose-actions"><SecretCommentToggle name="secret" /><button className="button button-primary community-comment-submit" type="submit" disabled={busy}>댓글 등록</button></div></form><div className={`page-status${message || commentError ? " is-visible" : ""}${commentError ? " is-error" : ""}`}>{message || commentError}</div></section>
      </div>
    </>}</Status></article>
  </main>;
}
