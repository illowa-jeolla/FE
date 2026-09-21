import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Status } from "../components/UI";
import { asList, useApi } from "../hooks/useApi";
import { postImages } from "./communityUtils";
import AuthenticatedImage from "../components/AuthenticatedImage";
import CommunityDetailPage from "./CommunityDetailPage";
import { getRegions } from "../api/regions";
import { publishTravelPostDraft, saveTravelPostDraft, startTravelPostDraft, uploadTravelPostDraftImage } from "../api/travelPosts";

let communityPageCache = null;

function PostCard({ post, onOpen }) {
  const images = postImages(post);
  const postId = post.postId || post.id;
  return <button className="post-card" type="button" onClick={() => onOpen(postId)}><div className="community-post-visual">{images[0] ? <AuthenticatedImage src={images[0]} alt="" /> : <div className="post-image-fallback" aria-hidden="true" />}<time>{(post.createdAt || post.created_at)?.slice?.(0, 10)}</time><span>{post.regionName || post.region?.name || "전라도"}</span></div><div className="post-body"><h3>{post.title || post.concept || "전라도 여행 이야기"}</h3><p>{post.contentPreview || post.content}</p><div className="post-card-footer"><span>@{post.authorNickname || post.authorName || post.nickname || post.username || "여행자"}</span><span>조회 {post.viewCount || 0} · 댓글 {post.commentCount || post.comment_count || 0}</span></div></div></button>;
}

export default function CommunityPage() {
  const location = useLocation(); const navigate = useNavigate();
  const postsSectionRef = useRef(null);
  const heroRef = useRef(null);
  const mediaInputRef = useRef(null);
  const cropVideoRef = useRef(null);
  const composeFormRef = useRef(null);
  const composeRegionRef = useRef(null);
  const floatingWriteRequestedRef = useRef(false);
  const floatingWriteReachedPostsRef = useRef(false);
  const floatingWriteLeftTopRef = useRef(false);
  const [savedToast, setSavedToast] = useState(Boolean(location.state?.draftSaved));
  const [showFloatingWrite, setShowFloatingWrite] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [mediaRatio, setMediaRatio] = useState("original");
  const [ratioOpen, setRatioOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [deleteMediaIndex, setDeleteMediaIndex] = useState(null);
  const [discardPostOpen, setDiscardPostOpen] = useState(false);
  const [composeStep, setComposeStep] = useState(false);
  const [regions, setRegions] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishComplete, setPublishComplete] = useState(false);
  const [publishLeaving, setPublishLeaving] = useState(false);
  const [composeMessage, setComposeMessage] = useState("");
  const [composeRegionOpen, setComposeRegionOpen] = useState(false);
  const [composeRegionQuery, setComposeRegionQuery] = useState("");
  const [composeRegionId, setComposeRegionId] = useState("");
  const [returningToDropzone, setReturningToDropzone] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(() => new URLSearchParams(location.search).get("post") || "");
  const path = "/api/v1/community/travel-posts?page=0&size=12&sort=createdAt,desc";
  const { data, loading, error, run, setData } = useApi(null, { immediate: false });
  const posts = Array.isArray(data?.content) ? data.content : asList(data, "posts");
  const sortedPosts = [...posts].sort((left, right) => {
    const rightTime = new Date(right.createdAt || right.created_at || 0).getTime() || 0;
    const leftTime = new Date(left.createdAt || left.created_at || 0).getTime() || 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return Number(right.postId || right.id || 0) - Number(left.postId || left.id || 0);
  });
  const displayedPosts = sortedPosts;
  const postColumns = [[], [], []];
  displayedPosts.forEach((post, index) => postColumns[index % 3].push(post));
  useEffect(() => {
    setSelectedPostId(new URLSearchParams(location.search).get("post") || "");
  }, [location.search]);
  useEffect(() => {
    if (communityPageCache?.data) setData(communityPageCache.data);
    run(path).then((result) => { communityPageCache = { data: result }; }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!new URLSearchParams(location.search).get("post")) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);
  useEffect(() => {
    document.documentElement.classList.add("community-scroll-hidden");
    return () => document.documentElement.classList.remove("community-scroll-hidden");
  }, []);
  useEffect(() => {
    const cards = postsSectionRef.current?.querySelectorAll(".post-card");
    if (!cards?.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px 12% 0px" });
    cards.forEach((card, index) => {
      card.style.setProperty("--community-reveal-delay", `${(index % 6) * 55}ms`);
      observer.observe(card);
    });
    const visibilityFallback = window.setTimeout(() => {
      cards.forEach((card) => card.classList.add("is-visible"));
      observer.disconnect();
    }, 700);
    return () => {
      window.clearTimeout(visibilityFallback);
      observer.disconnect();
    };
  }, [displayedPosts.length]);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;
    let frame = 0;
    const updateFloatingWrite = () => {
      frame = 0;
      const bounds = hero.getBoundingClientRect();
      if (bounds.bottom <= 76) floatingWriteReachedPostsRef.current = true;
      if (window.scrollY > 100) floatingWriteLeftTopRef.current = true;
      if (floatingWriteLeftTopRef.current && window.scrollY <= 2) {
        floatingWriteRequestedRef.current = false;
        floatingWriteReachedPostsRef.current = false;
        floatingWriteLeftTopRef.current = false;
      }
      setShowFloatingWrite(floatingWriteRequestedRef.current || bounds.bottom <= 76);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateFloatingWrite);
    };
    updateFloatingWrite();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  function exploreStories() {
    floatingWriteRequestedRef.current = true;
    setShowFloatingWrite(true);
    postsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function continueWithMedia(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")).slice(0, 5);
    if (!files.length) return;
    setReturningToDropzone(false);
    setSelectedMedia((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file), mediaType: file.type.startsWith("video/") ? "video" : "image" }))].slice(0, 5));
  }
  function toggleCropVideo() {
    const video = cropVideoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }
  function confirmMediaDelete() {
    if (deleteMediaIndex === null) return;
    if (selectedMedia.length === 1) setReturningToDropzone(true);
    setSelectedMedia((current) => {
      const target = current[deleteMediaIndex];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return current.filter((_, index) => index !== deleteMediaIndex);
    });
    setActiveMediaIndex((current) => Math.max(0, current > deleteMediaIndex ? current - 1 : Math.min(current, selectedMedia.length - 2)));
    setVideoPlaying(false);
    setDeleteMediaIndex(null);
  }
  function requestUploadClose() {
    if (ratioOpen) {
      setRatioOpen(false);
      return;
    }
    if (selectedMedia.length) setDiscardPostOpen(true);
    else setUploadOpen(false);
  }
  function discardUploadPost() {
    selectedMedia.forEach((item) => { if (item.preview) URL.revokeObjectURL(item.preview); });
    setSelectedMedia([]);
    setActiveMediaIndex(0);
    setVideoPlaying(false);
    setRatioOpen(false);
    setDiscardPostOpen(false);
    setComposeStep(false);
    setUploadOpen(false);
  }
  async function openComposeStep() {
    setComposeStep(true);
    setComposeMessage("");
    if (regions.length) return;
    try { setRegions(asList(await getRegions(), "regions")); }
    catch (requestError) { setComposeMessage(requestError.message); }
  }
  async function publishPost(event) {
    event?.preventDefault();
    const form = composeFormRef.current;
    if (!form || publishing) return;
    const values = Object.fromEntries(new FormData(form));
    if (!values.title?.trim() || !values.regionId || !values.content?.trim()) { setComposeMessage("제목, 지역, 여행 내용을 입력해 주세요."); return; }
    setPublishing(true); setPublishComplete(false); setPublishLeaving(false); setComposeMessage("여행 기록을 공유하는 중입니다.");
    try {
      const draft = await startTravelPostDraft();
      const draftId = draft?.draftId || draft?.postId || draft?.id;
      if (!draftId) throw new Error("게시글을 준비하지 못했습니다.");
      const imageIds = [];
      for (const media of selectedMedia) {
        const uploaded = await uploadTravelPostDraftImage(draftId, media.file);
        imageIds.push(uploaded.imageId || uploaded.id);
      }
      await saveTravelPostDraft(draftId, { regionId: Number(values.regionId), title: values.title.trim(), concept: values.concept?.trim() || "", content: values.content.trim(), imageIds });
      const result = await publishTravelPostDraft(draftId);
      communityPageCache = null;
      const refreshedPosts = await run(path);
      communityPageCache = { data: refreshedPosts };
      selectedMedia.forEach((item) => { if (item.preview) URL.revokeObjectURL(item.preview); });
      setComposeMessage(""); setPublishComplete(true);
      await new Promise((resolve) => window.setTimeout(resolve, 950));
      setPublishLeaving(true);
      await new Promise((resolve) => window.setTimeout(resolve, 460));
      const publishedId = result.postId || draftId;
      setUploadOpen(false); setSelectedMedia([]); setComposeStep(false); setPublishing(false); setPublishComplete(false); setPublishLeaving(false); setSelectedPostId(String(publishedId));
      navigate(`/community?post=${encodeURIComponent(publishedId)}`, { replace: true });
    } catch (requestError) { setComposeMessage(requestError.message); setPublishing(false); setPublishComplete(false); setPublishLeaving(false); }
  }
  useEffect(() => {
    if (!savedToast) return undefined;
    navigate(location.pathname, { replace: true, state: null });
    const timer = window.setTimeout(() => setSavedToast(false), 2600);
    return () => window.clearTimeout(timer);
  }, [location.pathname, navigate, savedToast]);
  useEffect(() => {
    if (!composeRegionOpen) return undefined;
    const close = (event) => { if (!composeRegionRef.current?.contains(event.target)) setComposeRegionOpen(false); };
    const escape = (event) => { if (event.key === "Escape") setComposeRegionOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [composeRegionOpen]);
  return <main className="community-page-main">
    {savedToast && <div className="community-saved-toast" role="status"><span>✓</span>저장되었습니다</div>}
    <section className="community-story-hero" ref={heroRef}>
      <div className="community-story-hero-visual" aria-hidden="true"><i /><i /><i /></div>
      <div className="community-story-hero-copy">
        <p>TRAVEL STORIES · JEOLLA</p>
        <h1>머문 사람들의 시선으로<br />전라도를 들여다봐요</h1>
        <span>낯선 골목에서 발견한 풍경부터 오래 기억하고 싶은 여행의 순간까지.<br />여행자들이 직접 남긴 전라도 이야기를 만나보세요.</span>
        <div>
          <button type="button" onClick={exploreStories}>여행 들여다보기 <b>↓</b></button>
          <button type="button" onClick={() => setUploadOpen(true)}>나의 여행 올리기 <b>＋</b></button>
        </div>
      </div>
    </section>
    <section className="community-stories-section" id="community-stories" ref={postsSectionRef}>
      <Status loading={loading} error={error} empty={!displayedPosts.length}>
        <div className="post-feed">{postColumns.map((column, columnIndex) => <div className="post-feed-column" key={columnIndex}>{column.map((post) => <PostCard post={post} onOpen={(postId) => { setSelectedPostId(String(postId)); navigate(`/community?post=${encodeURIComponent(postId)}`); }} key={post.postId || post.id} />)}</div>)}</div>
      </Status>
    </section>
    <button className={`community-floating-write${showFloatingWrite ? " is-visible" : ""}`} type="button" onClick={() => setUploadOpen(true)} aria-hidden={!showFloatingWrite} tabIndex={showFloatingWrite ? 0 : -1}><span>＋</span>여행 올리기</button>
    {uploadOpen && <div className="community-media-modal" role="dialog" aria-modal="true" aria-labelledby="community-media-title">
      <button className="community-media-backdrop" type="button" aria-label="업로드 창 닫기" onClick={requestUploadClose} />
      <section className={`community-media-dialog${selectedMedia.length ? " is-crop-step" : ""}${composeStep ? " is-compose-step" : ""}${publishLeaving ? " is-publish-leaving" : ""}`}>
        <header>{selectedMedia.length ? <button className="community-media-back" type="button" aria-label="이전" onClick={() => { if (composeStep) setComposeStep(false); else requestUploadClose(); }}>←</button> : null}<h2 id="community-media-title">{composeStep ? "새 여행 기록 만들기" : selectedMedia.length ? "자르기" : "새 여행 기록 만들기"}</h2>{selectedMedia.length ? composeStep ? <button className="community-media-header-next" type="button" disabled={publishing} onClick={publishPost}>{publishing ? "공유 중" : "공유하기"}</button> : <button className="community-media-header-next" type="button" onClick={openComposeStep}>다음</button> : <button type="button" aria-label="닫기" onClick={requestUploadClose}>×</button>}</header>
        {composeStep ? <div className="community-compose-layout">
          <section className="community-compose-media" aria-label="선택한 여행 미디어">
            <div className="community-compose-media-backdrop" aria-hidden="true">{selectedMedia[activeMediaIndex]?.mediaType === "video" ? <video src={selectedMedia[activeMediaIndex]?.preview} muted playsInline /> : <img src={selectedMedia[activeMediaIndex]?.preview} alt="" />}</div>
            <div className={`community-compose-frame ratio-${mediaRatio.replace(":", "-")}`}>{selectedMedia[activeMediaIndex]?.mediaType === "video" ? <video src={selectedMedia[activeMediaIndex]?.preview} controls playsInline /> : <img src={selectedMedia[activeMediaIndex]?.preview} alt="게시할 여행 사진" />}</div>
            <div className="community-compose-thumbnails">{selectedMedia.map((item, index) => <button className={activeMediaIndex === index ? "is-active" : ""} type="button" key={item.preview} onClick={() => setActiveMediaIndex(index)}>{item.mediaType === "video" ? <video src={item.preview} muted /> : <img src={item.preview} alt="" />}</button>)}</div>
          </section>
          <form className="community-compose-form" ref={composeFormRef} onSubmit={publishPost} autoComplete="off">
            <label className="community-compose-title"><span>제목</span><input name="title" maxLength="200" placeholder="여행 제목을 입력해 주세요" autoComplete="new-password" required /></label>
            <div className={`community-compose-region travel-search-region${composeRegionOpen ? " is-open" : ""}`} ref={composeRegionRef}>
              <span>지역</span><input type="hidden" name="regionId" value={composeRegionId} />
              <button className="travel-region-select" type="button" aria-expanded={composeRegionOpen} onClick={() => { setComposeRegionQuery(""); setComposeRegionOpen((open) => !open); }}><strong className={composeRegionId ? "" : "travel-region-placeholder"}>{regions.find((region) => String(region.regionId || region.id) === String(composeRegionId))?.name || "지역 선택"}</strong><i className="travel-region-chevron" aria-hidden="true"><i /></i></button>
              {composeRegionOpen && <section className="travel-region-picker" aria-label="전라도 지역 선택"><label className="travel-region-search"><i aria-hidden="true" /><input value={composeRegionQuery} onChange={(event) => setComposeRegionQuery(event.target.value)} placeholder="지역 이름 검색" autoFocus /></label><div className="travel-region-options">{regions.filter((region) => region.name.toLocaleLowerCase().includes(composeRegionQuery.trim().toLocaleLowerCase())).map((region, index) => { const id = region.regionId || region.id; return <button className={String(id) === String(composeRegionId) ? "is-selected" : ""} style={{ "--region-index": index }} type="button" key={id || region.name} onClick={() => { setComposeRegionId(String(id)); setComposeRegionOpen(false); setComposeRegionQuery(""); }}><span>{region.name}</span>{String(id) === String(composeRegionId) && <i>✓</i>}</button>; })}</div></section>}
            </div>
            <label><span>여행 콘셉트</span><input name="concept" maxLength="100" placeholder="예: 노을 드라이브" autoComplete="new-password" /></label>
            <label className="community-compose-content"><span>여행 내용</span><textarea name="content" maxLength="2200" placeholder="현장의 분위기와 여행 팁을 남겨보세요." required /></label>
            <div className="community-compose-count">최대 2,200자</div>
            {composeMessage && <p className="community-compose-message" role="status">{composeMessage}</p>}
          </form>
        </div> : <div className={`community-media-dropzone${dragActive ? " is-dragging" : ""}${selectedMedia.length ? " has-media" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragActive(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDrop={(event) => { event.preventDefault(); setDragActive(false); continueWithMedia(event.dataTransfer.files); }}>
          {selectedMedia.length ? <div className="community-crop-editor" onClick={() => { if (ratioOpen) setRatioOpen(false); }}>
            {dragActive && <div className="community-crop-drop-overlay"><div className="community-media-icon" aria-hidden="true"><span>▧</span><b>▷</b></div><h3>사진이나 동영상을 여기에 놓으세요</h3><p>기존 파일 뒤에 이어서 추가됩니다.</p></div>}
            <div className={`community-crop-stage${mediaRatio !== "original" ? " is-cropping" : ""}`}>
              {mediaRatio !== "original" && (selectedMedia[activeMediaIndex]?.mediaType === "video" ? <video className="community-crop-context" src={selectedMedia[activeMediaIndex]?.preview} muted playsInline aria-hidden="true" /> : <img className="community-crop-context" src={selectedMedia[activeMediaIndex]?.preview} alt="" aria-hidden="true" />)}
              <div className={`community-crop-frame ratio-${mediaRatio.replace(":", "-")}`}>{selectedMedia[activeMediaIndex]?.mediaType === "video" ? <><video ref={cropVideoRef} src={selectedMedia[activeMediaIndex]?.preview} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} loop playsInline onPlay={() => setVideoPlaying(true)} onPause={() => setVideoPlaying(false)} /><button className={`community-video-toggle${videoPlaying ? " is-playing" : ""}`} type="button" aria-label={videoPlaying ? "동영상 정지" : "동영상 재생"} onClick={toggleCropVideo}>{videoPlaying ? "Ⅱ" : "▶"}</button></> : <img src={selectedMedia[activeMediaIndex]?.preview} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} alt="현재 선택한 여행 사진" />}</div>
            </div>
            <div className="community-crop-thumbnails">{selectedMedia.map((item, index) => <div className={`community-crop-thumbnail${activeMediaIndex === index ? " is-active" : ""}`} key={item.preview}><button className="community-crop-thumbnail-select" type="button" onClick={() => { setActiveMediaIndex(index); setVideoPlaying(false); }}>{item.mediaType === "video" ? <video src={item.preview} muted /> : <img src={item.preview} alt={`선택한 여행 미디어 ${index + 1}`} />}</button><button className="community-crop-thumbnail-delete" type="button" aria-label={`${index + 1}번째 미디어 삭제`} onClick={() => setDeleteMediaIndex(index)}>×</button></div>)}{selectedMedia.length < 5 && <button className="is-add" type="button" onClick={() => mediaInputRef.current?.click()}>＋</button>}</div>
            <div className="community-crop-actions"><div className="community-ratio-control" onClick={(event) => event.stopPropagation()}><button className="community-ratio-marker-button" type="button" aria-label="사진 비율 선택" onClick={() => setRatioOpen((open) => !open)}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 9H9v7M32 9h7v7M39 32v7h-7M16 39H9v-7" /></svg></button>{ratioOpen && <div>{["original", "1:1", "9:16", "16:9"].map((ratio) => <button className={mediaRatio === ratio ? "is-active" : ""} type="button" key={ratio} onClick={() => { setMediaRatio(ratio); setRatioOpen(false); }}>{ratio === "original" ? "원본" : ratio}</button>)}</div>}</div><button className="community-crop-cancel" type="button" onClick={requestUploadClose}>취소</button></div>
          </div> : <div className={`community-media-empty${returningToDropzone ? " is-returning" : ""}`}>
          <div className="community-media-icon" aria-hidden="true"><span>▧</span><b>▷</b></div>
          <h3>사진과 동영상을 여기에 끌어다 놓으세요</h3>
          <p>최대 5개까지 선택할 수 있어요.</p>
          <button type="button" onClick={() => mediaInputRef.current?.click()}>컴퓨터에서 선택</button>
          </div>}
          <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { continueWithMedia(event.target.files); event.target.value = ""; }} />
        </div>}
        {composeStep && publishing && <div className={`community-publish-status${publishComplete ? " is-complete" : ""}`} role="status"><span>{publishComplete ? "✓" : ""}</span><strong>{publishComplete ? "업로드 완료" : "여행 기록을 업로드하고 있어요"}</strong><small>{publishComplete ? "게시글을 열어볼게요" : "사진과 내용을 안전하게 저장하는 중입니다"}</small></div>}
      </section>
      {deleteMediaIndex !== null && <div className="community-media-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="community-media-delete-title"><section><span>미디어 삭제</span><h3 id="community-media-delete-title">선택한 파일을 삭제하시겠습니까?</h3><p>삭제한 파일은 현재 여행 기록에서 제외됩니다.</p><div><button type="button" onClick={() => setDeleteMediaIndex(null)}>취소</button><button className="is-delete" type="button" onClick={confirmMediaDelete}>삭제</button></div></section></div>}
    </div>}
    {discardPostOpen && <div className="community-post-discard-confirm" role="alertdialog" aria-modal="true" aria-labelledby="community-post-discard-title"><button type="button" aria-label="게시물 삭제 안내 닫기" onClick={() => setDiscardPostOpen(false)} /><section><span>게시물 나가기</span><h3 id="community-post-discard-title">게시물을 삭제하시겠어요?</h3><p>선택한 사진과 동영상이 모두 삭제됩니다.</p><div><button type="button" onClick={() => setDiscardPostOpen(false)}>취소</button><button className="is-delete" type="button" onClick={discardUploadPost}>삭제</button></div></section></div>}
    {selectedPostId && <CommunityDetailPage postId={selectedPostId} onClose={() => { setSelectedPostId(""); navigate("/community", { replace: true }); }} />}
  </main>;
}
