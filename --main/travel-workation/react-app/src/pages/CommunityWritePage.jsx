import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTravelPost } from "../api/travelPosts";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import { asList } from "../hooks/useApi";
import { readFiles } from "./communityUtils";

export default function CommunityWritePage() {
  const navigate = useNavigate(); const fileRef = useRef(null);
  const [images, setImages] = useState([]); const [message, setMessage] = useState(""); const [error, setError] = useState(false);
  const [regions, setRegions] = useState([]);
  useEffect(() => { getRegions({ parentId: 1 }).then((result) => setRegions(asList(result, "regions"))).catch((requestError) => { setError(true); setMessage(requestError.message); }); }, []);
  async function chooseFiles(event) { const files = [...event.target.files].slice(0, 5 - images.length); if (files.some((file) => file.size > 1_000_000)) { setError(true); setMessage("사진은 한 장당 1MB 이하로 선택해 주세요."); return; } const nextImages = await readFiles(files); setImages((current) => [...current, ...nextImages].slice(0, 5)); }
  async function submit(event) { event.preventDefault(); if (!hasSession()) { navigate("/auth"); return; } const values = Object.fromEntries(new FormData(event.currentTarget)); const tags = String(values.hashtags || "").split(/[\s,]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).slice(0, 5); const body = { regionId: Number(values.regionId), title: values.title.trim(), concept: values.concept.trim(), content: values.content.trim(), imageUrls: images, tags }; try { setError(false); setMessage("여행 기록을 공유하는 중입니다."); const result = await createTravelPost(body); navigate(`/community/${result.id || result.postId}`); } catch (e) { setError(true); setMessage(e.message); } }
  return <main className="community-write-main">
    <header className="community-subpage-header"><div><p className="eyebrow dark">여행 기록</p><h1>지금의 여행을 기록하고 공유해요</h1></div><p>사진과 짧은 기록을 남겨보세요.</p></header>
    <form className="community-write-card" onSubmit={submit}>
      <div><p className="eyebrow dark">새 게시글</p><h2>여행 글 작성하기</h2><span>사진과 지역, 지금의 분위기를 기록해 주세요.</span></div>
      <section className="community-photo-upload"><strong>사진 업로드</strong><p>첫 번째 사진이 대표로 보여져요 · 최대 5장</p><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={chooseFiles} hidden /><div className="photo-preview-grid">{images.map((image, index) => <div className="photo-preview-card" key={image.slice(-32)}><img src={image} alt={`여행 사진 ${index + 1}`} />{index === 0 && <span>대표</span>}<button type="button" onClick={() => setImages((current) => current.filter((_, i) => i !== index))}>×</button></div>)}{images.length < 5 && <button className="photo-add-card" type="button" onClick={() => fileRef.current?.click()}><span>＋</span><b>사진 추가</b></button>}</div></section>
      <label>제목<input name="title" maxLength="100" placeholder="예: 노을을 품은 드라이브" required /></label>
      <div className="form-row"><label>지역<select name="regionId" required><option value="">지역 선택</option>{regions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>여행 콘셉트<input name="concept" placeholder="예: 노을 드라이브" required /></label></div>
      <label>여행 내용<textarea name="content" maxLength="500" placeholder="현장의 분위기와 여행 팁을 남겨보세요." required /></label>
      <label>해시태그<input name="hashtags" maxLength="100" placeholder="#노을맛집 #바다산책 #여수여행" /><small>공백이나 쉼표로 구분해 최대 5개까지 입력할 수 있어요.</small></label>
      <div className="community-write-actions"><Link className="button" to="/community">취소</Link><button className="button button-primary" type="submit">여행을 공유하기</button></div>
      <div className={`page-status${message ? " is-visible" : ""}${error ? " is-error" : ""}`} role="status">{message}</div>
    </form>
  </main>;
}
