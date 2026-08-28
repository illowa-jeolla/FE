import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { regions } from "../data/regions";

const fallback = { score: 92, title: "여수시 돌산 생활권 92% 매칭", summary: "오션뷰 관광 일자리와 바다 생활권, 주변 명소를 한 번에 연결했어요." };

export default function LocalFitPage() {
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [priorities, setPriorities] = useState([]);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form); body.priorities = form.getAll("priorities");
    setLoading(true); setMessage("관광데이터와 채용정보를 연결하고 있어요.");
    try { setResult(await apiRequest("/api/local-fit", { method: "POST", body: JSON.stringify(body) })); setMessage("맞춤 생활권을 찾았습니다."); }
    catch (error) { setMessage(error.message); } finally { setLoading(false); }
  }
  const item = result?.recommendation || result || {};
  const score = item.averageScore || item.score || fallback.score;
  const cards = [
    ["추천 거주지", item.residence?.name || item.residence || "여수시 돌산읍", `${score}%`, "바다와 생활 편의시설을 함께 누릴 수 있는 관광 생활권이에요."],
    ["추천 일자리", item.job?.title || item.job || "오션뷰 리조트 운영", "88%", "숙박 운영 경험과 지역 콘텐츠 관심을 활용하기 좋아요."],
    ["주변 관광지", item.places?.map?.((place) => place.name).join(" · ") || "향일암 · 오동도 · 돌산공원", "3곳", "퇴근 후와 주말에 이동하기 좋은 관광데이터 기반 추천이에요."]
  ];
  return <main className="ai-match-main">
    <section className="ai-match-intro"><div><p className="eyebrow dark">AI 전라도 라이프 매칭</p><h1>AI가 전라도에서<br />살 곳·일·여행을 함께 찾아드려요</h1></div></section>
    <div className="ai-match-workspace">
      <section className="ai-match-panel ai-match-form-panel"><h2>AI 매칭 조건</h2><form className="stack-form" onSubmit={submit}>
        <div className="form-row"><label>희망 생활권<input name="destinationName" placeholder="예: 바다 가까운 중소도시" required /></label><label>선호 지역<select name="region" required><option>전남·전북 전체</option>{regions.slice(1).map((region) => <option key={region}>{region}</option>)}</select></label></div>
        <label>관심 일자리<input name="concept" placeholder="관광 운영, 콘텐츠, 카페, 사무" required /></label><input type="hidden" name="transport" value="자가용" /><input type="hidden" name="companion" value="혼자" />
        <div className="ai-priority-box"><div className="ai-priority-head"><strong>생활 우선순위</strong><span>{priorities.length} / 4 선택</span></div><div className="ai-priority-tags">{["주거비", "출퇴근", "자연 접근", "관광 생활"].map((priority) => <label key={priority}><input type="checkbox" name="priorities" value={priority} checked={priorities.includes(priority)} onChange={() => setPriorities((current) => current.includes(priority) ? current.filter((value) => value !== priority) : [...current, priority])} /><span>{priority}</span></label>)}</div></div>
        <label>체류 조건<textarea name="note" placeholder="희망 급여, 체류 기간, 차량 여부 등" /></label><button className="ai-match-submit" type="submit" disabled={loading}>{loading ? "AI가 분석하고 있어요" : "AI 전라도 라이프 매칭 시작"}</button><div className={`page-status${message ? " is-visible" : ""}`}>{message}</div>
      </form></section>
      <section className="ai-match-panel ai-match-result-panel"><div className="score-overview"><div className="score-ring" style={{ "--score": `${score}%` }}><div><strong>{score}</strong><span>%</span></div></div><div className="score-copy"><p className="eyebrow dark">관광데이터 연동 추천 예시</p><h3>{item.title || fallback.title}</h3><p>{item.summary || fallback.summary}</p></div></div><button className="ai-package-button" type="button">조건 바꿔 다시 추천</button><img className="ai-match-photo" src="/assets/JvLTt.jpeg" alt="전라도 바다 생활권 풍경" /><div className="record-list">{cards.map(([label, value, badge, copy]) => <article className="record-item ai-detail-card" key={label}><div className="record-head"><div><span>{label}</span><h3>{value}</h3></div><strong className="record-score">{badge}</strong></div><p>{copy}</p><small className="ai-detail-hint">정보 보기 →</small></article>)}</div></section>
    </div>
  </main>;
}
