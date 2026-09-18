import { useState } from "react";
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

export default function JunnamJobDetailPage() {
  const { jobKey } = useParams();
  const navigate = useNavigate();
  const { data: job, loading, error } = useApi(jobKey ? externalJunnamJobPath(jobKey) : "", { immediate: Boolean(jobKey) });
  const favorites = useJobFavorites();
  const [favoriteMessage, setFavoriteMessage] = useState("");
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

  async function toggleFavorite() {
    if (!hasSession()) { setFavoriteMessage("로그인 후 일자리를 찜할 수 있어요."); return; }
    if (!favoritePayload.externalId || favoriteBusy) return;
    setFavoriteMessage("");
    try {
      const saved = await favorites.toggle(favoritePayload);
      setFavoriteMessage(saved ? "마이페이지 찜한 일자리에 저장했습니다." : "찜을 취소했습니다.");
    } catch (requestError) { setFavoriteMessage(requestError.message); }
  }

  function search(event) {
    event.preventDefault();
    const region = new FormData(event.currentTarget).get("region");
    navigate(region ? `/map?view=search&region=${encodeURIComponent(region)}` : "/map?view=search");
  }

  return <main className="job-detail-main junnam-job-detail-main">
    <section className="job-detail-intro"><div><p className="eyebrow dark">전남 공공 일자리</p><h1>{title}</h1></div><p>업무·위치·근무 조건을 확인하고 지원 여부를 결정해 보세요.</p></section>
    <Status loading={loading} error={error} empty={!valid}>{valid && <div className="job-detail-workspace">
      <aside className="job-criteria-card">
        <div className="job-detail-card-head"><h2>일자리 검색</h2><span>외부 공고</span></div>
        <p className="job-detail-search-copy">원하는 지역을 선택하면 전남 공공 일자리 목록으로 이동해요.</p>
        <form className="job-detail-search-form" onSubmit={search}><label>지역<select name="region" defaultValue={category}><option value="">전체 지역</option>{["나주", "목포", "순천", "여수", "광양", "보성", "화순", "담양", "해남", "완도"].map((region) => <option key={region}>{region}</option>)}</select></label><div className="job-detail-secondary-actions"><button className="button button-primary job-detail-search-button" type="submit">조건으로 검색하기</button><Link className="button job-detail-back-button" to="/map?view=search">목록으로 돌아가기</Link></div></form>
        <section className="job-apply-card"><div><p>지원 안내</p><h3>이 공고가 마음에 드나요?</h3><span>공고의 연락처와 접수 방법을 확인해 주세요.</span></div><div className="job-apply-actions">{tel && <a className="button button-primary" id="job-apply-open" href={`tel:${String(tel).replace(/[^0-9+]/g, "")}`}>전화 문의하기</a>}<button className={`button job-favorite-button${favorited ? " is-favorite" : ""}`} type="button" disabled={favoriteBusy} aria-pressed={favorited} aria-label={favorited ? "일자리 찜취소" : "일자리 찜하기"} title={favorited ? "찜취소" : "찜하기"} onClick={toggleFavorite}><i aria-hidden="true">{favorited ? "♥" : "♡"}</i><b>{favorited ? "찜취소" : "찜하기"}</b></button></div>{(favoriteMessage || favorites.error) && <span role="status">{favoriteMessage || favorites.error}</span>}</section>
      </aside>
      <section className="job-detail-results">
        <p className="result-kind">공고 상세 정보</p>
        <article className="job-insight-card"><img className="job-insight-photo" src={jobImage || representativeImage} alt={jobImage ? `${title} 공고 이미지` : "전남 지역 일자리 대표 이미지"} /><div><p className="eyebrow">LOCAL JOB</p><h2>{category}에서 찾은 공공 일자리예요</h2><p>근무 조건과 접수 방법을 확인한 뒤 담당자에게 문의해 보세요.</p><div className="job-insight-chips"><span>{category}</span><span>{jobImage ? "공고 제공 이미지" : "서비스 대표 이미지"}</span><span>{insertedAt} 등록</span></div></div></article>
        <article className="job-detail-hero-card"><p className="eyebrow">{category}</p><h2>{title}</h2><p>{writer} · {insertedAt} · 조회 {readCount}</p><div className="job-detail-metrics"><div><span>급여</span><strong>{pay}</strong></div><div><span>근무 시간</span><strong>{workTime}</strong></div><div><span>접수 마감</span><strong>{deadline}</strong></div></div></article>
        <section className="job-accordion-section"><h2>모집 및 근무 조건</h2><details open><summary>공고 조건 {Math.max(details.length, 1)}개 보기</summary><div className="job-accordion-body">{details.length ? details.map(([label, value], index) => <span key={`${label}-${index}`}><strong>{label}</strong> · {value}</span>) : <span>{content}</span>}</div></details></section>
        {parsed.notes.length > 0 && <section className="job-accordion-section job-notice-section"><h2>추가 안내</h2><div className="job-accordion-body">{parsed.notes.map((line, index) => <span key={index}>{line}</span>)}</div></section>}
        <article className="job-location-card"><div><p className="eyebrow">근무 위치</p><h2>{address || category}</h2><p>{address ? "공고에 안내된 주소를 기준으로 표시합니다." : "정확한 근무지는 담당자에게 확인해 주세요."}</p></div><JobKakaoMap address={address} title={title} /><div className="job-location-meta"><div><span>지역</span><strong>{category}</strong></div><div><span>담당</span><strong>{writer}</strong></div>{tel && <div><span>공고 기재 연락처</span><strong>{tel}</strong></div>}</div></article>
        <article className="job-duties-card"><h2>지원 전에 확인하세요</h2><div className="job-duty-row"><span>•</span><div><strong>공고 내용 확인</strong><p>업무 내용과 근무 조건이 본인에게 맞는지 확인해 주세요.</p></div></div><div className="job-duty-row"><span>•</span><div><strong>접수 일정 확인</strong><p>{deadline}까지 필요한 서류와 접수 방법을 확인해 주세요.</p></div></div>{homepageUrl && <div className="job-duty-row"><span>•</span><div><strong>원문 공고</strong><p><a href={homepageUrl} target="_blank" rel="noreferrer">최신 공고 확인하기 ↗</a></p></div></div>}</article>
      </section>
    </div>}</Status>
  </main>;
}
