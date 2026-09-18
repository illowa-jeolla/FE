import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAiMatch, getAiMatch } from "../api/aiMatches";
import { externalJobDetailPath, getAllExternalJobs } from "../api/jobs";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import { asList } from "../hooks/useApi";

const priorityOptions = [
  ["JOB", "커리어·일"], ["HOUSING", "주거·생활비"], ["TOURISM", "환경·여가"], ["COMMUNITY", "관계·정착"]
];
const jobGroups = {
  "외식·음료": ["외식·음료 전체", "서빙", "주방장·조리사", "주방보조·설거지", "바리스타", "제과제빵사", "일반음식점", "레스토랑", "패밀리레스토랑", "패스트푸드점", "치킨·피자전문점", "커피전문점", "아이스크림·디저트", "베이커리·도넛·떡", "호프·일반주점", "바(bar)", "급식·푸드시스템", "도시락·반찬"],
  "매장관리·판매": ["매장관리·판매 전체", "매장관리·판매", "캐셔·카운터", "판촉도우미", "MD·쇼핑몰운영", "백화점·쇼핑몰", "유통점·마트", "도소매·전통시장", "편의점", "의류·잡화·쥬얼리매장", "뷰티·헬스스토어", "휴대폰·전자기기매장", "가구·침구·인테리어", "생활용품샵", "서점·문구·팬시", "약국", "농수산·청과·축산", "화훼·꽃집", "스터디룸·독서실·고시원", "PC방", "노래방", "볼링·당구장", "스크린 골프·야구", "DVD·멀티방·만화카페", "오락실·게임장", "이색테마카페", "키즈카페", "찜질방·사우나·스파", "피트니스·스포츠", "고속도로휴게소", "매장관리·판매 기타"],
  "서비스": ["서비스 전체", "놀이공원·테마파크", "호텔·리조트·숙박", "여행·캠프·레포츠", "영화관·공연장", "전시·컨벤션·세미나", "안내데스크·리셉션", "주차유도·안내", "보안·경비·경호", "주유·세차", "렌터카·차량관리", "전단지배포", "청소·미화", "렌탈관리·A/S", "골프캐디", "헤어·미용·네일샵", "피부관리·마사지", "반려동물케어", "베이비시터·가사도우미", "결혼·연회·장례도우미", "이벤트·행사스텝", "나레이터모델", "피팅모델", "공인중개", "서비스 기타"],
  "사무직": ["사무직 전체", "사무보조", "문서작성·자료조사", "데이터수집·가공", "비서", "경리·회계보조", "인사·총무", "마케팅·광고·홍보", "바이럴·SNS마케팅", "번역·통역", "복사·출력·제본", "편집·교정·교열", "공공기관·공기업·협회", "학교·도서관·교육기관"],
  "고객상담·리서치·영업": ["고객상담·리서치·영업 전체", "고객상담·인바운드", "텔레마케팅·아웃바운드", "쇼핑몰인바운드", "금융·보험영업", "오프라인영업·판매", "설문조사·리서치", "콜센터관리·모니터링", "영업관리·지원"],
  "생산·건설·노무": ["생산·건설·노무 전체", "제조·가공·조립", "포장·품질검사", "입출고·창고관리", "상하차·소화물 분류", "물류피킹·포장·전산", "지게차운전", "금형·사출·프레스·사상", "반도체·전자부품생산", "기계조작·오퍼레이터", "정비·수리·설치·A/S", "전기·시설물관리", "운반·설치·철거", "공사·건설현장", "전기·칸막이·배관공사", "인테리어·보수공사", "조선소", "재단·재봉", "생산·건설·노무 기타"],
  "IT·기술": ["IT·기술 전체", "웹·콘텐츠기획", "사이트관리·기술지원", "프로그래머", "HTML코딩", "QA·테스터·검증", "시스템·네트워크·보안", "PC·디지털기기 설치·관리"],
  "디자인": ["디자인 전체", "웹·모바일디자인", "그래픽·영상·편집디자인", "제품·산업디자인", "CAD·CAM·인테리어디자인", "캐릭터·애니메이션디자인", "패션·잡화디자인", "디자인 기타"],
  "미디어": ["미디어 전체", "보조출연·방청", "방송스텝·촬영보조", "동영상촬영·편집", "사진촬영·편집", "조명·음향", "방송사·프로덕션", "신문·잡지·출판", "미디어 기타"],
  "운전·배달": ["운전·배달 전체", "화물·운송·이사", "택배·배송기사", "납품기사", "중장비·특수차", "발렛파킹", "택시·대리·수행기사", "버스·셔틀운전", "퀵서비스", "배달대행·음식배달", "도보배달"],
  "병원·간호·연구": ["병원·간호·연구 전체", "간호조무사·간호사", "의료기사", "간병·요양보호사", "원무·코디네이터", "외래보조·병동보조", "수의테크니션·동물보건사", "실험·연구보조", "생동성·임상시험"],
  "교육·강사": ["교육·강사 전체", "입시·보습학원", "외국어·어학원", "독서·논술·스피치학원", "컴퓨터·정보통신", "요가·필라테스 강사", "피트니스 트레이너", "레져스포츠 강사", "예체능 강사", "유아·유치원", "등하원·승하차도우미", "방문·학습지", "보조교사", "자격증·기술학원", "국비교육기관", "학원운영지원", "교재·교육콘텐츠제작", "교육·강사 기타"]
};
const jobOptions = Object.keys(jobGroups);
const requiredPriorities = priorityOptions.map(([value]) => value);
const AI_MATCH_CACHE_KEY = "illowa:ai-match:latest:v1";
const lowerMarqueeImages = [
  "https://www.yeosu.go.kr/tour/build/images/p131/p1319544/p1319544439314-1.jpg/666x1x70/666x1_p1319544439314-1.jpg",
  "https://tgroup.vn/uploads/images/thao-nhi/jeollanam-do-han-quoc-tgroup-travel-1.jpg",
  "https://img.khan.co.kr/news/2020/05/01/2020050101000105200003241.jpg",
  "https://onecms-res.cloudinary.com/image/upload/s--ssRapWNB--/c_crop,h_960,w_1280,x_0,y_2/c_fill,g_auto,h_523,w_693/f_auto,q_auto/v1/mediacorp/cna/image/2023/12/01/jeolla_south_korea_image15.png",
  "https://media.triple.guide/triple-cms/c_limit,f_auto,h_1024,w_1024/27d36529-936e-4757-91f6-c0c84dab7dcb.jpeg",
  "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=700&q=80"
];

function resultsOf(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

function completedMessage(status) {
  return status === "REPLACED"
    ? "선택한 지역의 일부 결과를 다른 지역 정보로 대체했습니다."
    : "맞춤 생활권을 찾았습니다.";
}

function matchedJobDetailPath(job = {}) {
  const source = String(job.externalSource || job.source || "").toUpperCase();
  const externalId = job.externalId || job.jobKey || job.employmentInfoNo || job.rawFields?.jobKey || job.rawFields?.employmentInfoNo;
  if (!externalId) return "/jobs";
  const externalSource = source.includes("JUNNAM") || job.jobKey || job.rawFields?.jobKey ? "junnam" : "tour";
  return externalJobDetailPath({ externalSource, externalId });
}

function normalizedJobText(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function hasGeneratedCandidateId(job = {}) {
  return /^[a-f0-9]{64}$/i.test(String(job.externalId || ""));
}

function readAiMatchCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(AI_MATCH_CACHE_KEY) || "null");
    return cached && Array.isArray(cached.results) ? cached : null;
  } catch {
    sessionStorage.removeItem(AI_MATCH_CACHE_KEY);
    return null;
  }
}

function writeAiMatchCache(value) {
  sessionStorage.setItem(AI_MATCH_CACHE_KEY, JSON.stringify(value));
}

function formConditions(form, preferredRegionId, priorities, jobInterests) {
  const values = new FormData(form);
  return {
    preferredRegionId: Number(preferredRegionId),
    desiredJobs: [...jobInterests],
    priorities: [...priorities],
    thought: String(values.get("thought") || "").trim()
  };
}

export default function LocalFitPage() {
  const restoredMatch = useRef(readAiMatchCache()).current;
  const pollGeneration = useRef(0);
  const regionPickerRef = useRef(null);
  const [regions, setRegions] = useState([]);
  const [status, setStatus] = useState(restoredMatch?.status || "");
  const [results, setResults] = useState(restoredMatch?.results || []);
  const [selected, setSelected] = useState(() => restoredMatch?.results?.find((result) => result.rank === restoredMatch.selectedRank) || restoredMatch?.results?.[0] || null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingJob, setResolvingJob] = useState("");
  const [analysisStep, setAnalysisStep] = useState(0);
  const [priorities, setPriorities] = useState(restoredMatch?.conditions?.priorities || []);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);
  const [jobInterests, setJobInterests] = useState(restoredMatch?.conditions?.desiredJobs || []);
  const [jobQuery, setJobQuery] = useState("");
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const [activeJobGroup, setActiveJobGroup] = useState(jobOptions[0]);
  const [preferredRegionId, setPreferredRegionId] = useState(() => String(restoredMatch?.conditions?.preferredRegionId || ""));
  const [thought, setThought] = useState(restoredMatch?.conditions?.thought || "");
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionQuery, setRegionQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    getRegions().then((data) => setRegions(asList(data, "regions"))).catch(() => {});
    if (restoredMatch?.scrollY) requestAnimationFrame(() => window.scrollTo(0, restoredMatch.scrollY));
    return () => { pollGeneration.current += 1; };
  }, []);

  useEffect(() => {
    if (!results.length) return;
    writeAiMatchCache({
      results,
      selectedRank: (selected || results[0])?.rank,
      status,
      conditions: { preferredRegionId, desiredJobs: jobInterests, priorities, thought },
      scrollY: Number(restoredMatch?.scrollY) || 0
    });
  }, [results, selected, status, preferredRegionId, jobInterests, priorities, thought]);

  useEffect(() => {
    if (!loading) return undefined;
    setAnalysisStep(0);
    const timer = window.setInterval(() => {
      setAnalysisStep((current) => Math.min(current + 1, 3));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!regionPickerOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!regionPickerRef.current?.contains(event.target)) setRegionPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [regionPickerOpen]);

  async function finishRequest(id, initial = {}) {
    const generation = ++pollGeneration.current;
    let current = initial;
    const pollDelays = [3000, 5000, 8000, 10000, 10000, 10000, 10000, 10000, 10000, 10000];
    for (const delay of pollDelays) {
      if (generation !== pollGeneration.current) return;
      const currentStatus = String(current.status || "").toUpperCase();
      setStatus(currentStatus || "PROCESSING");
      if (currentStatus === "FAILED") throw new Error(current.message || "AI 매칭에 실패했습니다.");
      if (currentStatus === "COMPLETED" || currentStatus === "REPLACED") {
        const list = resultsOf(current);
        setResults(list);
        if (list[0]) setSelected(list[0]);
        setStatus(currentStatus); setMessage(completedMessage(currentStatus));
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, delay));
      current = await getAiMatch(id);
    }
    throw new Error("AI 분석이 계속 진행 중입니다. 잠시 후 다시 확인해 주세요.");
  }

  async function startRequest(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const conditions = formConditions(event.currentTarget, preferredRegionId, priorities, jobInterests);
    if (!conditions.preferredRegionId) { setMessage("선호 지역을 선택해 주세요."); return; }
    if (conditions.desiredJobs.length < 1 || conditions.desiredJobs.length > 10) { setMessage("희망 직무를 1개 이상 10개 이하로 선택해 주세요."); return; }
    if (conditions.desiredJobs.some((job) => !job.trim() || job.length > 100)) { setMessage("희망 직무는 공백 없이 100자 이하로 입력해 주세요."); return; }
    if (conditions.priorities.length !== 4 || new Set(conditions.priorities).size !== 4
      || requiredPriorities.some((priority) => !conditions.priorities.includes(priority))) {
      setMessage("생활 우선순위를 중복 없이 모두 입력해 주세요."); return;
    }
    if (conditions.thought.length > 100) { setMessage("생각과 추가 조건을 100자 이하로 입력해 주세요."); return; }
    setRegionPickerOpen(false); setJobPickerOpen(false); setPriorityPickerOpen(false);
    sessionStorage.removeItem(AI_MATCH_CACHE_KEY);
    setLoading(true); setResults([]); setSelected(null); setMessage("AI가 지역과 일자리를 분석하고 있어요.");
    try {
      const created = await createAiMatch(conditions);
      const id = created.requestId || created.id;
      if (!id) throw new Error("매칭 응답에 requestId가 없습니다.");
      await finishRequest(id, created);
    } catch (error) { setMessage(error.message); }
    finally { setLoading(false); }
  }

  function selectResult(result) { setSelected(result); }

  async function openMatchedJob(job, index) {
    const resolvingKey = String(job.externalId || `${job.title}-${index}`);
    if (resolvingJob) return;
    setResolvingJob(resolvingKey);
    setMessage("");
    try {
      let detailPath = matchedJobDetailPath(job);
      if (detailPath === "/jobs" || hasGeneratedCandidateId(job)) {
        const region = job.region?.name || (typeof job.region === "string" ? job.region : "");
        const candidates = await getAllExternalJobs({ region });
        const title = normalizedJobText(job.title);
        const company = normalizedJobText(job.companyName || job.company);
        const exactMatch = candidates.find((candidate) => {
          if (normalizedJobText(candidate.title) !== title) return false;
          return !company || normalizedJobText(candidate.employerName || candidate.companyName) === company;
        });
        const titleMatch = exactMatch || candidates.find((candidate) => normalizedJobText(candidate.title) === title);
        if (titleMatch) detailPath = externalJobDetailPath(titleMatch);
      }
      if (detailPath === "/jobs") throw new Error("연결된 원본 공고를 찾지 못했습니다.");
      const cached = readAiMatchCache();
      if (cached) writeAiMatchCache({ ...cached, scrollY: window.scrollY });
      navigate(detailPath);
    } catch (error) {
      setMessage(error.message || "공고 상세 정보를 불러오지 못했습니다.");
    } finally {
      setResolvingJob("");
    }
  }

  function toggleJob(value) {
    setJobInterests((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      const group = Object.values(jobGroups).find((jobs) => jobs.includes(value));
      const groupAll = group?.[0];
      const isGroupAll = value === groupAll;
      const withoutConflict = group
        ? current.filter((item) => isGroupAll ? !group.includes(item) : item !== groupAll)
        : current;
      if (withoutConflict.length >= 10) { setMessage("희망 직무는 최대 10개까지 선택할 수 있습니다."); return current; }
      setMessage("");
      return [...withoutConflict, value];
    });
  }

  function togglePriority(value) {
    setPriorities((current) => current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]);
    setMessage("");
  }

  const item = selected || results[0] || {};
  const score = Math.min(100, Math.max(0, Number(item.scores?.overall) || 0));
  const primaryJob = item.jobs?.[0];
  const primaryPlace = item.places?.[0];
  const selectedRegion = regions.find((region) => String(region.regionId || region.id) === String(preferredRegionId));
  const filteredRegions = regions.filter((region) => String(region.name || "").includes(regionQuery.trim()));
  const visibleJobs = jobQuery.trim()
    ? Object.values(jobGroups).flat().filter((job, index, all) => job.includes(jobQuery.trim()) && all.indexOf(job) === index)
    : jobGroups[activeJobGroup];
  const isDailyLimitMessage = message.includes("하루에 최대 2번");
  const cards = [
    ["추천 거주지", item.region?.name || "지역 정보 없음", `${item.scores?.region ?? score}%`, item.regionStatus?.message || item.summary || "추천 지역 정보가 없습니다."],
    ["추천 일자리", primaryJob?.title || "추천 결과 없음", `${primaryJob?.matchScore ?? item.scores?.job ?? 0}%`, item.jobStatus?.message || primaryJob?.reason || "추천 가능한 일자리 정보가 없습니다."],
    ["주변 관광지", item.places?.map?.((place) => place.name).join(" · ") || "추천 결과 없음", `${item.places?.length || 0}곳`, item.tourismStatus?.message || primaryPlace?.reason || "추천 가능한 관광지 정보가 없습니다."]
  ];

  if (results.length) {
    const residence = item.residence || item.recommendation?.residence || item.region || {};
    const residenceName = residence.residenceName || residence.name || item.region?.name || "추천 생활권";
    const residenceReason = residence.reason || residence.description || item.regionStatus?.message || item.summary || "선택한 생활 조건을 바탕으로 추천한 생활권입니다.";
    const residenceAdvantages = Array.isArray(residence.advantages) ? residence.advantages : [];
    const residenceCaution = residence.caution || "실제 주거비와 이동 조건은 정착 전에 확인해 주세요.";
    const factorScores = [
      ["종합 적합도", score],
      ["지역 적합도", Number(item.scores?.region) || 0],
      ["일자리 적합도", Number(item.scores?.job) || 0],
      ["생활·관광 적합도", Number(item.scores?.tourism) || 0]
    ];

    return <main className="ai-match-result-page-new">
      <div className="ai-result-shell">
        <header className="ai-result-hero-new">
          <div><span>AI JEOLLA LIFE MATCH</span><h1>{residenceName}</h1><p>{item.summary || residenceReason}</p></div>
          <div className="ai-result-score-new"><strong>{score}</strong><span>점</span><small>종합 매칭</small></div>
        </header>

        {results.length > 1 && <nav className="ai-result-tabs-new" aria-label="추천 결과 순위">{results.map((result) => <button className={item.rank === result.rank ? "is-active" : ""} type="button" key={result.rank} onClick={() => selectResult(result)}><b>#{result.rank}</b><span>{result.region?.name || `추천 ${result.rank}`}</span><strong>{result.scores?.overall || 0}점</strong></button>)}</nav>}

        <section className="ai-result-score-grid" aria-label="항목별 매칭 점수">{factorScores.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}<small>점</small></strong><i><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></i></article>)}</section>

        <section className="ai-result-section ai-result-residence-new">
          <header><span>01</span><div><small>추천 거주지</small><h2>{residenceName}</h2></div></header>
          <p>{residenceReason}</p>
          {residenceAdvantages.length > 0 && <div className="ai-result-advantages">{residenceAdvantages.map((advantage, index) => <article key={`${advantage}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{advantage}</span></article>)}</div>}
          <aside><strong>정착 전 확인</strong><p>{residenceCaution}</p></aside>
        </section>

        <section className="ai-result-section">
          <header><span>02</span><div><small>추천 일자리</small><h2>{item.jobs?.length ? `${item.jobs.length}개의 일자리 후보` : "추천 일자리"}</h2></div></header>
          {item.jobs?.length ? <div className="ai-result-job-list">{item.jobs.map((job, index) => { const resolvingKey = String(job.externalId || `${job.title}-${index}`); const isResolving = resolvingJob === resolvingKey; return <article key={job.externalId || job.jobKey || job.employmentInfoNo || `${job.title}-${index}`}><div><small>{job.companyName || job.company || "지역 기업"}</small><h3>{job.title || "일자리 정보"}</h3></div><dl><div><dt>지역</dt><dd>{job.region?.name || job.region || item.region?.name || "확인 필요"}</dd></div><div><dt>근무 형태</dt><dd>{job.workType || job.employmentType || "공고 확인"}</dd></div><div><dt>적합도</dt><dd>{job.matchScore ?? item.scores?.job ?? 0}점</dd></div></dl>{job.reason && <p>{job.reason}</p>}<button className="ai-result-job-link" type="button" disabled={Boolean(resolvingJob)} onClick={() => openMatchedJob(job, index)}>{isResolving ? "실제 공고 찾는 중" : "공고 상세 보기"} <span>{isResolving ? "…" : "→"}</span></button></article>; })}</div> : <p className="ai-result-empty-new">현재 조건에서 연결된 일자리 정보가 없습니다.</p>}
        </section>

        <section className="ai-result-section">
          <header><span>03</span><div><small>주변 관광지</small><h2>{item.places?.length || 0}곳의 생활권 주변 장소</h2></div></header>
          {item.places?.length ? <div className="ai-result-place-list">{item.places.map((place, index) => <article key={`${place.name}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b><div><h3>{place.name}</h3><p>{place.category || place.region || place.reason || "생활권 주변 추천 장소"}</p></div></article>)}</div> : <p className="ai-result-empty-new">추천 가능한 주변 관광지 정보가 없습니다.</p>}
        </section>

        <section className="ai-result-conditions-new"><div><small>선호 지역</small><strong>{selectedRegion?.name || item.region?.name || "전체"}</strong></div><div><small>선택 직무</small><strong>{jobInterests.join(" · ") || "선택 정보 없음"}</strong></div><div><small>생활 우선순위</small><strong>{priorities.map((value, index) => `${index + 1}. ${priorityOptions.find(([key]) => key === value)?.[1]}`).join(" · ")}</strong></div></section>

        <footer className="ai-result-footer-new"><p>조건을 바꾸면 새로운 생활권과 일자리를 다시 비교할 수 있어요.</p><button type="button" onClick={() => { sessionStorage.removeItem(AI_MATCH_CACHE_KEY); setResults([]); setSelected(null); setMessage(""); setStatus(""); }}>조건 수정하고 다시 매칭</button></footer>
      </div>
    </main>;
  }

  return <main className={`ai-match-main${results.length ? " ai-result-ready" : " ai-no-result"}`}>
    {isDailyLimitMessage && <div className="ai-limit-toast" role="alert" aria-live="assertive"><span aria-hidden="true">!</span><p><strong>오늘의 AI 매칭을 모두 사용했어요</strong><small>{message}</small></p></div>}
    <section className="ai-match-marquee">
      <div className="ai-marquee-row ai-marquee-top">{[
        "https://images.unsplash.com/photo-1628532429823-7458fb1fb02a?auto=format&fit=crop&w=700&q=80",
        "https://cdn.imweb.me/upload/S201804125acede1d68524/190c757d03a19.jpg",
        "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1646649806526-c448b87f8238?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1628532429823-7458fb1fb02a?auto=format&fit=crop&w=700&q=80",
        "https://cdn.imweb.me/upload/S201804125acede1d68524/190c757d03a19.jpg",
        "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1646649806526-c448b87f8238?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=700&q=80"
      ].map((src, index) => <img key={`top-${index}`} src={src} alt="" />)}</div>
      <div className="ai-marquee-copy-space" aria-label="AI 매칭 소개">
        <p>YOUR JEOLLA LIFE</p>
        <div className="ai-marquee-copy-rotator">
          <span>관광과 일상이 이어지는 곳</span>
          <span>나에게 맞는 일과 지역을 한 번에</span>
          <span>Create Your Jeolla Life</span>
          <span>AI가 찾는 나다운 전라도 생활</span>
        </div>
      </div>
      <div className="ai-marquee-row ai-marquee-bottom">{[...lowerMarqueeImages, ...lowerMarqueeImages].map((src, index) => <img key={`bottom-${index}`} src={src} alt="" />)}</div>
    </section>
    <div className="ai-match-workspace">
      <section className="ai-match-panel ai-match-form-panel"><form className="stack-form" onSubmit={startRequest}>
        <header className="ai-match-form-intro">
          <p>AI 전라도 라이프 매칭</p>
          <h2>나에게 맞는 전라도 생활을 찾아보세요</h2>
          <small>AI가 어울리는 생활권을 찾아드려요.</small>
        </header>
        <div className={`ai-select-field ai-region-field${regionPickerOpen ? " is-open" : ""}`} ref={regionPickerRef}><span>선호 지역</span><button className="ai-select-trigger" type="button" aria-expanded={regionPickerOpen} aria-controls="ai-region-picker" onClick={() => { setRegionQuery(""); setRegionPickerOpen((current) => !current); }}><span className={selectedRegion ? "" : "is-placeholder"}>{selectedRegion?.name || ""}</span><i className="ai-open-chevron" aria-hidden="true" /></button>{regionPickerOpen && <section className="ai-region-dropdown" id="ai-region-picker" aria-label="선호 지역 선택"><label className="ai-region-dropdown-search"><i aria-hidden="true" /><input autoFocus value={regionQuery} onChange={(event) => setRegionQuery(event.target.value)} placeholder="지역 이름 검색" /></label><div className="ai-region-options">{filteredRegions.map((region, index) => { const regionId = region.regionId || region.id; const isSelected = String(regionId) === String(preferredRegionId); return <button className={isSelected ? "is-selected" : ""} style={{ "--region-index": index }} type="button" key={regionId || region.name} onClick={() => { setPreferredRegionId(String(regionId)); setRegionPickerOpen(false); }}><span>{region.name}</span>{isSelected && <i>✓</i>}</button>; })}</div>{!filteredRegions.length && <p className="ai-picker-empty">검색 결과가 없어요.</p>}</section>}</div>
        <div className={`ai-job-field${jobPickerOpen ? " is-open" : ""}`}><span>희망 직무</span><button className="ai-select-trigger" type="button" onClick={() => setJobPickerOpen(true)}>{jobInterests.length ? <span className="ai-job-summary" aria-label={jobInterests.join(", ")}>{jobInterests.slice(0, 2).map((job) => <b key={job}>{job}</b>)}{jobInterests.length > 2 && <b className="ai-summary-more" aria-hidden="true">…</b>}</span> : <span className="ai-job-placeholder" />}<i className="ai-open-chevron" aria-hidden="true" /></button></div>
        <div className={`ai-select-field${priorityPickerOpen ? " is-open" : ""}`}><span>생활 우선순위</span><button className="ai-select-trigger" type="button" onClick={() => setPriorityPickerOpen(true)}>{priorities.length ? <span className="ai-priority-summary" aria-label={priorities.map((value, index) => `${index + 1}. ${priorityOptions.find(([key]) => key === value)?.[1]}`).join(", ")}>{priorities.slice(0, 2).map((value, index) => <b key={value}>{index + 1}. {priorityOptions.find(([key]) => key === value)?.[1]}</b>)}{priorities.length > 2 && <b className="ai-summary-more" aria-hidden="true">…</b>}</span> : <span className="is-placeholder" />}<i className="ai-open-chevron" aria-hidden="true" /></button></div>
        <label className="ai-thought-field"><span>생각과 추가 조건</span><textarea name="thought" maxLength="100" placeholder="" value={thought} onChange={(event) => setThought(event.target.value)} /></label>
        <button className="ai-match-submit" type="submit" disabled={loading}>{loading ? "AI가 분석하고 있어요" : "AI 전라도 라이프 매칭 시작"}</button><div className={`page-status${message && !isDailyLimitMessage ? " is-visible" : ""}`}>{isDailyLimitMessage ? "" : message}{status && status !== "COMPLETED" && !isDailyLimitMessage ? ` (${status})` : ""}</div>
      </form></section>
      {results.length ? <section className="ai-match-panel ai-match-result-panel">
        <div className="score-overview"><div className="score-ring" style={{ "--score": `${score}%` }}><div><strong>{score}</strong><span>%</span></div></div><div className="score-copy"><p className="eyebrow dark">AI 지역·일자리 매칭 결과</p><h3>{item.region?.name ? `${item.region.name} ${score}% 매칭` : "조건을 입력해 주세요"}</h3><p>{item.summary || "생활 조건을 입력하면 지역과 일자리를 함께 추천합니다."}</p></div></div>
        <img className="ai-match-photo" src={primaryPlace?.imageUrl || "/assets/JvLTt.jpeg"} alt={primaryPlace?.name || "전라도 바다 생활권 풍경"} />
        {results.length > 1 && <div className="ai-match-result-tabs">{results.map((result) => <button className={item.rank === result.rank ? "is-active" : ""} type="button" key={result.rank} onClick={() => selectResult(result)}>#{result.rank} {result.region?.name} · {result.scores?.overall || 0}점</button>)}</div>}
        <div className="record-list">{cards.map(([label, value, badge, copy], index) => <article className="record-item ai-detail-card" key={label}><div className="record-head"><div><span>{label}</span><h3>{value}</h3></div><strong className="record-score">{badge}</strong></div><p>{copy}</p>{index === 1 && primaryJob?.region?.name && primaryJob.region.regionId !== item.region?.regionId && <p>대체 추천 지역: {primaryJob.region.name}</p>}{index === 1 && primaryJob?.externalId ? <Link className="ai-detail-hint" to={externalJobDetailPath({ externalSource: primaryJob.source === "JUNNAM_PUBLIC_JOB" ? "junnam" : "tour", externalId: primaryJob.externalId })}>공고 상세 보기 →</Link> : <small className="ai-detail-hint">정보 보기 →</small>}</article>)}</div>
      </section> : null}
    </div>
    {loading && <div className="ai-processing"><div className="ai-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="ai-analysis-title"><div className="ai-model-badge">AI · 관광데이터 × 지역 일자리</div><span className="ai-analysis-pulse" aria-hidden="true"><i /><i /><i /></span><h2 id="ai-analysis-title">전라도 생활권을 매칭하고 있어요</h2><p>관광데이터와 채용정보를 결합해 살 곳·일자리·주변 관광지를 찾고 있어요.</p><div className="ai-analysis-steps">{["희망 생활 조건 분석", "지역 관광데이터 매칭", "일자리·생활권 결합", "최종 추천 결과 생성"].map((label, index) => <div className={`ai-analysis-step${index < analysisStep ? " is-complete" : index === analysisStep ? " is-active" : ""}`} key={label}><span>{index + 1}</span><strong>{label}</strong><i>{index < analysisStep ? "✓" : index === analysisStep ? "●" : "○"}</i></div>)}</div><div className="ai-analysis-progress"><span style={{ width: `${(analysisStep + 1) * 25}%` }} /></div><small>{analysisStep === 3 ? "추천 결과를 정리하고 있어요" : "잠시만 기다려 주세요"} · {analysisStep + 1} / 4 단계</small></div></div>}
    {jobPickerOpen && <div className="ai-picker-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setJobPickerOpen(false); }}><section className="ai-job-dialog" role="dialog" aria-modal="true" aria-labelledby="job-picker-title"><div className="ai-picker-title"><div><small>희망 직무 선택</small><h2 id="job-picker-title">원하는 업·직종을 선택해 주세요</h2></div><button type="button" aria-label="닫기" onClick={() => setJobPickerOpen(false)}>×</button></div><div className="ai-modal-search"><span aria-hidden="true">⌕</span><input autoFocus value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} placeholder="업·직종 키워드 검색" /></div><div className="ai-job-browser"><nav>{jobOptions.map((group) => <button className={!jobQuery && activeJobGroup === group ? "is-active" : ""} type="button" key={group} onClick={() => { setActiveJobGroup(group); setJobQuery(""); }}>{group}</button>)}</nav><div><h3>{jobQuery ? "검색 결과" : activeJobGroup}</h3><div className="ai-job-detail-options">{visibleJobs.map((job) => <button className={jobInterests.includes(job) ? "is-selected" : ""} type="button" key={job} onClick={() => toggleJob(job)}>{job}{jobInterests.includes(job) && <span>✓</span>}</button>)}</div></div></div><div className="ai-job-selection-status"><div>{jobInterests.length ? jobInterests.map((job) => <button type="button" key={job} onClick={() => toggleJob(job)}>{job}<span aria-hidden="true">×</span></button>) : <span>선택한 직무가 없습니다.</span>}</div><strong>{jobInterests.length}개 선택됨</strong></div><div className="ai-job-dialog-footer"><span /><button type="button" disabled={!jobInterests.length} onClick={() => setJobPickerOpen(false)}>선택 완료</button></div></section></div>}
    {priorityPickerOpen && <div className="ai-picker-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPriorityPickerOpen(false); }}><section className="ai-priority-dialog" role="dialog" aria-modal="true" aria-labelledby="priority-picker-title"><div className="ai-picker-title"><div><small>생활 우선순위 선택</small><h2 id="priority-picker-title">중요한 순서대로 선택해 주세요</h2><p>선택한 항목이 1번부터 차례대로 들어갑니다.</p></div><button type="button" aria-label="닫기" onClick={() => setPriorityPickerOpen(false)}>×</button></div><div className="ai-priority-slots">{[0, 1, 2, 3].map((index) => { const value = priorities[index]; const label = priorityOptions.find(([key]) => key === value)?.[1]; return <div className={value ? "is-filled" : ""} key={index}><b>{index + 1}</b>{label && <span>{label}</span>}</div>; })}</div><div className="ai-priority-choices">{priorityOptions.map(([value, label]) => { const rank = priorities.indexOf(value); return <button className={rank >= 0 ? "is-selected" : ""} type="button" key={value} onClick={() => togglePriority(value)}><span>{label}</span>{rank >= 0 && <b>{rank + 1}순위 ✓</b>}</button>; })}</div><div className="ai-job-dialog-footer"><button className="ai-priority-reset" type="button" disabled={!priorities.length} onClick={() => setPriorities([])}>다시 선택</button><button type="button" disabled={priorities.length !== 4} onClick={() => setPriorityPickerOpen(false)}>선택 완료</button></div></section></div>}
  </main>;
}
