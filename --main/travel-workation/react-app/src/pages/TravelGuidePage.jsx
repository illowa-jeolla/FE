import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, PageIntro } from "../components/UI";
import KakaoRouteMap from "../components/KakaoRouteMap";

const fallbackPlaces = [
  { name: "순천만 국가정원", region: "순천", category: "자연", description: "남도의 계절을 천천히 걷는 정원 여행", imageUrl: "/assets/fVkV4.jpeg", rating: 4.9, latitude: 34.9285, longitude: 127.4873 },
  { name: "여수 향일암 노을길", region: "여수", category: "자연", description: "바다 위 노을과 일출을 만나는 산책 코스", imageUrl: "/assets/s6jB4w.jpeg", rating: 4.8, latitude: 34.5938, longitude: 127.8024 },
  { name: "담양 메타세쿼이아길", region: "담양", category: "산책", description: "숲길과 로컬 미식을 함께 즐기는 하루", imageUrl: "/assets/lX3GW.jpeg", rating: 4.7, latitude: 35.3215, longitude: 127.0038 }
];

function fallbackGuide(conditions, variant = 0) {
  const places = fallbackPlaces.concat([{ name: "여수 수산시장", category: "미식", description: "지역의 맛을 가까이에서 만나요.", imageUrl: "/assets/JvLTt.jpeg", latitude: 34.7386, longitude: 127.7321 }, { name: "여수 해양공원", category: "산책", description: "하루를 천천히 마무리해요.", imageUrl: "/assets/bI7WI.jpeg", latitude: 34.738, longitude: 127.7447 }]);
  const offset = variant % places.length;
  const ordered = [...places.slice(offset), ...places.slice(0, offset)];
  return { region: conditions.region || "여수", hotel: { name: conditions.hotel || "추천 출발지" }, tip: "오전에는 대표 관광지를 여유롭게 둘러보고, 해 질 무렵에는 바다와 야경을 즐겨보세요.", conditions, spots: ordered.map((item, index) => ({ ...item, time: `${10 + index * 2}:00`, stayMinutes: 60, distanceFromPreviousKm: index ? 2.4 : 0 })) };
}

export default function TravelGuidePage() {
  const location = useLocation();
  const conditions = location.state || JSON.parse(sessionStorage.getItem("travelGuideConditions") || "{}");
  const [guide, setGuide] = useState(null);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [changeCount, setChangeCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load(alternative = false) {
    if (alternative && changeCount >= 2) { setMessage("다른 코스 변경은 최대 2회까지 가능해요."); return; }
    if (alternative) setSaved(false);
    setLoading(true); setMessage("");
    const nextCount = alternative ? changeCount + 1 : changeCount;
    const requestConditions = alternative ? { ...conditions, excludedSpots: guide?.spots?.map((spot) => spot.name) || [] } : conditions;
    try { const result = await apiRequest("/api/travel-guide", { method: "POST", body: JSON.stringify(requestConditions) }); setGuide({ ...result, conditions }); }
    catch (error) { setGuide(fallbackGuide(conditions, nextCount)); setMessage(`기본 추천 코스를 표시합니다. ${error.message}`); }
    finally { if (alternative) setChangeCount(nextCount); setActive(0); setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (saved || saving) return;
    if (!hasSession()) { setMessage("로그인 후 일정을 저장할 수 있어요."); return; }
    setSaving(true); setMessage("");
    try { await apiRequest("/api/me/guides", { method: "POST", body: JSON.stringify({ title: `${guide.region} 맞춤 여행 가이드`, guide: { ...guide, conditions } }) }); setSaved(true); }
    catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="loading-page-react"><div className="loading-mark-react">일</div><h1>당신만의 여행을 만들고 있어요</h1><p>관광지와 이동 순서를 비교하고 있습니다.</p></main>;
  const spot = guide?.spots?.[active];
  return <main className="page-shell-react">
    <PageIntro eyebrow="YOUR PERSONAL GUIDE" title={`${guide.region || "전라도"}, 이렇게 둘러보세요`} description={`${guide.hotel?.name || "추천 출발지"}에서 시작하는 실제 위치 기반 추천 동선이에요.`} action={<div className="intro-actions-react"><button className={`save-guide-button-react${saved ? " is-saved" : ""}`} onClick={save} aria-pressed={saved} title={saved ? "저장됨" : "일정 저장"}><span aria-hidden="true">{saved ? "♥" : "♡"}</span>{saving ? "저장 중" : saved ? "저장됨" : "일정 저장"}</button><button onClick={() => load(true)} disabled={changeCount >= 2}>↻ 다른 코스 {changeCount < 2 ? `(${2 - changeCount}회 남음)` : "(변경 완료)"}</button></div>} />
    <FormMessage message={message} />
    {(conditions.start || conditions.selectedGuide) && <div className="guide-selection-summary-react"><span>여행 일정 <strong>{conditions.start || "미정"}{conditions.end ? ` ~ ${conditions.end}` : ""}</strong></span><span>선택 가이드 <strong>{conditions.selectedGuide?.name || "미선택"}</strong></span>{conditions.selectedGuide?.specialty && <small>{conditions.selectedGuide.specialty}</small>}</div>}
    <div className="guide-layout-react"><aside className="route-list-react"><div><span>DAY 1 · 추천 동선</span><strong>관광지 {guide.spots?.length || 0}곳</strong></div>{guide.spots?.map((item, index) => <button className={active === index ? "is-active" : ""} onClick={() => setActive(index)} key={`${item.name}-${index}`}><b>{index + 1}</b><span><strong>{item.name}</strong><small>{item.category} · {item.time}</small></span></button>)}</aside><section className="guide-map-react"><KakaoRouteMap guide={guide} active={active} onSelect={setActive} />{spot && <article className="guide-spot-react"><span>{active + 1}</span><div><h2>{spot.name}</h2><small>{spot.address || spot.category}</small><p>{spot.description}</p></div></article>}</section></div>
    <aside className="guide-tip-react"><b>AI 여행 TIP</b><p>{guide.tip}</p><Link to={`/map?region=${encodeURIComponent(guide.region || "")}`}>주변 일자리 찾아보기 →</Link></aside>
  </main>;
}
