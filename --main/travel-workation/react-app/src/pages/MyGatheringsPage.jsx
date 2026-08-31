import { Link } from "react-router-dom";
import { Status } from "../components/UI";
import { asList, useApi } from "../hooks/useApi";

function GatheringList({ title, data }) {
  const items = asList(data, "content");
  return <section className="page-panel"><div className="gathering-results-head"><div><p className="eyebrow dark">MY GATHERINGS</p><h2>{title}</h2></div><strong>{items.length}</strong></div>{items.length ? <div className="mypage-card-list">{items.map((item) => <Link className="mypage-guide-card" to="/gatherings" key={item.id || item.gatheringId}><div className="mypage-guide-copy"><span>{item.region?.name || item.regionName || "전라도"} · {item.status}</span><h3>{item.title}</h3><p>{item.meetingPlace || item.concept}</p><div className="mypage-guide-summary"><b>{item.startsAt?.slice(0, 10)}</b><b>{item.participantCount || 0}/{item.capacity}명 · {item.timing}</b></div></div></Link>)}</div> : <div className="mypage-empty"><strong>게더링이 없어요</strong></div>}</section>;
}

export default function MyGatheringsPage() {
  const hosted = useApi("/api/v1/gatherings/me?type=hosted&page=0&size=100");
  const joined = useApi("/api/v1/gatherings/me?type=joined&page=0&size=100");
  const loading = hosted.loading || joined.loading;
  const error = hosted.error || joined.error;
  return <main className="feature-page-main gatherings-page-main"><section className="page-intro"><div><p className="eyebrow dark">MY GATHERINGS</p><h1>내 게더링</h1></div><div className="page-intro-actions"><Link className="button" to="/gatherings">전체 게더링</Link><Link className="button button-primary" to="/gatherings/write">게더링 만들기 +</Link></div></section><Status loading={loading} error={error} empty={false}><div className="page-workspace"><GatheringList title="내가 만든 게더링" data={hosted.data} /><GatheringList title="참여 중인 게더링" data={joined.data} /></div></Status></main>;
}
