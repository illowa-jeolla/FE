import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { deleteTravelPostDraft, deleteTravelPostDraftImage, deleteTravelPostImage, getTravelPost, publishTravelPostDraft, saveTravelPostDraft, startTravelPostDraft, updateTravelPost, uploadTravelPostDraftImage, uploadTravelPostImage } from "../api/travelPosts";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import AuthenticatedImage from "../components/AuthenticatedImage";
import { asList } from "../hooks/useApi";
import { normalizeImageUrl } from "./communityUtils";
import { clearCommunityPageCache } from "./communityPageCache";

const draftIdOf = (data) => data?.draftId || data?.postId || data?.id;
const regionIdOf = (region) => region?.regionId || region?.id;
const imagesOf = (data) => Array.isArray(data?.images) ? [...data.images].sort((left, right) => Number(left?.displayOrder || 0) - Number(right?.displayOrder || 0)).map((item) => ({ imageId: typeof item === "object" ? item.imageId || item.id : null, preview: normalizeImageUrl(typeof item === "string" ? item : item.imageUrl || item.url), file: null })).filter((item) => item.preview) : [];

export default function CommunityWritePage() {
  const navigate = useNavigate(); const location = useLocation(); const { id: postId } = useParams(); const editing = Boolean(postId); const fileRef = useRef(null); const formRef = useRef(null);
  const [regions, setRegions] = useState([]); const [images, setImages] = useState([]); const [draftId, setDraftId] = useState("");
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false); const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => {
    if (!hasSession()) { navigate("/auth"); return; }
    let cancelled = false; setBusy(true);
    Promise.all([getRegions(), editing ? getTravelPost(postId) : startTravelPostDraft()]).then(([regionData, record]) => {
      if (cancelled) return;
      setRegions(asList(regionData, "regions"));
      const initialMedia = editing ? [] : (location.state?.initialMedia || []).slice(0, 5).map((file) => ({ file, preview: URL.createObjectURL(file), imageId: null, mediaType: file.type.startsWith("video/") ? "video" : "image" }));
      setImages([...imagesOf(record), ...initialMedia].slice(0, 5));
      if (!editing) setDraftId(String(draftIdOf(record) || ""));
      setTimeout(() => { const form = formRef.current; if (!form || cancelled) return; const regionId = record.regionId || record.region?.regionId || record.region?.id; if (regionId) form.elements.regionId.value = String(regionId); form.elements.title.value = record.title || ""; form.elements.concept.value = record.concept || ""; form.elements.content.value = record.content || ""; }, 0);
      setMessage(editing ? "게시글 내용을 불러왔습니다." : record.resumed ? "작성 중이던 임시 글을 불러왔습니다." : "새 여행 기록을 준비했습니다.");
    }).catch((e) => { if (!cancelled) { setError(true); setMessage(e.message); } }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [editing, navigate, postId]);

  function chooseFiles(event) {
    const files = [...event.target.files].slice(0, 5 - images.length); event.target.value = "";
    if (files.some((file) => file.size > 50 * 1024 * 1024)) { setError(true); setMessage("파일은 한 개당 50MB 이하로 선택해 주세요."); return; }
    if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) { setError(true); setMessage("사진 또는 동영상 파일만 선택할 수 있습니다."); return; }
    setError(false); setImages((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file), imageId: null, mediaType: file.type.startsWith("video/") ? "video" : "image" }))].slice(0, 5));
  }

  async function removeImage(image, index) {
    if (busy) return; setBusy(true);
    try { if (image.imageId && editing) setRemovedImageIds((current) => [...current, image.imageId]); else if (image.imageId) await deleteTravelPostDraftImage(draftId, image.imageId); if (image.file) URL.revokeObjectURL(image.preview); setImages((current) => current.filter((_, i) => i !== index)); setError(false); setMessage(editing ? "저장하면 선택한 이미지가 삭제됩니다." : "이미지를 삭제했습니다."); }
    catch (e) { setError(true); setMessage(e.message); } finally { setBusy(false); }
  }

  async function persist(values, requireRegion = false) {
    if (!editing && !draftId) throw new Error("Draft가 준비되지 않았습니다.");
    const regionId = Number(values.regionId);
    if (requireRegion && (!Number.isInteger(regionId) || regionId <= 0)) throw new Error("게시하려면 지역을 다시 선택해 주세요.");
    if (editing && removedImageIds.length) { await Promise.all(removedImageIds.map((imageId) => deleteTravelPostImage(postId, imageId))); setRemovedImageIds([]); }
    const uploaded = [];
    for (const image of images) {
      if (image.imageId) uploaded.push(image);
      else { const result = editing ? await uploadTravelPostImage(postId, image.file) : await uploadTravelPostDraftImage(draftId, image.file); uploaded.push({ imageId: result.imageId, preview: image.preview || normalizeImageUrl(result.imageUrl), file: null }); }
    }
    setImages(uploaded);
    const body = { regionId: regionId > 0 ? regionId : undefined, title: values.title.trim(), concept: values.concept.trim(), content: values.content.trim(), imageIds: uploaded.map((item) => item.imageId) };
    if (editing) await updateTravelPost(postId, body);
    else await saveTravelPostDraft(draftId, body);
  }

  async function submit(event) {
    event.preventDefault(); const action = event.nativeEvent.submitter?.value || "publish"; const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(false); setMessage("이미지와 여행 기록을 저장하는 중입니다.");
    try { await persist(values, true); if (editing) { clearCommunityPageCache(); navigate(`/community/${postId}`); return; } if (action === "draft") { setMessage("임시저장했습니다."); return; } const result = await publishTravelPostDraft(draftId); clearCommunityPageCache(); navigate(`/community/${result.postId || draftId}`); }
    catch (e) { setError(true); setMessage(e.message); } finally { setBusy(false); }
  }

  async function saveAndExit() {
    const form = formRef.current;
    if (!form) return;
    setBusy(true); setError(false); setMessage("작성 중인 게시글을 저장하는 중입니다.");
    try { if (editing) { navigate(`/community/${postId}`); return; } await persist(Object.fromEntries(new FormData(form))); navigate("/community", { state: { draftSaved: true } }); }
    catch (e) { setExitOpen(false); setError(true); setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function discardAndExit() {
    if (editing) { navigate(`/community/${postId}`); return; }
    if (!draftId) { navigate("/community"); return; }
    setBusy(true); setError(false); setMessage("임시 게시글을 삭제하는 중입니다.");
    try { await deleteTravelPostDraft(draftId); navigate("/community"); }
    catch (e) { setExitOpen(false); setError(true); setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <main className="community-write-main"><header className="community-subpage-header"><div><p className="eyebrow dark">여행 기록</p><h1>{editing ? "여행 기록을 다듬어 보세요" : "지금의 여행을 기록하고 공유해요"}</h1></div><p>{editing ? "사진과 내용을 한 화면에서 수정할 수 있어요." : "사진과 짧은 기록을 남겨보세요."}</p></header>
    <form className="community-write-card" ref={formRef} onSubmit={submit}><div><p className="eyebrow dark">{editing ? "게시글 수정" : "새 게시글"}</p><h2>{editing ? "여행 글 수정하기" : "여행 글 작성하기"}</h2><span>사진과 지역, 지금의 분위기를 기록해 주세요.</span></div>
      <section className="community-photo-upload"><strong>사진·동영상 업로드</strong><p>첫 번째 사진이 대표로 보여져요 · 최대 5개</p><input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={chooseFiles} hidden /><div className="photo-preview-grid">{images.map((image, index) => <div className="photo-preview-card" key={image.imageId || image.preview}>{image.mediaType === "video" ? <video src={image.preview} muted controls /> : <AuthenticatedImage src={image.preview} alt={`여행 사진 ${index + 1}`} />}{index === 0 && <span>대표</span>}<button type="button" disabled={busy} onClick={() => removeImage(image, index)}>×</button></div>)}{images.length < 5 && <button className="photo-add-card" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><span>＋</span><b>미디어 추가</b></button>}</div></section>
      <label>제목<input name="title" maxLength="200" placeholder="예: 노을을 품은 드라이브" required /></label>
      <div className="form-row"><label>지역<select name="regionId" required><option value="">지역 선택</option>{regions.map((item) => { const regionId = regionIdOf(item); return <option value={regionId} key={regionId || item.name}>{item.name}</option>; })}</select></label><label>여행 콘셉트<input name="concept" maxLength="100" placeholder="예: 노을 드라이브" /></label></div>
      <label>여행 내용<textarea name="content" placeholder="현장의 분위기와 여행 팁을 남겨보세요." required /></label>
      <div className="community-write-actions"><button className="button" type="button" onClick={() => setExitOpen(true)} disabled={busy}>나가기</button><button className="button button-primary" type="submit" value="publish" disabled={busy || (!editing && !draftId)}>{editing ? "수정 완료" : "여행을 공유하기"}</button></div>
      <div className={`page-status${message ? " is-visible" : ""}${error ? " is-error" : ""}`} role="status">{message}</div></form>
    {exitOpen && <div className="community-exit-modal"><button className="community-exit-backdrop" type="button" aria-label="저장 안내 닫기" onClick={() => setExitOpen(false)} /><section className="community-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="community-exit-title"><span>{editing ? "게시글 수정 중" : "작성 중인 게시글"}</span><h2 id="community-exit-title">{editing ? "수정을 취소할까요?" : "저장하고 나갈까요?"}</h2><p>{editing ? "변경한 내용은 저장되지 않고 게시글로 돌아갑니다." : "저장하지 않으면 기존에 저장된 임시글과 이미지도 모두 삭제돼요."}</p><div><button className="button" type="button" disabled={busy} onClick={() => setExitOpen(false)}>계속 작성</button><button className="button button-primary" type="button" disabled={busy} onClick={editing ? discardAndExit : saveAndExit}>{editing ? "수정 취소" : "저장"}</button></div></section></div>}
  </main>;
}
