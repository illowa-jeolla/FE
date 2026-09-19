import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createTravelComment, deleteTravelComment, deleteTravelPost, likeTravelPost, unlikeTravelPost, updateTravelComment } from "../api/travelPosts";
import { hasSession } from "../auth/session";
import { Status } from "../components/UI";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";
import AuthenticatedImage from "../components/AuthenticatedImage";
import EmojiPicker from "emoji-picker-react";

function relativeTime(value) { if (!value) return "방금"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "방금"; const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000)); if (minutes < 60) return `${minutes}분 전`; if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`; return `${Math.floor(minutes / 1440)}일 전`; }

function readLikedState(post) {
  const candidates = [post?.liked, post?.like, post?.isLiked, post?.isLikedByMe, post?.likedByMe, post?.viewerLiked, post?.hasLiked, post?.myLike, post?.likeStatus];
  const value = candidates.find((item) => typeof item === "boolean" || item === 0 || item === 1 || /^(liked|true|yes)$/i.test(String(item || "")));
  if (value === undefined) return undefined;
  return value === true || value === 1 || /^(liked|true|yes)$/i.test(String(value));
}

function SecretCommentToggle({ name, checked, onChange }) {
  return <label className={`community-secret-option${checked ? " is-active" : ""}`}>
    <input name={name} type="checkbox" checked={checked} onChange={onChange} />
    <span className="community-secret-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
    <span className="community-secret-copy"><strong>비밀댓글</strong><small>작성자와 게시글 주인만 볼 수 있어요</small></span>
    <i className="community-secret-switch" aria-hidden="true"><b /></i>
  </label>;
}

export default function CommunityDetailPage({ postId = "", onClose }) {
  const { id: routeId } = useParams(); const navigate = useNavigate();
  const id = postId || routeId;
  const { data: post, loading, error, run } = useApi(`/api/v1/community/travel-posts/${id}`);
  const { data: commentData, error: commentError, run: runComments } = useApi(`/api/v1/community/travel-posts/${id}/comments`);
  const [message, setMessage] = useState(""); const [activeImage, setActiveImage] = useState(0); const [liked, setLiked] = useState(false); const [heartLeaving, setHeartLeaving] = useState(false); const [likeCount, setLikeCount] = useState(0); const [busy, setBusy] = useState(false);
  const [galleryHovered, setGalleryHovered] = useState(false);
  const [galleryMove, setGalleryMove] = useState(null);
  const [openPostMenu, setOpenPostMenu] = useState(false);
  const [closing, setClosing] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState(null);
  const emojiPickerRef = useRef(null);
  const commentInputRef = useRef(null);
  const [editingCommentId, setEditingCommentId] = useState(null); const [editingCommentContent, setEditingCommentContent] = useState(""); const [editingCommentSecret, setEditingCommentSecret] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null); const [commentSelectionMode, setCommentSelectionMode] = useState(false); const [selectedCommentIds, setSelectedCommentIds] = useState(() => new Set());
  const valid = post && (post.id || post.postId || post.content || post.title); const fetchedComments = asList(commentData, "comments"); const comments = commentData != null ? fetchedComments : valid ? post.comments || [] : []; const images = valid ? postImages(post) : [];
  const allCommentsSelected = comments.length > 0 && comments.every((comment) => selectedCommentIds.has(String(comment.id || comment.commentId)));
  useEffect(() => { const serverLiked = readLikedState(post); if (serverLiked !== undefined) setLiked(serverLiked); }, [post]);
  useEffect(() => { if (post) setLikeCount(Number(post.likeCount ?? post.likesCount ?? 0) || 0); }, [post]);
  useEffect(() => {
    if (!heartLeaving) return undefined;
    const timer = window.setTimeout(() => setHeartLeaving(false), 360);
    return () => window.clearTimeout(timer);
  }, [heartLeaving]);
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
    if (!openPostMenu) return undefined;
    const closeMenu = (event) => { if (!(event.target instanceof Element) || !event.target.closest(".community-post-menu-wrap")) setOpenPostMenu(false); };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openPostMenu]);
  useEffect(() => {
    const submitOnEnter = (event) => {
      const textarea = event.target instanceof Element ? event.target.closest(".community-comment-form textarea, .community-comment-edit-form textarea, .community-post-modal-comment-form textarea") : null;
      if (!textarea || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      textarea.form?.requestSubmit();
    };
    document.addEventListener("keydown", submitOnEnter);
    return () => document.removeEventListener("keydown", submitOnEnter);
  }, []);
  useEffect(() => {
    if (!emojiOpen) return undefined;
    const closePicker = (event) => { if (!(event.target instanceof Element) || !emojiPickerRef.current?.contains(event.target)) setEmojiOpen(false); };
    document.addEventListener("pointerdown", closePicker);
    return () => document.removeEventListener("pointerdown", closePicker);
  }, [emojiOpen]);
  useEffect(() => {
    if (!onClose) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setClosing(true); };
    document.documentElement.classList.add("community-post-modal-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.documentElement.classList.remove("community-post-modal-open"); document.removeEventListener("keydown", closeOnEscape); };
  }, [onClose]);
  useEffect(() => {
    if (!closing || !onClose) return undefined;
    const timer = window.setTimeout(onClose, 280);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);

  function requireLogin() { if (hasSession()) return true; setMessage("로그인 후 이용할 수 있어요."); return false; }
  async function addComment(event) { event.preventDefault(); if (!requireLogin()) return; const form = event.currentTarget; const formData = new FormData(form); const content = String(formData.get("content") || "").trim(); const secret = formData.get("secret") === "on"; if (!content) return; setBusy(true); try { await createTravelComment(id, content, secret); form.reset(); if (commentInputRef.current) { commentInputRef.current.style.height = "22px"; commentInputRef.current.style.overflowY = "hidden"; } setEmojiOpen(false); await Promise.all([run(), runComments()]); setMessage("댓글을 등록했습니다."); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function insertEmoji(emoji) { const input = commentInputRef.current; if (!input) return; const start = input.selectionStart ?? input.value.length; const end = input.selectionEnd ?? start; input.setRangeText(emoji, start, end, "end"); input.focus(); setEmojiOpen(false); }
  function growCommentInput(event) { const input = event.currentTarget; const maxHeight = 98; input.style.height = "22px"; const nextHeight = Math.min(input.scrollHeight, maxHeight); input.style.height = `${nextHeight}px`; input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden"; }
  function startEditingComment(comment) { setOpenCommentMenuId(null); setEditingCommentId(comment.id || comment.commentId); setEditingCommentContent(comment.content || ""); setEditingCommentSecret(Boolean(comment.secret)); }
  function cancelEditingComment() { setEditingCommentId(null); setEditingCommentContent(""); setEditingCommentSecret(false); }
  async function editComment(event, comment) { event.preventDefault(); if (!requireLogin() || !editingCommentContent.trim()) return; setBusy(true); try { await updateTravelComment(id, comment.id || comment.commentId, editingCommentContent.trim(), editingCommentSecret); cancelEditingComment(); setMessage("댓글을 수정했습니다."); await Promise.all([run(), runComments()]); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function removeComment(comment) { setOpenCommentMenuId(null); if (!requireLogin()) return; setDeleteCommentTarget(comment); }
  async function confirmDeleteComment() { if (!deleteCommentTarget || busy) return; setBusy(true); try { await deleteTravelComment(id, deleteCommentTarget.id || deleteCommentTarget.commentId); setDeleteCommentTarget(null); setMessage("댓글을 삭제했습니다."); await Promise.all([run(), runComments()]); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function toggleCommentSelection(commentId) { setSelectedCommentIds((current) => { const next = new Set(current); const key = String(commentId); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  function selectAllComments() { setSelectedCommentIds(allCommentsSelected ? new Set() : new Set(comments.map((comment) => String(comment.id || comment.commentId)))); }
  function cancelCommentSelection() { setCommentSelectionMode(false); setSelectedCommentIds(new Set()); }
  async function deleteSelectedComments() { if (!selectedCommentIds.size || !window.confirm(`선택한 댓글 ${selectedCommentIds.size}개를 삭제할까요?`)) return; setBusy(true); let failed = 0; for (const commentId of selectedCommentIds) { try { await deleteTravelComment(id, commentId); } catch { failed += 1; } } await Promise.all([run(), runComments()]); if (failed) setMessage(`${selectedCommentIds.size - failed}개를 삭제했고, ${failed}개는 삭제하지 못했습니다.`); else setMessage("선택한 댓글을 삭제했습니다."); cancelCommentSelection(); setBusy(false); }
  async function toggleLike() {
    if (!requireLogin() || busy) return;
    const wasLiked = liked;
    const previousCount = likeCount;
    setBusy(true); setMessage(""); setLiked(!wasLiked); setHeartLeaving(wasLiked); setLikeCount(Math.max(0, previousCount + (wasLiked ? -1 : 1)));
    try {
      if (wasLiked) await unlikeTravelPost(id);
      else await likeTravelPost(id);
    } catch (error) {
      const text = String(error?.message || "");
      if (!wasLiked && /이미.*좋아요|좋아요.*이미/.test(text)) {
        try { await unlikeTravelPost(id); setLiked(false); setHeartLeaving(true); setLikeCount(Math.max(0, previousCount - 1)); } catch { setLiked(wasLiked); setHeartLeaving(false); setLikeCount(previousCount); }
      } else {
        setLiked(wasLiked); setHeartLeaving(false); setLikeCount(previousCount);
      }
    } finally { setBusy(false); }
  }
  async function removePost() { if (!requireLogin() || !window.confirm("이 게시글을 삭제할까요?")) return; setBusy(true); try { await deleteTravelPost(id); if (onClose) onClose(); else navigate("/community"); } catch (e) { setMessage(e.message); setBusy(false); } }
  function moveGallery(direction) {
    if (images.length < 2 || galleryMove) return;
    setGalleryMove({ from: activeImage, to: (activeImage + direction + images.length) % images.length, direction });
  }
  function finishGallerySlide() { if (!galleryMove) return; setActiveImage(galleryMove.to); setGalleryMove(null); }
  function selectGalleryImage(index) { if (galleryMove) return; setActiveImage(index); }

  if (onClose) return <div className={`community-post-modal${closing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label="여행 게시글 상세 보기">
    <button className="community-post-modal-backdrop" type="button" aria-label="게시글 닫기" onClick={() => setClosing(true)} />
    <button className="community-post-modal-close" type="button" aria-label="게시글 닫기" onClick={() => setClosing(true)}>×</button>
    <div className="community-post-modal-shell">
      <section className="community-post-modal-dialog">
      <Status loading={loading} error={error} empty={!valid}>{valid && <div className="community-post-modal-layout">
        <section className="community-post-modal-media" onMouseEnter={() => setGalleryHovered(true)} onMouseLeave={() => setGalleryHovered(false)}>
          {images.length ? <><div className={`community-detail-slides${galleryMove ? galleryMove.direction > 0 ? " is-moving-next" : " is-moving-prev" : ""}`}>{galleryMove ? <><AuthenticatedImage className="community-detail-image is-outgoing" src={images[galleryMove.from]} alt="" /><AuthenticatedImage className="community-detail-image is-incoming" src={images[galleryMove.to]} alt={`${post.regionName || "전라도"} 여행 사진 ${galleryMove.to + 1}`} onAnimationEnd={finishGallerySlide} /></> : <AuthenticatedImage className="community-detail-image is-current" src={images[activeImage]} alt={`${post.regionName || "전라도"} 여행 사진 ${activeImage + 1}`} />}</div>{images.length > 1 && <><button className="community-gallery-arrow is-prev" type="button" aria-label="이전 사진" onClick={() => moveGallery(-1)}>‹</button><button className="community-gallery-arrow is-next" type="button" aria-label="다음 사진" onClick={() => moveGallery(1)}>›</button><div className="community-post-modal-dots">{images.map((image, index) => <button type="button" className={(galleryMove?.to ?? activeImage) === index ? "is-active" : ""} aria-label={`${index + 1}번째 사진 보기`} onClick={() => selectGalleryImage(index)} key={`${image.slice(-32)}-${index}`} />)}</div></>}</> : <div className="community-detail-image post-image-fallback" />}
        </section>
        <aside className="community-post-modal-panel">
          <header className="community-post-modal-author"><div className="community-detail-avatar" aria-hidden="true">{(post.authorNickname || post.authorName || post.nickname || post.username || "여").slice(0,1)}</div><strong>{post.authorNickname || post.authorName || post.nickname || post.username || "여행자"}</strong><span>{post.regionName || post.region?.name || "전라도"}</span><div className="community-post-menu-wrap"><button className="community-post-menu-trigger" type="button" aria-label="게시글 메뉴" aria-expanded={openPostMenu} onClick={() => setOpenPostMenu((open) => !open)}>•••</button>{openPostMenu && (post.editable || post.deletable) && <div className="community-post-menu">{post.editable && <Link to={`/community/${id}/edit`}>수정</Link>}{post.deletable && <button className="is-danger" type="button" disabled={busy} onClick={removePost}>삭제</button>}</div>}</div></header>
          <div className="community-post-modal-scroll">
            <article className="community-post-modal-caption"><div><h2>{post.title || post.concept || "지금의 여행"}</h2>{post.content && <p>{post.content}</p>}<time>{relativeTime(post.createdAt || post.created_at)}</time></div></article>
            <section className="community-post-modal-comments" aria-label="댓글 목록">{comments.length ? comments.map((comment) => { const commentId = comment.id || comment.commentId; const commentKey = String(commentId); const editing = editingCommentId === commentId; const canManage = Boolean(comment.editable || comment.deletable || post.editable || post.deletable); const menuOpen = openCommentMenuId === commentKey; return <article key={commentId}><div className="community-detail-avatar" aria-hidden="true">{(comment.authorNickname || comment.authorName || comment.nickname || comment.username || "여").slice(0,1)}</div><div><div className="community-post-modal-comment-head"><strong>{comment.authorNickname || comment.authorName || comment.nickname || comment.username || "여행자"}</strong>{canManage && <div className="community-comment-menu-wrap"><button className="community-comment-menu-trigger" type="button" aria-label="댓글 메뉴" onClick={() => setOpenCommentMenuId(menuOpen ? null : commentKey)}>•••</button>{menuOpen && <div className="community-comment-menu">{comment.editable && <button type="button" onClick={() => startEditingComment(comment)}>수정</button>}<button className="is-danger" type="button" onClick={() => removeComment(comment)}>삭제</button></div>}</div>}</div>{editing ? <form className="community-comment-edit-form" onSubmit={(event) => editComment(event, comment)}><textarea value={editingCommentContent} maxLength="2000" onChange={(event) => setEditingCommentContent(event.target.value)} required /><div className="community-post-modal-edit-actions"><button type="button" onClick={cancelEditingComment}>취소</button><button type="submit" disabled={busy || !editingCommentContent.trim()}>저장</button></div></form> : <p>{comment.contentVisible === false ? "비밀댓글입니다." : comment.content}</p>}<time>{relativeTime(comment.createdAt || comment.created_at)}{comment.secret ? " · 비밀댓글" : ""}</time></div></article>; }) : <p className="community-post-modal-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>}</section>
          </div>
          <footer className="community-post-modal-footer"><div className="community-post-modal-actions"><button className={liked ? "is-liked" : heartLeaving ? "is-unliking" : ""} type="button" disabled={busy} aria-label={liked ? "좋아요 취소" : "좋아요"} onClick={toggleLike}>{liked || heartLeaving ? "♥" : "♡"}</button><strong>좋아요 {likeCount}개 · 댓글 {post.commentCount ?? comments.length}개</strong></div><form className="community-post-modal-comment-form" onSubmit={addComment}><div className="community-emoji-wrap" ref={emojiPickerRef}><button className="community-emoji-trigger" type="button" aria-label="이모지 선택" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((open) => !open)}>☺</button>{emojiOpen && <div className="community-emoji-picker"><EmojiPicker width={255} height={315} lazyLoadEmojis searchPlaceHolder="이모지 검색" previewConfig={{ showPreview: false }} onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)} /></div>}</div><textarea ref={commentInputRef} name="content" maxLength="2000" rows="1" placeholder="댓글 달기..." aria-label="댓글 내용" onInput={growCommentInput} required /><button type="submit" disabled={busy}>게시</button></form>{(message || commentError) && <p className="community-post-modal-message" role="status">{message || commentError}</p>}</footer>
        </aside>
      </div>}</Status>
      </section>
    </div>
    {deleteCommentTarget && <div className="community-comment-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="community-comment-delete-title"><button className="community-comment-delete-backdrop" type="button" aria-label="댓글 삭제 창 닫기" onClick={() => setDeleteCommentTarget(null)} /><section className="community-comment-delete-dialog"><div className="community-comment-delete-icon" aria-hidden="true">🗑</div><h3 id="community-comment-delete-title">댓글을 삭제할까요?</h3><p>삭제한 댓글은 다시 복구할 수 없어요.</p><div><button type="button" disabled={busy} onClick={() => setDeleteCommentTarget(null)}>취소</button><button className="is-danger" type="button" disabled={busy} onClick={confirmDeleteComment}>삭제하기</button></div></section></div>}
  </div>;

  return <main className="community-detail-main">
    <Link className="community-detail-back" to="/community"><span aria-hidden="true">←</span> 여행 공유</Link>
    <article className="community-detail-card"><Status loading={loading} error={error} empty={!valid}>{valid && <>
      <div className="community-detail-authorbar"><div className="community-detail-avatar" aria-hidden="true">{(post.authorNickname || post.authorName || post.nickname || post.username || "여").slice(0,1)}</div><div><strong>{post.authorNickname || post.authorName || post.nickname || post.username || "여행자"}</strong><span>· {relativeTime(post.createdAt || post.created_at)}</span></div><div className="community-detail-owner-actions">{post.editable && <Link to={`/community/${id}/edit`}>수정</Link>}{post.deletable && <button type="button" disabled={busy} onClick={removePost}>삭제</button>}{!post.editable && !post.deletable && <span aria-hidden="true">•••</span>}</div></div>
      {images.length ? <div className="community-detail-gallery" onMouseEnter={() => setGalleryHovered(true)} onMouseLeave={() => setGalleryHovered(false)} onFocus={() => setGalleryHovered(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setGalleryHovered(false); }}><div className="community-detail-stage"><div className={`community-detail-slides${galleryMove ? galleryMove.direction > 0 ? " is-moving-next" : " is-moving-prev" : ""}`}>{galleryMove ? <><AuthenticatedImage className="community-detail-image is-outgoing" src={images[galleryMove.from]} alt="" /><AuthenticatedImage className="community-detail-image is-incoming" src={images[galleryMove.to]} alt={`${post.regionName || "전라도"} 여행 사진 ${galleryMove.to + 1}`} onAnimationEnd={finishGallerySlide} /></> : <AuthenticatedImage className="community-detail-image is-current" src={images[activeImage]} alt={`${post.regionName || "전라도"} 여행 사진 ${activeImage + 1}`} />}</div>{images.length > 1 && <><button className="community-gallery-arrow is-prev" type="button" aria-label="이전 사진" onClick={() => moveGallery(-1)}>‹</button><button className="community-gallery-arrow is-next" type="button" aria-label="다음 사진" onClick={() => moveGallery(1)}>›</button></>}</div>{images.length > 1 && <div className="community-detail-thumbs">{images.map((image, index) => <button type="button" className={(galleryMove?.to ?? activeImage) === index ? "is-active" : ""} aria-label={`${index + 1}번째 사진 보기`} onClick={() => selectGalleryImage(index)} key={`${image.slice(-40)}-${index}`} />)}</div>}</div> : <div className="community-detail-image post-image-fallback" />}
      <div className="community-detail-content"><div className="community-detail-headline"><h1>{post.title || post.concept || "지금의 여행"}</h1><span>{post.regionName || post.region?.name || "전라도"}</span></div><div className="community-detail-meta"><span>조회 {post.viewCount || 0}</span><time>{relativeTime(post.createdAt || post.created_at)}</time></div>{post.concept && <p className="eyebrow dark community-detail-concept">{post.concept}</p>}<p className="community-detail-copy">{post.content}</p>
        <div className="community-engagement-row"><button className={`community-like-button${liked ? " is-liked" : ""}`} type="button" disabled={busy} onClick={toggleLike}>{liked ? "♥" : "♡"} 좋아요 {post.likeCount || 0}</button>{(post.editable || post.deletable) && (commentSelectionMode ? <div className="community-comment-selection-bar"><button type="button" onClick={selectAllComments}>모두 선택</button><button className="is-danger" type="button" disabled={!selectedCommentIds.size || busy} onClick={deleteSelectedComments}>선택 삭제</button><button type="button" disabled={busy} onClick={cancelCommentSelection}>취소</button></div> : <button className="community-comment-select-trigger" type="button" disabled={busy || !comments.length} onClick={() => { setOpenCommentMenuId(null); setCommentSelectionMode(true); }}>댓글 선택</button>)}</div>
        <section className="community-comments"><div className="community-comments-heading"><h3>댓글 <span>{post.commentCount ?? comments.length}</span></h3></div><div>{comments.length ? comments.map((comment) => { const commentId = comment.id || comment.commentId; const commentKey = String(commentId); const editing = editingCommentId === commentId; const canManage = Boolean(comment.editable || comment.deletable || post.editable || post.deletable); const menuOpen = openCommentMenuId === commentKey; const selectedComment = selectedCommentIds.has(commentKey); return <article className={`${selectedComment ? "is-selected" : ""}${commentSelectionMode ? " is-selection-mode" : ""}`} key={commentId}>{commentSelectionMode && <label className="community-comment-check"><input type="checkbox" checked={selectedComment} onChange={() => toggleCommentSelection(commentId)} /><span>댓글 선택</span></label>}<div className="community-comment-head"><strong>{comment.authorNickname || comment.authorName || comment.nickname || comment.username || "여행자"}{comment.secret ? " · 비밀댓글" : ""}</strong><div className="community-comment-head-actions"><time>{relativeTime(comment.createdAt || comment.created_at)}</time>{!commentSelectionMode && canManage && <div className="community-comment-menu-wrap"><button className="community-comment-menu-trigger" type="button" aria-label="댓글 메뉴" aria-expanded={menuOpen} onClick={() => setOpenCommentMenuId(menuOpen ? null : commentKey)}>•••</button>{menuOpen && <div className="community-comment-menu">{comment.editable && <button type="button" onClick={() => startEditingComment(comment)}>수정</button>}<button className="is-danger" type="button" onClick={() => removeComment(comment)}>삭제</button></div>}</div>}</div></div>{editing ? <form className="community-comment-edit-form" onSubmit={(event) => editComment(event, comment)}><textarea value={editingCommentContent} maxLength="2000" onChange={(event) => setEditingCommentContent(event.target.value)} required /><div className="community-comment-compose-actions"><SecretCommentToggle checked={editingCommentSecret} onChange={(event) => setEditingCommentSecret(event.target.checked)} /><span className="community-comment-action-buttons"><button className="button" type="button" disabled={busy} onClick={cancelEditingComment}>취소</button><button className="button button-primary" type="submit" disabled={busy || !editingCommentContent.trim()}>저장</button></span></div></form> : <p>{comment.contentVisible === false ? "비밀댓글입니다." : comment.content}</p>}</article>; }) : <p className="empty-comment">첫 댓글을 남겨보세요.</p>}</div><form className="community-comment-form" onSubmit={addComment}><textarea name="content" maxLength="2000" placeholder="여행 이야기에 댓글을 남겨보세요" required /><div className="community-comment-compose-actions"><SecretCommentToggle name="secret" /><button className="button button-primary community-comment-submit" type="submit" disabled={busy}>댓글 등록</button></div></form><div className={`page-status${message || commentError ? " is-visible" : ""}${commentError ? " is-error" : ""}`}>{message || commentError}</div></section>
      </div>
    </>}</Status></article>
  </main>;
}
