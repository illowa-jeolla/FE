import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Status } from "../components/UI";
import { getJobs } from "../api/jobs";
import { getTravelPosts } from "../api/travelPosts";
import { asList } from "../hooks/useApi";

function SearchSection({ title, items, render }) {
  if (!items?.length) return null;
  return <section><div className="search-result-title"><h2>{title}</h2><span>{items.length}건</span></div><div className="search-result-list">{items.map(render)}</div></section>;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem("recentSearches") || "[]"));
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  useEffect(() => { if (initial.length < 2) return; let active = true; setLoading(true); setError(""); Promise.all([getJobs({ page: 0, size: 100 }), getTravelPosts({ page: 0, size: 100 })]).then(([jobData, postData]) => { if (!active) return; const keyword = initial.toLowerCase(); const jobs = (Array.isArray(jobData?.content) ? jobData.content : asList(jobData, "jobs")).filter((item) => [item.title, item.employerName, item.regionName].some((value) => String(value || "").toLowerCase().includes(keyword))); const posts = (Array.isArray(postData?.content) ? postData.content : asList(postData, "posts")).filter((item) => [item.title, item.concept, item.content, item.regionName].some((value) => String(value || "").toLowerCase().includes(keyword))); setData({ jobs, posts, destinations: [], gatherings: [] }); }).catch((requestError) => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [initial]);

  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 6);
    setRecent(next);
    localStorage.setItem("recentSearches", JSON.stringify(next));
    setParams({ q: value });
  }

  return <main className="search-main">
    <section className="search-heading"><p className="eyebrow dark">ALL IN ONE SEARCH</p><h1>무엇을 찾고 있나요?</h1><p>관광지, 일자리, 여행 이야기와 게더링을 한 번에 찾아보세요.</p></section>
    <form className="search-form" onSubmit={submit}><label className="sr-only" htmlFor="search-query">검색어</label><input id="search-query" value={query} onChange={(e) => setQuery(e.target.value)} type="search" minLength="2" placeholder="지역, 장소, 직무를 입력하세요" required /><button className="button button-primary">검색</button></form>
    {recent.length > 0 && <section className="recent-searches"><div><h2>최근 검색어</h2><button type="button" onClick={() => { setRecent([]); localStorage.removeItem("recentSearches"); }}>전체 삭제</button></div><div>{recent.map((item) => <button type="button" data-search-query key={item} onClick={() => { setQuery(item); setParams({ q: item }); }}>{item}</button>)}</div></section>}
    <Status loading={loading} error={error} empty={initial && data && ![data.jobs, data.destinations, data.posts, data.gatherings].some((items) => items?.length)}>
      {data && <section className="search-results">
        <SearchSection title="관광지" items={data.destinations} render={(item) => <Link to={`/recommend?destination=${item.id}`} key={item.id}><span>관광지 · {item.region}</span><strong>{item.name}</strong><p>{item.category || item.description}</p></Link>} />
        <SearchSection title="일자리" items={data.jobs} render={(item) => <Link to={`/jobs/${item.id}`} key={item.id}><span>일자리 · {item.regionName}</span><strong>{item.title}</strong><p>{item.employerName} · {item.salaryText || "급여 협의"}</p></Link>} />
        <SearchSection title="여행 이야기" items={data.posts} render={(item) => <Link to={`/community/${item.id}`} key={item.id}><span>여행 이야기 · {item.regionName}</span><strong>{item.title || item.concept}</strong><p>{item.content}</p></Link>} />
        <SearchSection title="게더링" items={data.gatherings} render={(item) => <Link to="/gatherings" key={item.id}><span>게더링 · {item.region}</span><strong>{item.title}</strong><p>{item.description}</p></Link>} />
      </section>}
    </Status>
  </main>;
}
