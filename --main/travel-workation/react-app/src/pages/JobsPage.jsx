import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Status } from "../components/UI";
import { regions } from "../data/regions";
import { useApi } from "../hooks/useApi";

function jobsPath(region = "") {
  const query = new URLSearchParams({ startPage: "1", pageSize: "12", numOfRows: "12" });
  if (region && !/^(전체|all)$/i.test(region)) query.set("region", region);
  return `/api/v1/jobs/external/junnam?${query}`;
}

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const initialRegion = params.get("region") || "";
  const [filters, setFilters] = useState({ region: initialRegion, tripStart: "", tripEnd: "", workType: "", time: "" });
  const { data, loading, error, run } = useApi(jobsPath(initialRegion));
  const jobs = data?.items || [];
  const set = (key) => (event) => setFilters((value) => ({ ...value, [key]: event.target.value }));
  function submit(event) {
    event.preventDefault(); const region = filters.region;
    setParams(region ? { region } : {}); run(jobsPath(region)).catch(() => {});
  }
  function showAll() {
    setFilters({ region: "", tripStart: "", tripEnd: "", workType: "", time: "" });
    setParams({}); run(jobsPath()).catch(() => {});
  }
  return <main className="feature-page-main">
    <section className="page-intro"><div><p className="eyebrow dark">전남 공공 일자리</p><h1>여행 가까이에서 나에게 맞는 일을 찾아보세요</h1></div><p>전남 공공 일자리 API에서 최신 공고를 조회합니다.</p></section>
    <div className="page-workspace jobs-search-layout"><section className="page-panel job-search-panel"><header><h2>일자리 검색</h2><span>DB 공고</span></header><form className="job-search-form" onSubmit={submit}>
      <label>지역<select value={filters.region} onChange={set("region")}><option value="">지역 선택</option>{regions.filter((r) => r !== "전체").map((r) => <option key={r}>{r}</option>)}</select></label>
      <fieldset><legend>여행 기간</legend><div className="job-search-two-fields"><label>출발일<input type="date" value={filters.tripStart} onChange={set("tripStart")} /></label><label>도착일<input type="date" min={filters.tripStart || undefined} value={filters.tripEnd} onChange={set("tripEnd")} /></label></div></fieldset>
      <div className="job-search-two-fields"><label>일하는 방식<input value={filters.workType} onChange={set("workType")} placeholder="예: 주 5일" /></label><label>희망 시간<input value={filters.time} onChange={set("time")} placeholder="예: 09:00~18:00" /></label></div>
      <button className="button button-primary" type="submit">조건으로 검색하기</button><button className="button" type="button" onClick={showAll}>전체 공고 보기</button>
    </form></section><section className="page-panel"><p className="result-kind">{filters.region ? `${filters.region} 일자리` : "전체 일자리"}</p><Status loading={loading} error={error} empty={!jobs.length}><div className="result-list">{jobs.map((job) => <Link className="result-card" to={`/jobs/junnam/${job.rawFields?.jobKey}`} key={job.rawFields?.jobKey || job.title}><div><span>{job.rawFields?.jobCategoryNm || "전남 공공 일자리"}</span><h3>{job.title}</h3><p>{job.companyName || job.address || "상세 정보 보기"}</p></div></Link>)}</div></Status></section></div>
  </main>;
}
