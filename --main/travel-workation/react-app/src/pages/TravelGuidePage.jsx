import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, PageIntro } from "../components/UI";

const fallbackPlaces = [
  { name: "순천만 국가정원", region: "순천", category: "자연", description: "남도의 계절을 천천히 걷는 정원 여행", imageUrl: "/assets/fVkV4.jpeg", rating: 4.9 },
  { name: "여수 향일암 노을길", region: "여수", category: "자연", description: "바다 위 노을과 일출을 만나는 산책 코스", imageUrl: "/assets/s6jB4w.jpeg", rating: 4.8 },
  { name: "담양 메타세쿼이아길", region: "담양", category: "산책", description: "숲길과 로컬 미식을 함께 즐기는 하루", imageUrl: "/assets/lX3GW.jpeg", rating: 4.7 }
];

function fallbackGuide(conditions) {
  return { region: conditions.region || "여수", hotel: { name: conditions.hotel || "추천 출발지" }, tip: "오전에는 대표 관광지를 여유롭게 둘러보고, 해 질 무렵에는 바다와 야경을 즐겨보세요.", spots: fallbackPlaces.concat([{ name: "로컬 시장", category: "미식", description: "지역의 맛을 가까이에서 만나요.", imageUrl: "/assets/JvLTt.jpeg" }, { name: "해안 산책로", category: "산책", description: "하루를 천천히 마무리해요.", imageUrl: "/assets/bI7WI.jpeg" }]).map((item, index) => ({ ...item, time: `${10 + index * 2}:00`, stayMinutes: 60, distanceFromPreviousKm: index ? 2.4 : 0 })) };
}

export default function TravelGuidePage() {
  const location = useLocation();
  const conditions = location.state || JSON.parse(sessionStorage.getItem("travelGuideConditions") || "{}");
  const [guide, setGuide] = useState(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setMessage("");
    try { const result = await apiRequest("/api/travel-guide", { method: "POST", body: JSON.stringify(conditions) }); setGuide(result); }
    catch (error) { setGuide(fallbackGuide(conditions)); setMessage(`기본 추천 코스를 표시합니다. ${error.message}`); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!hasSession()) { setMessage("로그인 후 일정을 저장할 수 있어요."); return; }
    try { await apiRequest("/api/me/guides", { method: "POST", body: JSON.stringify({ title: `${guide.region} 맞춤 여행 가이드`, guide }) }); setMessage("여행 가이드를 저장했습니다."); }
    catch (error) { setMessage(error.message); }
  }

  if (loading) return <main className="loading-page-react"><div className="loading-mark-react">일</div><h1>당신만의 여행을 만들고 있어요</h1><p>관광지와 이동 순서를 비교하고 있습니다.</p></main>;
  const spot = guide?.spots?.[active];
  return <main className="page-shell-react">
    <PageIntro eyebrow="YOUR PERSONAL GUIDE" title={`${guide.region || "전라도"}, 이렇게 둘러보세요`} description={`${guide.hotel?.name || "추천 출발지"}에서 시작하는 실제 위치 기반 추천 동선이에요.`} action={<div className="intro-actions-react"><button onClick={save}>♡ 일정 저장</button><button onClick={load}>↻ 다른 코스</button></div>} />
    <FormMessage message={message} />
    <div className="guide-layout-react"><aside className="route-list-react"><div><span>DAY 1 · 추천 동선</span><strong>관광지 {guide.spots?.length || 0}곳</strong></div>{guide.spots?.map((item, index) => <button className={active === index ? "is-active" : ""} onClick={() => setActive(index)} key={`${item.name}-${index}`}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.category} · {item.time}</small></span></button>)}</aside><section className="guide-map-react"><img src="/assets/jeolla-region-map.png" alt="전라도 여행 코스 지도" />{spot && <article className="guide-spot-react"><span>{active + 1}</span><div><h2>{spot.name}</h2><small>{spot.address || spot.category}</small><p>{spot.description}</p></div></article>}</section></div>
    <aside className="guide-tip-react"><b>AI 여행 TIP</b><p>{guide.tip}</p><Link to={`/map?region=${encodeURIComponent(guide.region || "")}`}>주변 일자리 찾아보기 →</Link></aside>
  </main>;
}
