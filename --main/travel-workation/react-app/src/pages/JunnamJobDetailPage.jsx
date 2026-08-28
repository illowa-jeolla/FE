import { Link, useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { Status } from "../components/UI";

export default function JunnamJobDetailPage() {
  const { jobKey } = useParams();
  const { data: job, loading, error } = useApi(`/api/v1/jobs/external/junnam/${encodeURIComponent(jobKey || "")}`);
  return <main className="feature-page-main"><section className="page-intro"><div><p className="eyebrow dark">전남 공공 일자리</p><h1>일자리 상세</h1></div><div className="page-intro-actions"><Link className="button" to="/jobs">목록으로 돌아가기</Link></div></section><section className="page-panel"><Status loading={loading} error={error} empty={!job}>{job && <article className="job-detail-hero-card"><p className="eyebrow">{job.categoryName || "전남 공공 일자리"}</p><h2>{job.title}</h2><p>{job.writer || "공고 담당자"} · {job.insertedAt || "등록일 미정"} · 조회 {job.readCount || 0}</p><div className="job-accordion-body"><h3>공고 내용</h3><p style={{ whiteSpace: "pre-wrap" }}>{job.content || "상세 내용이 제공되지 않았습니다."}</p>{job.address && <p>주소: {job.address}</p>}{job.tel && <p>연락처: {job.tel}</p>}{job.homepageUrl && <p><a href={job.homepageUrl} target="_blank" rel="noreferrer">공고 원문 보기 ↗</a></p>}</div></article>}</Status></section></main>;
}
