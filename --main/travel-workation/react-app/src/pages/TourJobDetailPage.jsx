import { Link, useParams } from "react-router-dom";
import { externalTourJobPath } from "../api/jobs";
import { Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

function value(job, key, fallback = "-") {
  const result = job?.[key] ?? job?.rawFields?.[key];
  return result === undefined || result === null || result === "" ? fallback : result;
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
  return <div className="job-accordion-body">{rows.filter(([, content]) => content && content !== "-").map(([label, content]) => <p key={label}><strong>{label}</strong> · {content}</p>)}</div>;
}

export default function TourJobDetailPage() {
  const { employmentInfoNo } = useParams();
  const path = employmentInfoNo ? externalTourJobPath(employmentInfoNo) : "";
  const { data: job, loading, error } = useApi(path, { immediate: Boolean(path) });
  const detailUrl = safeExternalUrl(value(job, "detailUrl", ""));
  const valid = Boolean(job?.employmentInfoNo || job?.title);
  const workplace = [value(job, "workplaceAddress", ""), value(job, "workplaceDetailAddress", "")].filter(Boolean).join(" ");

  return <main className="feature-page-main">
    <section className="page-intro"><div><p className="eyebrow dark">관광인 일자리</p><h1>{job?.title || "관광인 일자리 상세"}</h1></div><div className="page-intro-actions"><Link className="button" to="/map?view=search">목록으로 돌아가기</Link>{detailUrl && <a className="button button-primary" href={detailUrl} target="_blank" rel="noreferrer">원문 보기 ↗</a>}</div></section>
    <section className="page-panel"><Status loading={loading} error={error} empty={!valid}>{valid && <div className="job-detail-results">
      <article className="job-detail-hero-card"><p className="eyebrow">광주·전남 관광인 일자리</p><h2>{job.title}</h2><p>{value(job, "enterpriseTypeName", "관광 관련 기업")} · {value(job, "departmentName", "담당 부서 미정")}</p><div className="job-detail-metrics"><div><span>채용 인원</span><strong>{value(job, "recruitCount")}명</strong></div><div><span>고용 형태 코드</span><strong>{codeValue(job, "employmentTypeCode1")}</strong></div><div><span>접수 마감</span><strong>{value(job, "receiptDeadlineDate", "채용 시 마감")}</strong></div></div></article>
      <article className="job-detail-hero-card"><h2>업무 및 근무 조건</h2><p style={{ whiteSpace: "pre-wrap" }}>{value(job, "dutyContent", "업무 내용이 제공되지 않았습니다.")}</p><DetailRows rows={[["근무 시간", value(job, "workTimeContent")], ["근로 시간", value(job, "laborTimeContent")], ["근무 형태", value(job, "workStyleContent")], ["경력 코드", `${codeValue(job, "careerDivisionCode")} (${value(job, "careerStartMonths", "0")}~${value(job, "careerEndMonths", "0")}개월)`], ["학력 코드", codeValue(job, "educationCode")], ["급여 형태 코드", codeValue(job, "salaryTypeCode")], ["급여액", value(job, "wageAmount")], ["상여금", `${yesNo(value(job, "bonusIncluded", ""))}${job.bonusRate ? ` · ${job.bonusRate}%` : ""}`], ["4대 보험", value(job, "fourMajorInsurance")], ["복리후생", value(job, "welfareEtcContent")]]} /></article>
      <article className="job-location-card"><div><p className="eyebrow">근무지</p><h2>{workplace || "근무지 미제공"}</h2><p>우편번호 {value(job, "workplaceZipcode")}</p></div><div><p className="eyebrow">채용 담당자</p><h2>{value(job, "managerName")}</h2><p>{value(job, "departmentName")} · {value(job, "managerTelNo")}</p></div></article>
      <article className="job-detail-hero-card"><h2>지원 방법</h2><DetailRows rows={[["전형 방법", value(job, "selectionMethodContent")], ["접수 방법", value(job, "receptionMethod")], ["접수 안내", value(job, "etcReceptionMethodDescription")], ["제출 서류", value(job, "submissionDocumentContent")], ["외국어", value(job, "foreignLanguageLevel")], ["관련 전공·경력", value(job, "majorName")], ["자격·우대", value(job, "licenseContent")], ["기타 우대", value(job, "etcPreferenceContent")], ["컴퓨터 활용", value(job, "computerAbilityContent")], ["병역", value(job, "militaryServiceExperience")]]} /></article>
      <article className="job-detail-hero-card"><h2>기업 정보</h2><p style={{ whiteSpace: "pre-wrap" }}>{value(job, "companyIntroContent", "기업 소개가 제공되지 않았습니다.")}</p><DetailRows rows={[["회사 주소", value(job, "companyAddress")], ["주요 사업", value(job, "primaryBusinessContent")], ["근로자 수", value(job, "workerCountInfo")], ["자본금", value(job, "capitalAmount")], ["연 매출", value(job, "annualSalesAmount")], ["팩스", value(job, "managerFaxNo")]]} /></article>
    </div>}</Status></section>
  </main>;
}
