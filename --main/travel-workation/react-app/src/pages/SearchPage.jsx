import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { JobCard, PageIntro, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

function SearchSection({ title, items, render }) {
  if (!items?.length) return null;
  return <section className="search-section-react"><div className="section-row-react"><h2>{title}</h2><b>{items.length}</b></div><div className="result-grid-react">{items.map(render)}</div></section>;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") || "";
  const [query, setQuery] = useState(initial);
  const [recent, setRecent] = useState(() => JSON.parse(localStorage.getItem("recentSearches") || "[]"));
  const { data, loading, error, run } = useApi("", { immediate: false });

  useEffect(() => { if (initial.length >= 2) run(`/api/search?q=${encodeURIComponent(initial)}`).catch(() => {}); }, [initial, run]);

  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    const next = [value, ...recent.filter((item) => item !== value)].slice(0, 6);
    setRecent(next);
    localStorage.setItem("recentSearches", JSON.stringify(next));
    setParams({ q: value });
  }

  return <main className="page-shell-react">
    <PageIntro eyebrow="ALL IN ONE SEARCH" title="무엇을 찾고 있나요?" description="관광지, 일자리, 여행 이야기와 게더링을 한 번에 찾아보세요." />
    <form className="wide-search-react" onSubmit={submit}><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} minLength="2" placeholder="지역, 장소, 직무를 입력하세요" required /><button>검색</button></form>
    {recent.length > 0 && <div className="recent-react"><div><strong>최근 검색어</strong><button type="button" onClick={() => { setRecent([]); localStorage.removeItem("recentSearches"); }}>전체 삭제</button></div><div>{recent.map((item) => <button type="button" key={item} onClick={() => { setQuery(item); setParams({ q: item }); }}>{item}</button>)}</div></div>}
    <Status loading={loading} error={error} empty={initial && data && ![data.jobs, data.destinations, data.posts, data.gatherings].some((items) => items?.length)}>
      {data && <div className="search-groups-react">
        <SearchSection title="관광지" items={data.destinations} render={(item) => <article className="place-card-react" key={item.id}><img src={`/${item.imageUrl}`} alt="" /><div><span>{item.region} · {item.category}</span><h3>{item.name}</h3><p>{item.description}</p><strong>★ {item.rating}</strong></div></article>} />
        <SearchSection title="일자리" items={data.jobs} render={(item) => <JobCard job={item} key={item.id} compact />} />
        <SearchSection title="여행 이야기" items={data.posts} render={(item) => <Link className="text-result-react" to={`/community/${item.id}`} key={item.id}><span>{item.region}</span><strong>{item.concept}</strong><p>{item.content}</p></Link>} />
        <SearchSection title="게더링" items={data.gatherings} render={(item) => <Link className="text-result-react" to="/gatherings" key={item.id}><span>{item.region}</span><strong>{item.title}</strong><p>{item.description}</p></Link>} />
      </div>}
    </Status>
  </main>;
}
