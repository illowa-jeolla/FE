import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteTravelPostDraft, deleteTravelPostDraftImage, publishTravelPostDraft, saveTravelPostDraft, startTravelPostDraft, uploadTravelPostDraftImage } from "../api/travelPosts";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import AuthenticatedImage from "../components/AuthenticatedImage";
import { asList } from "../hooks/useApi";
import { normalizeImageUrl } from "./communityUtils";

const draftIdOf = (data) => data?.draftId || data?.postId || data?.id;
const regionIdOf = (region) => region?.regionId || region?.id;
const imagesOf = (data) => Array.isArray(data?.images) ? [...data.images].sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0)).map((item) => ({ imageId: item.imageId || item.id, preview: normalizeImageUrl(item.imageUrl || item.url), file: null })) : [];

export default function CommunityWritePage() {
  const navigate = useNavigate(); const fileRef = useRef(null); const formRef = useRef(null);
  const [regions, setRegions] = useState([]); const [images, setImages] = useState([]); const [draftId, setDraftId] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState(false); const [busy, setBusy] = useState(false); const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => { getRegions().then((data) => setRegions(asList(data, "regions"))).catch((e) => { setError(true); setMessage(e.message); }); }, []);
  useEffect(() => {
    if (!hasSession()) { navigate("/auth"); return; }
    let cancelled = false; setBusy(true);
    startTravelPostDraft().then((draft) => {
      if (cancelled) return;
      setDraftId(String(draftIdOf(draft) || "")); setImages(imagesOf(draft));
      const form = formRef.current;
      if (form) { if (draft.regionId) form.elements.regionId.value = String(draft.regionId); form.elements.title.value = draft.title || ""; form.elements.concept.value = draft.concept || ""; form.elements.content.value = draft.content || ""; }
      setMessage(draft.resumed ? "작성 중이던 임시 글을 불러왔습니다." : "새 여행 기록을 준비했습니다.");
    }).catch((e) => { if (!cancelled) { setError(true); setMessage(e.message); } }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [navigate]);

  function chooseFiles(event) {
    const files = [...event.target.files].slice(0, 5 - images.length); event.target.value = "";
    if (files.some((file) => file.size > 10 * 1024 * 1024)) { setError(true); setMessage("사진은 한 장당 10MB 이하로 선택해 주세요."); return; }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError(true); setMessage("JPEG, PNG, WEBP 이미지만 선택할 수 있습니다."); return; }
    setError(false); setImages((current) => [...current, ...files.map((file) => ({ file, preview: URL.createObjectURL(file), imageId: null }))].slice(0, 5));
  }

  async function removeImage(image, index) {
    if (busy) return; setBusy(true);
    try { if (image.imageId) await deleteTravelPostDraftImage(draftId, image.imageId); if (image.file) URL.revokeObjectURL(image.preview); setImages((current) => current.filter((_, i) => i !== index)); setError(false); setMessage("이미지를 삭제했습니다."); }
    catch (e) { setError(true); setMessage(e.message); } finally { setBusy(false); }
  }

  async function persist(values, requireRegion = false) {
    if (!draftId) throw new Error("Draft가 준비되지 않았습니다.");
    const regionId = Number(values.regionId);
    if (requireRegion && (!Number.isInteger(regionId) || regionId <= 0)) throw new Error("게시하려면 지역을 다시 선택해 주세요.");
    const uploaded = [];
    for (const image of images) {
      if (image.imageId) uploaded.push(image);
      else { const result = await uploadTravelPostDraftImage(draftId, image.file); uploaded.push({ imageId: result.imageId, preview: image.preview || normalizeImageUrl(result.imageUrl), file: null }); }
    }
    setImages(uploaded);
    await saveTravelPostDraft(draftId, { regionId: regionId > 0 ? regionId : undefined, title: values.title.trim(), concept: values.concept.trim(), content: values.content.trim(), imageIds: uploaded.map((item) => item.imageId) });
  }

  async function submit(event) {
    event.preventDefault(); const action = event.nativeEvent.submitter?.value || "publish"; const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(false); setMessage("이미지와 여행 기록을 저장하는 중입니다.");
    try { await persist(values, action === "publish"); if (action === "draft") { setMessage("임시저장했습니다."); return; } const result = await publishTravelPostDraft(draftId); navigate(`/community/${result.postId || draftId}`); }
    catch (e) { setError(true); setMessage(e.message); } finally { setBusy(false); }
  }

  async function saveAndExit() {
    const form = formRef.current;
    if (!form) return;
    setBusy(true); setError(false); setMessage("작성 중인 게시글을 저장하는 중입니다.");
    try { await persist(Object.fromEntries(new FormData(form))); navigate("/community", { state: { draftSaved: true } }); }
    catch (e) { setExitOpen(false); setError(true); setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function discardAndExit() {
    if (!draftId) { navigate("/community"); return; }
    setBusy(true); setError(false); setMessage("임시 게시글을 삭제하는 중입니다.");
    try { await deleteTravelPostDraft(draftId); navigate("/community"); }
    catch (e) { setExitOpen(false); setError(true); setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <main className="community-write-main"><header className="community-subpage-header"><div><p className="eyebrow dark">여행 기록</p><h1>지금의 여행을 기록하고 공유해요</h1></div><p>사진과 짧은 기록을 남겨보세요.</p></header>
    <form className="community-write-card" ref={formRef} onSubmit={submit}><div><p className="eyebrow dark">새 게시글</p><h2>여행 글 작성하기</h2><span>사진과 지역, 지금의 분위기를 기록해 주세요.</span></div>
      <section className="community-photo-upload"><strong>사진 업로드</strong><p>첫 번째 사진이 대표로 보여져요 · 최대 5장 · 장당 10MB</p><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={chooseFiles} hidden /><div className="photo-preview-grid">{images.map((image, index) => <div className="photo-preview-card" key={image.imageId || image.preview}><AuthenticatedImage src={image.preview} alt={`여행 사진 ${index + 1}`} />{index === 0 && <span>대표</span>}<button type="button" disabled={busy} onClick={() => removeImage(image, index)}>×</button></div>)}{images.length < 5 && <button className="photo-add-card" type="button" disabled={busy} onClick={() => fileRef.current?.click()}><span>＋</span><b>사진 추가</b></button>}</div></section>
      <label>제목<input name="title" maxLength="200" placeholder="예: 노을을 품은 드라이브" required /></label>
      <div className="form-row"><label>지역<select name="regionId" required><option value="">지역 선택</option>{regions.map((item) => { const regionId = regionIdOf(item); return <option value={regionId} key={regionId || item.name}>{item.name}</option>; })}</select></label><label>여행 콘셉트<input name="concept" maxLength="100" placeholder="예: 노을 드라이브" /></label></div>
      <label>여행 내용<textarea name="content" placeholder="현장의 분위기와 여행 팁을 남겨보세요." required /></label>
      <div className="community-write-actions"><button className="button" type="button" onClick={() => setExitOpen(true)} disabled={busy}>나가기</button><button className="button button-primary" type="submit" value="publish" disabled={busy || !draftId}>여행을 공유하기</button></div>
      <div className={`page-status${message ? " is-visible" : ""}${error ? " is-error" : ""}`} role="status">{message}</div></form>
    {exitOpen && <div className="community-exit-modal"><button className="community-exit-backdrop" type="button" aria-label="저장 안내 닫기" onClick={() => setExitOpen(false)} /><section className="community-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="community-exit-title"><span>작성 중인 게시글</span><h2 id="community-exit-title">저장하고 나갈까요?</h2><p>저장하지 않으면 기존에 저장된 임시글과 이미지도 모두 삭제돼요.</p><div><button className="button" type="button" disabled={busy} onClick={discardAndExit}>저장 안 함</button><button className="button button-primary" type="button" disabled={busy} onClick={saveAndExit}>저장</button></div></section></div>}
  </main>;
}
