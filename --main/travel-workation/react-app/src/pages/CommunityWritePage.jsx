import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, PageIntro } from "../components/UI";
import { regions } from "../data/regions";
import { readFiles } from "./communityUtils";

export default function CommunityWritePage() {
  const navigate = useNavigate();
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (!hasSession()) { navigate("/auth"); return; }
    const values = Object.fromEntries(new FormData(event.currentTarget)); values.imageData = images;
    try { setError(false); setMessage("여행 기록을 공유하는 중입니다."); const result = await apiRequest("/api/posts", { method: "POST", body: JSON.stringify(values) }); navigate(`/community/${result.id}`); } catch (e) { setError(true); setMessage(e.message); }
  }
  return <main className="page-shell-react narrow-react"><PageIntro eyebrow="NEW TRAVEL STORY" title="지금의 여행을 기록하고 공유해요" description="사진과 지역, 지금의 분위기를 남겨보세요." />
    <form className="editor-react" onSubmit={submit}><label className="upload-react">사진 업로드<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={async (e) => { const files = [...e.target.files]; if (files.some((file) => file.size > 1_000_000)) { setError(true); setMessage("사진은 한 장당 1MB 이하로 선택해 주세요."); return; } setImages(await readFiles(files)); }} /><span>PNG, JPG, WEBP · 최대 5장</span></label>{images.length > 0 && <div className="preview-grid-react">{images.map((image, index) => <div key={index}><img src={image} alt="" /><button type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>}<div className="form-grid-react"><label>지역<select name="region">{regions.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>여행 콘셉트<input name="concept" maxLength="60" placeholder="노을을 품은 드라이브" required /></label></div><label>여행 이야기<textarea name="content" rows="9" maxLength="2000" placeholder="지금 보고 느낀 것을 들려주세요." required /></label><div className="editor-actions-react"><Link to="/community">취소</Link><button className="primary-action-react">여행 기록 올리기</button></div><FormMessage message={message} error={error} /></form>
  </main>;
}
