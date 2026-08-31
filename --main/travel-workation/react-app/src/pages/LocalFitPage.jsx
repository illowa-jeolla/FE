import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAiMatch, getAiMatch, getAiMatchResult, getAiMatchResults, retryAiMatch } from "../api/aiMatches";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import { asList } from "../hooks/useApi";

const priorityOptions = [
  ["NATURE_ACCESS", "자연 접근"], ["HOUSING_COST", "주거비"], ["COMMUTE", "출퇴근"], ["TOURISM_LIFE", "관광 생활"]
];
const jobOptions = [
  ["TOURISM_OPERATION", "관광 운영"], ["CONTENT", "콘텐츠"], ["CAFE", "카페"], ["OFFICE", "사무"]
];

function resultsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

function formConditions(form) {
  const values = new FormData(form);
  return {
    desiredLifestyle: String(values.get("desiredLifestyle") || "").trim(),
    preferredRegionId: values.get("preferredRegionId") ? Number(values.get("preferredRegionId")) : null,
    jobInterests: values.getAll("jobInterests"),
    priorities: values.getAll("priorities"),
    desiredSalary: values.get("desiredSalary") ? Number(values.get("desiredSalary")) : null,
    stayPeriod: String(values.get("stayPeriod") || "").trim(),
    hasVehicle: values.get("hasVehicle") === "on",
    extraConditions: String(values.get("extraConditions") || "").trim()
  };
}

export default function LocalFitPage() {
  const formRef = useRef(null);
  const pollGeneration = useRef(0);
  const [regions, setRegions] = useState([]);
  const [requestId, setRequestId] = useState(null);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [priorities, setPriorities] = useState([]);
  const [jobInterests, setJobInterests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    getRegions({ parentId: 1 }).then((data) => setRegions(asList(data, "regions"))).catch(() => {});
    return () => { pollGeneration.current += 1; };
  }, []);

  async function finishRequest(id, initial = {}) {
    const generation = ++pollGeneration.current;
    let current = initial;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (generation !== pollGeneration.current) return;
      const currentStatus = String(current.status || "").toUpperCase();
      setStatus(currentStatus || "PROCESSING");
      if (currentStatus === "FAILED") throw new Error(current.message || "AI 매칭에 실패했습니다.");
      if (currentStatus === "COMPLETED" || resultsOf(current).length) {
        const resultData = resultsOf(current).length ? current : await getAiMatchResults(id);
        const list = resultsOf(resultData);
        setResults(list);
        if (list[0]) {
          const resultId = list[0].resultId || list[0].id;
          try { setSelected(await getAiMatchResult(resultId)); } catch { setSelected(list[0]); }
        }
        setStatus("COMPLETED"); setMessage("맞춤 생활권을 찾았습니다.");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      current = await getAiMatch(id);
    }
    throw new Error("AI 분석이 계속 진행 중입니다. 잠시 후 다시 확인해 주세요.");
  }

  async function startRequest(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const conditions = formConditions(event.currentTarget);
    if (!conditions.jobInterests.length || !conditions.priorities.length) { setMessage("관심 일자리와 생활 우선순위를 하나 이상 선택해 주세요."); return; }
    setLoading(true); setResults([]); setSelected(null); setMessage("AI가 지역과 일자리를 분석하고 있어요.");
    try {
      const created = await createAiMatch(conditions);
      const id = created.requestId || created.id;
      if (!id) throw new Error("매칭 응답에 requestId가 없습니다.");
      setRequestId(id);
      await finishRequest(id, created);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }

  async function retry() {
    if (!requestId || !formRef.current) return;
    setLoading(true); setMessage("변경한 조건으로 다시 추천하고 있어요."); setSelected(null);
    try {
      const response = await retryAiMatch(requestId, formConditions(formRef.current));
      const nextId = response.requestId || response.id || requestId;
      setRequestId(nextId); setResults([]);
      await finishRequest(nextId, response);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }

  async function selectResult(result) {
    const resultId = result.resultId || result.id;
    setMessage("매칭 상세 정보를 불러오고 있어요.");
    try { setSelected(await getAiMatchResult(resultId)); setMessage(""); }
    catch (error) { setSelected(result); setMessage(error.message); }
  }

  const item = selected || results[0] || {};
  const score = Number(item.overallScore || item.score || 0);
  const cards = [
    ["추천 거주지", item.region?.name || "결과를 기다리는 중", `${item.region?.score ?? score}%`, item.summary || "생활 조건과 지역 데이터를 분석합니다."],
    ["추천 일자리", item.job?.title || "결과를 기다리는 중", `${item.job?.score ?? 0}%`, "관심 직무와 생활권을 함께 고려한 일자리입니다."],
    ["주변 관광지", item.places?.map?.((place) => place.name).join(" · ") || "결과를 기다리는 중", `${item.places?.length || 0}곳`, "일상과 여행을 함께 누릴 수 있는 주변 관광지입니다."]
  ];

  return <main className={`ai-match-main${results.length ? " ai-result-ready" : ""}`}>
    <section className="ai-match-intro"><div><p className="eyebrow dark">AI 전라도 라이프 매칭</p><h1>AI가 전라도에서<br />살 곳·일·여행을 함께 찾아드려요</h1></div></section>
    <div className="ai-match-workspace">
      <section className="ai-match-panel ai-match-form-panel"><h2>AI 매칭 조건</h2><form className="stack-form" ref={formRef} onSubmit={startRequest}>
        <div className="form-row"><label>희망 생활권<input name="desiredLifestyle" placeholder="예: 바다 가까운 중소도시" required /></label><label>선호 지역<select name="preferredRegionId" defaultValue=""><option value="">전남·전북 전체</option>{regions.map((region) => <option value={region.id} key={region.id}>{region.name}</option>)}</select></label></div>
        <fieldset className="ai-choice-box"><legend>관심 일자리</legend><div className="ai-priority-tags">{jobOptions.map(([value, label]) => <label key={value}><input type="checkbox" name="jobInterests" value={value} checked={jobInterests.includes(value)} onChange={() => setJobInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} /><span>{label}</span></label>)}</div></fieldset>
        <div className="ai-priority-box"><div className="ai-priority-head"><strong>생활 우선순위</strong><span>{priorities.length} / 4 선택</span></div><div className="ai-priority-tags">{priorityOptions.map(([value, label]) => <label key={value}><input type="checkbox" name="priorities" value={value} checked={priorities.includes(value)} onChange={() => setPriorities((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} /><span>{label}</span></label>)}</div></div>
        <div className="form-row"><label>희망 월급<input name="desiredSalary" type="number" min="0" step="10000" defaultValue="2500000" /></label><label>희망 체류 기간<input name="stayPeriod" defaultValue="3개월" placeholder="예: 3개월" /></label></div>
        <label className="ai-vehicle-check"><input name="hasVehicle" type="checkbox" /><span>자가용을 보유하고 있어요</span></label>
        <label>추가 조건<textarea name="extraConditions" placeholder="예: 바다와 가까운 곳을 선호합니다." /></label>
        <button className="ai-match-submit" type="submit" disabled={loading}>{loading ? "AI가 분석하고 있어요" : "AI 전라도 라이프 매칭 시작"}</button><div className={`page-status${message ? " is-visible" : ""}`}>{message}{status && status !== "COMPLETED" ? ` (${status})` : ""}</div>
      </form></section>
      <section className="ai-match-panel ai-match-result-panel">
        <div className="score-overview"><div className="score-ring" style={{ "--score": `${score}%` }}><div><strong>{score}</strong><span>%</span></div></div><div className="score-copy"><p className="eyebrow dark">AI 지역·일자리 매칭 결과</p><h3>{item.region?.name ? `${item.region.name} ${score}% 매칭` : "조건을 입력해 주세요"}</h3><p>{item.summary || "생활 조건을 입력하면 지역과 일자리를 함께 추천합니다."}</p></div></div>
        {requestId && <button className="ai-package-button" type="button" disabled={loading} onClick={retry}>조건 바꿔 다시 추천</button>}
        <img className="ai-match-photo" src="/assets/JvLTt.jpeg" alt="전라도 바다 생활권 풍경" />
        {results.length > 1 && <div className="ai-match-result-tabs">{results.map((result) => <button className={(item.resultId || item.id) === (result.resultId || result.id) ? "is-active" : ""} type="button" key={result.resultId || result.id} onClick={() => selectResult(result)}>#{result.rank || "-"} {result.region?.name} · {result.overallScore || result.score}점</button>)}</div>}
        <div className="record-list">{cards.map(([label, value, badge, copy], index) => <article className="record-item ai-detail-card" key={label}><div className="record-head"><div><span>{label}</span><h3>{value}</h3></div><strong className="record-score">{badge}</strong></div><p>{copy}</p>{index === 1 && item.job?.id ? <Link className="ai-detail-hint" to={`/jobs/${item.job.id}`}>공고 상세 보기 →</Link> : index === 2 && item.places?.[0]?.id ? <Link className="ai-detail-hint" to={`/destinations/${item.places[0].id}`}>관광지 상세 보기 →</Link> : <small className="ai-detail-hint">정보 보기 →</small>}</article>)}</div>
      </section>
    </div>
  </main>;
}
