import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { JobCard, PageIntro, Status } from "../components/UI";
import { regions } from "../data/regions";
import { asList, useApi } from "../hooks/useApi";

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const selectedRegion = params.get("region") || "전체";
  const [keyword, setKeyword] = useState("");
  const { data, loading, error, run } = useApi(`/api/jobs${selectedRegion !== "전체" ? `?region=${encodeURIComponent(selectedRegion)}` : ""}`);
  const jobs = asList(data, "jobs").filter((job) => !keyword || `${job.title} ${job.companyName} ${job.category}`.includes(keyword));

  function chooseRegion(region) {
    setParams(region === "전체" ? {} : { region });
    run(`/api/jobs${region !== "전체" ? `?region=${encodeURIComponent(region)}` : ""}`).catch(() => {});
  }

  return <main className="page-shell-react"><PageIntro eyebrow="TOURISM JOB MATCHING" title="여행 가까이에서 나에게 맞는 일을 찾아보세요" description="지역과 일정, 근무 조건을 기준으로 관광 일자리를 비교해요." />
    <div className="filter-bar-react"><label>지역<select value={selectedRegion} onChange={(e) => chooseRegion(e.target.value)}>{regions.map((region) => <option key={region}>{region}</option>)}</select></label><label>직무·회사<input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="검색어 입력" /></label><Link className="secondary-action-react" to="/map">지도에서 보기</Link></div>
    <div className="section-row-react"><div><span>OPEN POSITIONS</span><h2>{selectedRegion === "전체" ? "전체 관광 일자리" : `${selectedRegion} 일자리`}</h2></div><b>{jobs.length}</b></div>
    <Status loading={loading} error={error} empty={!jobs.length}><div className="jobs-grid-react">{jobs.map((job) => <JobCard key={job.id} job={job} />)}</div></Status>
  </main>;
}
