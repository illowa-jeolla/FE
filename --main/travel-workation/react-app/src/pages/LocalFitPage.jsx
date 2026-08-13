import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, PageIntro } from "../components/UI";
import { regions } from "../data/regions";

export default function LocalFitPage() {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); if (!hasSession()) { navigate("/auth"); return; }
    const form = new FormData(event.currentTarget); const body = Object.fromEntries(form); body.priorities = form.getAll("priorities");
    setLoading(true); setMessage("관광·채용·생활권 데이터를 연결하고 있어요.");
    try { setResult(await apiRequest("/api/local-fit", { method: "POST", body: JSON.stringify(body) })); setMessage("맞춤 생활권을 찾았습니다."); } catch (e) { setMessage(e.message); } finally { setLoading(false); }
  }
  const recommendation = result?.recommendation || result;
  return <main className="page-shell-react"><PageIntro eyebrow="AI JEOLLA LIFE MATCHING" title={<>AI가 전라도에서<br />살 곳·일·여행을 함께 찾아드려요</>} description="생활 우선순위를 선택하면 지역 데이터와 관광 일자리를 한 번에 연결합니다." /><div className="fit-layout-react"><form className="fit-form-react" onSubmit={submit}><h2>AI 매칭 조건</h2><label>관심 지역<select name="region">{regions.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>희망 직무<input name="jobPreference" placeholder="관광 운영, 콘텐츠 제작" /></label><fieldset><legend>생활 우선순위</legend><div className="choice-grid-react">{["관광 접근성", "일자리", "주거 편의", "커뮤니티"].map((item) => <label key={item}><input type="checkbox" name="priorities" value={item} />{item}</label>)}</div></fieldset><button className="primary-action-react" disabled={loading}>{loading ? "분석 중..." : "AI 매칭 시작"}</button><FormMessage message={message} /></form><section className="fit-result-react"><div className="score-react"><strong>{recommendation?.averageScore || recommendation?.score || 92}</strong><span>% MATCH</span></div><h2>{recommendation?.title || `${recommendation?.region || "여수"} 생활권 추천`}</h2><p>{recommendation?.summary || "바다 생활권과 관광 일자리, 주변 명소를 자연스럽게 이어볼 수 있는 지역이에요."}</p><div className="fit-cards-react">{[{ label: "추천 거주지", value: recommendation?.residence?.name || recommendation?.residence || "여수시 돌산읍" }, { label: "추천 일자리", value: recommendation?.job?.title || recommendation?.job || "오션뷰 리조트 운영" }, { label: "주변 관광지", value: recommendation?.places?.map?.((p) => p.name).join(" · ") || "향일암 · 오동도 · 돌산공원" }].map((item) => <article key={item.label}><span>{item.label}</span><h3>{item.value}</h3><p>선택한 생활 우선순위와 지역 데이터를 기준으로 추천했어요.</p></article>)}</div></section></div></main>;
}
