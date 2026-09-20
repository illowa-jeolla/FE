import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { externalTourJobPath } from "../api/jobs";
import { Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

function plainText(content) {
  return String(content ?? "")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function value(job, key, fallback = "-") {
  const result = job?.[key] ?? job?.rawFields?.[key];
  return result === undefined || result === null || result === "" ? fallback : plainText(result);
}

function codeValue(job, key) {
  return value(job, key);
}

function yesNo(valueToFormat) {
  if (valueToFormat === "Y") return "포함";
  if (valueToFormat === "N") return "미포함";
  return valueToFormat || "-";
}

function safeExternalUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function DetailRows({ rows }) {
  return <div className="job-accordion-body">{rows.map(([label, content]) => [label, plainText(content)]).filter(([, content]) => content && content !== "-").map(([label, content]) => <p key={label}><strong>{label}</strong> · {content}</p>)}</div>;
}

function BackendDataRows({ job }) {
  const values = { ...(job?.rawFields || {}), ...(job || {}) };
  delete values.rawFields;
  const labels = { employmentInfoNo: "공고 번호", title: "공고 제목", companyName: "기업명", enterpriseTypeName: "기업 유형", departmentName: "담당 부서", workplaceAddress: "근무지 주소", workplaceDetailAddress: "상세 주소", workplaceZipcode: "우편번호", recruitCount: "채용 인원", receiptDeadlineDate: "접수 마감일", wageAmount: "급여", salaryTypeCode: "급여 형태", workTimeContent: "근무 시간", laborTimeContent: "근로 시간", workStyleContent: "근무 형태", careerDivisionCode: "경력 구분", careerStartMonths: "최소 경력", careerEndMonths: "최대 경력", educationCode: "학력", bonusIncluded: "상여금 포함", bonusRate: "상여금 비율", fourMajorInsurance: "4대 보험", welfareEtcContent: "복리후생", dutyContent: "업무 내용", selectionMethodContent: "전형 방법", receptionMethod: "접수 방법", etcReceptionMethodDescription: "접수 안내", submissionDocumentContent: "제출 서류", foreignLanguageLevel: "외국어", majorName: "관련 전공", licenseContent: "자격·우대", etcPreferenceContent: "기타 우대", computerAbilityContent: "컴퓨터 활용", militaryServiceExperience: "병역", managerName: "담당자", managerTelNo: "담당자 연락처", managerFaxNo: "팩스", companyIntroContent: "기업 소개", companyAddress: "기업 주소", primaryBusinessContent: "주요 사업", workerCountInfo: "근로자 수", capitalAmount: "자본금", annualSalesAmount: "연 매출", detailUrl: "원문 링크" };
  const seen = new Set();
  const rows = Object.entries(values).filter(([, content]) => content !== undefined && content !== null && content !== "").map(([key, content]) => [labels[key] || key, plainText(typeof content === "object" ? JSON.stringify(content) : content)]).filter(([, content]) => { const normalized = content.replace(/\s+/g, " ").trim(); if (seen.has(normalized)) return false; seen.add(normalized); return true; });
  if (!rows.length) return null;
  return <section className="job-backend-data"><h2>공고 제공 정보</h2><p>공고 등록 기관에서 함께 제공한 상세 정보입니다.</p><div>{rows.map(([label, content], index) => <dl className={content.length > 180 ? "is-long" : ""} key={`${label}-${index}`}><dt>{label}</dt><dd>{/^https?:\/\//.test(content) ? <a href={content} target="_blank" rel="noreferrer">원문에서 확인하기 ↗</a> : label === "공고 원문" ? <p className="job-source-content">{content}</p> : content.length > 180 ? <details><summary>전체 내용 보기</summary><p>{content}</p></details> : content}</dd></dl>)}</div></section>;
}

export default function TourJobDetailPage() {
  const { employmentInfoNo } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = location.state?.from === "ai-match" ? "/local-fit" : "/jobs";
  const returnLabel = location.state?.from === "ai-match" ? "← AI 매칭으로 돌아가기" : "← 목록으로 돌아가기";
  const path = employmentInfoNo ? externalTourJobPath(employmentInfoNo) : "";
  const { data: job, loading, error } = useApi(path, { immediate: Boolean(path) });
  const detailUrl = safeExternalUrl(value(job, "detailUrl", ""));
  const valid = Boolean(job?.employmentInfoNo || job?.title);
  const workplace = [value(job, "workplaceAddress", ""), value(job, "workplaceDetailAddress", "")].filter(Boolean).join(" ");
  const [activeSection, setActiveSection] = useState("tour-work");
  const [pageLeaving, setPageLeaving] = useState(false);

  useEffect(() => {
    const ids = ["tour-work", "tour-recruit", "tour-location", "tour-apply", "tour-company"];
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

  function returnToJobs(event) {
    event.preventDefault();
    if (pageLeaving) return;
    setPageLeaving(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    window.setTimeout(() => navigate(returnPath), delay);
  }

  return <main className={`job-detail-main albamon-job-detail-main${valid ? " is-content-ready" : ""}${pageLeaving ? " is-page-leaving" : ""}`}>
    <Link className="job-detail-fixed-back" to={returnPath} onClick={returnToJobs}>{returnLabel}</Link>
    {!loading && <section className="job-detail-intro"><div><p className="eyebrow dark">광주·전남 관광인 일자리</p><h1>{job?.title || "관광인 일자리 상세"}</h1><strong>{value(job, "companyName", value(job, "enterpriseTypeName", "관광 관련 기업"))}</strong></div><div className="page-intro-actions">{detailUrl && <a className="button button-primary" href={detailUrl} target="_blank" rel="noreferrer">원문 보기 ↗</a>}</div></section>}
    <Status loading={loading} error={error} empty={!valid} loadingVariant="plain">{valid && <><nav className="job-detail-tabs" aria-label="공고 상세 메뉴">{[["tour-work", "근무조건"], ["tour-recruit", "모집조건"], ["tour-location", "근무지역"], ["tour-apply", "지원방법"], ["tour-company", "기업정보"]].map(([id, label]) => <a className={activeSection === id ? "is-active" : ""} href={`#${id}`} aria-current={activeSection === id ? "location" : undefined} key={id}>{label}</a>)}</nav><div className="job-detail-results job-detail-results-wide">
      <article className="job-detail-hero-card" id="tour-work"><p className="eyebrow">근무조건</p><h2>{job.title}</h2><div className="job-detail-metrics"><div><span>급여</span><strong>{value(job, "wageAmount", "공고 확인")}</strong></div><div><span>근무 시간</span><strong>{value(job, "workTimeContent", "시간 협의")}</strong></div><div><span>접수 마감</span><strong>{value(job, "receiptDeadlineDate", "채용 시 마감")}</strong></div></div></article>
      <article className="job-detail-section-card" id="tour-recruit"><h2>모집조건</h2><p style={{ whiteSpace: "pre-wrap" }}>{value(job, "dutyContent", "업무 내용이 제공되지 않았습니다.")}</p><DetailRows rows={[["채용 인원", `${value(job, "recruitCount")}명`], ["고용 형태", codeValue(job, "employmentTypeCode1")], ["근로 시간", value(job, "laborTimeContent")], ["근무 형태", value(job, "workStyleContent")], ["경력", `${codeValue(job, "careerDivisionCode")} (${value(job, "careerStartMonths", "0")}~${value(job, "careerEndMonths", "0")}개월)`], ["학력", codeValue(job, "educationCode")], ["상여금", `${yesNo(value(job, "bonusIncluded", ""))}${job.bonusRate ? ` · ${job.bonusRate}%` : ""}`], ["4대 보험", value(job, "fourMajorInsurance")], ["복리후생", value(job, "welfareEtcContent")]]} /></article>
      <article className="job-location-card" id="tour-location"><div><p className="eyebrow">근무지역</p><h2>{workplace || "근무지 미제공"}</h2><p>우편번호 {value(job, "workplaceZipcode")}</p></div><div><p className="eyebrow">채용 담당자</p><h2>{value(job, "managerName")}</h2><p>{value(job, "departmentName")} · {value(job, "managerTelNo")}</p></div></article>
      <article className="job-detail-section-card" id="tour-apply"><h2>지원방법</h2><DetailRows rows={[["전형 방법", value(job, "selectionMethodContent")], ["접수 방법", value(job, "receptionMethod")], ["접수 안내", value(job, "etcReceptionMethodDescription")], ["제출 서류", value(job, "submissionDocumentContent")], ["외국어", value(job, "foreignLanguageLevel")], ["관련 전공·경력", value(job, "majorName")], ["자격·우대", value(job, "licenseContent")], ["기타 우대", value(job, "etcPreferenceContent")], ["컴퓨터 활용", value(job, "computerAbilityContent")], ["병역", value(job, "militaryServiceExperience")]]} /></article>
      <article className="job-detail-section-card" id="tour-company"><h2>기업정보</h2><p style={{ whiteSpace: "pre-wrap" }}>{value(job, "companyIntroContent", "기업 소개가 제공되지 않았습니다.")}</p><DetailRows rows={[["회사 주소", value(job, "companyAddress")], ["주요 사업", value(job, "primaryBusinessContent")], ["근로자 수", value(job, "workerCountInfo")], ["자본금", value(job, "capitalAmount")], ["연 매출", value(job, "annualSalesAmount")], ["팩스", value(job, "managerFaxNo")]]} /></article>
      <BackendDataRows job={job} />
    </div></>}</Status>
  </main>;
}
