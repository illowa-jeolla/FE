import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { externalJunnamJobPath } from "../api/jobs";
import { hasSession } from "../auth/session";
import { favoriteKey, useJobFavorites } from "../hooks/useJobFavorites";
import { useApi } from "../hooks/useApi";
import { Status } from "../components/UI";
import JobKakaoMap from "../components/JobKakaoMap";

function field(job, key, rawKey, fallback = "") {
  const value = job?.[key] ?? job?.rawFields?.[rawKey];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function parseNotice(content) {
  const entries = [], notes = [];
  String(content || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const match = line.replace(/^[■□●○◆◇▪▫▶▷※*★\s]+/, "").match(/^([^:：]{1,18})\s*[:：]\s*(.+)$/);
    match ? entries.push([match[1].trim(), match[2].trim()]) : notes.push(line);
  });
  const find = (...labels) => entries.find(([label]) => labels.some((item) => label.includes(item)))?.[1] || "";
  return { entries, notes, find };
}

function safeUrl(value) {
  try { const url = new URL(String(value || "")); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}

function BackendDataRows({ job }) {
  const values = { ...(job?.rawFields || {}), ...(job || {}) };
  delete values.rawFields;
  const labels = { jobKey: "공고 번호", jobTitle: "공고 제목", title: "공고 제목", jobCategoryNm: "지역", categoryName: "지역", jobContent: "공고 원문", content: "공고 원문", jobInsertDt: "등록일", insertedAt: "등록일", jobReadCnt: "조회 수", readCount: "조회 수", jobStartDt: "공고 시작일", jobManager: "등록 담당자", writer: "등록 담당자", jobLink: "원문 링크", homepageUrl: "원문 링크", jobStatus: "접수 상태", address: "근무지", tel: "연락처", companyName: "업체명", imageUrl: "공고 이미지", thumbnailUrl: "대표 이미지" };
  const seen = new Set();
  const rows = Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "").map(([key, value]) => [labels[key] || key, typeof value === "object" ? JSON.stringify(value) : String(value)]).filter(([, value]) => { const normalized = value.replace(/\s+/g, " ").trim(); if (seen.has(normalized)) return false; seen.add(normalized); return true; });
  if (!rows.length) return null;
  return <section className="job-backend-data"><h2>공고 제공 정보</h2><p>공고 등록 기관에서 함께 제공한 상세 정보입니다.</p><div>{rows.map(([label, value], index) => <dl className={value.length > 180 ? "is-long" : ""} key={`${label}-${index}`}><dt>{label}</dt><dd>{/^https?:\/\//.test(value) ? <a href={value} target="_blank" rel="noreferrer">원문에서 확인하기 ↗</a> : label === "공고 원문" ? <p className="job-source-content">{value}</p> : value.length > 180 ? <details><summary>전체 내용 보기</summary><p>{value}</p></details> : value}</dd></dl>)}</div></section>;
}

export default function JunnamJobDetailPage() {
  const { jobKey } = useParams();
  const navigate = useNavigate();
  const { data: job, loading, error } = useApi(jobKey ? externalJunnamJobPath(jobKey) : "", { immediate: Boolean(jobKey) });
  const favorites = useJobFavorites();
  const [favoriteMessage, setFavoriteMessage] = useState("");
  const [favoriteToast, setFavoriteToast] = useState(null);
  const [pageLeaving, setPageLeaving] = useState(false);
  const title = field(job, "title", "jobTitle", "일자리 상세");
  const category = field(job, "categoryName", "jobCategoryNm", "전남");
  const writer = field(job, "writer", "jobWriter", "공고 담당자");
  const insertedAt = field(job, "insertedAt", "jobInsertDt", "등록일 미정");
  const readCount = field(job, "readCount", "jobReadCnt", "0");
  const content = field(job, "content", "jobContent", "상세 내용이 제공되지 않았습니다.");
  const parsed = parseNotice(content);
  const address = field(job, "address", "jobAddress") || parsed.find("근무지역", "주소", "근무지");
  const tel = field(job, "tel", "jobTel") || parsed.find("연락처", "문의", "전화");
  const homepageUrl = safeUrl(field(job, "homepageUrl", "homepageUrl"));
  const jobImage = field(job, "imageUrl", "imageUrl") || field(job, "thumbnailUrl", "thumbnailUrl");
  const representativeImage = new URL("../../../assets/OZ3bs.jpeg", import.meta.url).href;
  const pay = parsed.find("급여", "임금", "연봉") || "공고 내용 확인";
  const workTime = parsed.find("근무시간", "근무 시간") || "공고 내용 확인";
  const deadline = parsed.find("마감일", "접수기간", "모집기간") || "채용 시 마감";
  const excluded = ["제목", "상호", "연락처", "문의", "전화", "근무지역", "주소", "근무지", "급여", "임금", "연봉", "근무시간", "근무 시간", "마감일", "접수기간", "모집기간"];
  const details = parsed.entries.filter(([label]) => !excluded.some((item) => label.includes(item)));
  const valid = Boolean(job && (job.jobKey || job.rawFields?.jobKey || job.title));
  const favoriteExternalId = String(job?.jobKey || job?.rawFields?.jobKey || jobKey || "").slice(0, 100);
  const favoriteCompanyName = String(field(job, "companyName", "companyName") || writer || "").trim().slice(0, 255);
  const favoritePayload = {
    source: "JUNNAM_PUBLIC_JOB",
    externalId: favoriteExternalId,
    title: String(title).slice(0, 255),
    ...(favoriteCompanyName ? { companyName: favoriteCompanyName } : {}),
    ...(address ? { address: String(address) } : {}),
    ...(deadline ? { deadline: String(deadline).slice(0, 50) } : {}),
    ...(homepageUrl ? { sourceUrl: homepageUrl } : {})
  };

  const favoriteIdentity = favoriteKey(favoritePayload);
  const favorited = favorites.items.some((item) => favoriteKey(item) === favoriteIdentity);
  const favoriteBusy = favorites.loading || favorites.pending.has(favoriteIdentity);
  const [activeSection, setActiveSection] = useState("working-conditions");

  useEffect(() => {
    if (!favoriteToast) return undefined;
    const timer = window.setTimeout(() => setFavoriteToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [favoriteToast]);

  useEffect(() => {
    const ids = ["working-conditions", "recruitment-conditions", "work-location", "application-guide"];
    let frame = 0;
    function updateActiveSection() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
        if (!sections.length) return;
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          setActiveSection(sections.at(-1).id);
          return;
        }
        const current = sections.filter((section) => section.getBoundingClientRect().top <= 155).at(-1) || sections[0];
        setActiveSection(current.id);
      });
    }
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", updateActiveSection); window.removeEventListener("resize", updateActiveSection); };
  }, [valid]);

  async function toggleFavorite() {
    if (!hasSession()) { setFavoriteMessage("로그인 후 일자리를 찜할 수 있어요."); return; }
    if (!favoritePayload.externalId || favoriteBusy) return;
    setFavoriteMessage("");
    try {
      const saved = await favorites.toggle(favoritePayload);
      setFavoriteMessage("");
      setFavoriteToast({ id: Date.now(), text: saved ? "찜한 일자리에 저장했어요." : "찜을 취소했어요." });
    } catch (requestError) { setFavoriteMessage(requestError.message); }
  }

  function returnToJobs(event) {
    event.preventDefault();
    if (pageLeaving) return;
    setPageLeaving(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    window.setTimeout(() => navigate("/jobs"), delay);
  }

  return <main className={`job-detail-main junnam-job-detail-main${valid ? " is-content-ready" : ""}${pageLeaving ? " is-page-leaving" : ""}`}>
    {favoriteToast && <div className="job-favorite-toast" key={favoriteToast.id} role="status"><span aria-hidden="true">♥</span>{favoriteToast.text}</div>}
    <Link className="job-detail-fixed-back" to="/jobs" onClick={returnToJobs}>← 목록으로 돌아가기</Link>
    {!loading && <section className="job-detail-intro"><div><p className="eyebrow dark">전남 공공 일자리</p><h1>{title}</h1><strong>{writer}</strong></div><p>{insertedAt} 등록 · 조회 {readCount}</p></section>}
    <Status loading={loading} error={error} empty={!valid} loadingVariant="plain">{valid && <><nav className="job-detail-tabs" aria-label="공고 상세 메뉴">{[["working-conditions", "근무조건"], ["recruitment-conditions", "모집조건"], ["work-location", "근무지역"], ["application-guide", "지원방법"]].map(([id, label]) => <a className={activeSection === id ? "is-active" : ""} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} key={id}>{label}</a>)}</nav><div className="job-detail-workspace job-detail-workspace-full">
      <section className="job-detail-results">
        <p className="result-kind">공고 상세 정보</p>
        <article className="job-insight-card"><img className="job-insight-photo" src={jobImage || representativeImage} alt={jobImage ? `${title} 공고 이미지` : "전남 지역 일자리 대표 이미지"} /><div><p className="eyebrow">LOCAL JOB</p><h2>{category}에서 찾은 공공 일자리예요</h2><p>근무 조건과 접수 방법을 확인한 뒤 담당자에게 문의해 보세요.</p><div className="job-insight-chips"><span>{category}</span><span>{jobImage ? "공고 제공 이미지" : "서비스 대표 이미지"}</span><span>{insertedAt} 등록</span></div></div></article>
        <article className="job-detail-hero-card" id="working-conditions"><p className="eyebrow">{category}</p><h2>근무조건</h2><div className="job-detail-metrics"><div><span>급여</span><strong>{pay}</strong></div><div><span>근무 시간</span><strong>{workTime}</strong></div><div><span>접수 마감</span><strong>{deadline}</strong></div></div></article>
        <section className="job-accordion-section" id="recruitment-conditions"><h2>모집조건</h2><details open><summary>공고 조건 {Math.max(details.length, 1)}개 보기</summary><div className="job-accordion-body">{details.length ? details.map(([label, value], index) => <span key={`${label}-${index}`}><strong>{label}</strong> · {value}</span>) : <span>{content}</span>}</div></details></section>
        {parsed.notes.length > 0 && <section className="job-accordion-section job-notice-section"><h2>추가 안내</h2><div className="job-accordion-body">{parsed.notes.map((line, index) => <span key={index}>{line}</span>)}</div></section>}
        <article className="job-location-card" id="work-location"><div><p className="eyebrow">근무지역</p><h2>{address || category}</h2><p>{address ? "공고에 안내된 주소를 기준으로 표시합니다." : "정확한 근무지는 담당자에게 확인해 주세요."}</p></div><JobKakaoMap address={address} title={title} /><div className="job-location-meta"><div><span>지역</span><strong>{category}</strong></div><div><span>담당</span><strong>{writer}</strong></div>{tel && <div><span>공고 기재 연락처</span><strong>{tel}</strong></div>}</div></article>
        <article className="job-duties-card" id="application-guide"><h2>지원방법</h2><div className="job-duty-row"><span>•</span><div><strong>공고 내용 확인</strong><p>업무 내용과 근무 조건이 본인에게 맞는지 확인해 주세요.</p></div></div><div className="job-duty-row"><span>•</span><div><strong>접수 일정 확인</strong><p>{deadline}까지 필요한 서류와 접수 방법을 확인해 주세요.</p></div></div>{homepageUrl && <div className="job-duty-row"><span>•</span><div><strong>원문 공고</strong><p><a href={homepageUrl} target="_blank" rel="noreferrer">최신 공고 확인하기 ↗</a></p></div></div>}</article>
        <BackendDataRows job={job} />
        <section className="job-apply-card job-apply-card-inline job-apply-card-bottom"><div><p>관심 공고</p><h3>이 공고가 마음에 드나요?</h3><span>찜해두면 마이페이지에서 다시 확인할 수 있어요.</span></div><div className="job-apply-actions"><button className={`button job-favorite-button${favorited ? " is-favorite" : ""}`} type="button" disabled={favoriteBusy} aria-pressed={favorited} aria-label={favorited ? "일자리 찜취소" : "일자리 찜하기"} title={favorited ? "찜취소" : "찜하기"} onClick={toggleFavorite}><i aria-hidden="true">{favorited ? "♥" : "♡"}</i><b>{favorited ? "찜취소" : "찜하기"}</b></button></div>{(favoriteMessage || favorites.error) && <span role="status">{favoriteMessage || favorites.error}</span>}</section>
      </section>
    </div></>}</Status>
  </main>;
}
