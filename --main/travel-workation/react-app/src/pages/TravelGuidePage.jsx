import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { authApiUrl } from "../config";
import KakaoRouteMap from "../components/KakaoRouteMap";
import { getSavedTravelGuide, getTravelGuideDraft, removeSavedTravelGuide, saveTravelGuideDraft } from "../api/travelRecommendations";

const fallbackPlaces = [
  { name: "순천만 국가정원", category: "자연", description: "남도의 계절을 천천히 걷는 정원 여행", address: "전남 순천시 국가정원1호길 47", latitude: 34.9285, longitude: 127.4873 },
  { name: "여수 향일암", category: "자연", description: "바다 위 일출과 노을을 만나는 산책 코스", address: "전남 여수시 돌산읍 향일암로 60", latitude: 34.5938, longitude: 127.8024 },
  { name: "담양 메타세쿼이아길", category: "산책", description: "숲길과 로컬 미식을 함께 즐기는 하루", address: "전남 담양군 담양읍 메타세쿼이아로 12", latitude: 35.3215, longitude: 127.0038 },
  { name: "여수 수산시장", category: "미식", description: "지역의 맛을 가까이에서 만나요.", address: "전남 여수시 여객선터미널길 24", latitude: 34.7386, longitude: 127.7321 },
  { name: "여수 해양공원", category: "산책", description: "하루를 천천히 마무리해요.", address: "전남 여수시 이순신광장로 146", latitude: 34.738, longitude: 127.7447 }
];

function tripDayCount(conditions) {
  if (!conditions.start || !conditions.end) return 1;
  return Math.max(1, Math.min(7, Math.round((new Date(`${conditions.end}T00:00:00`) - new Date(`${conditions.start}T00:00:00`)) / 86400000) + 1));
}
function dayLabel(start, index) { if (!start) return ""; const date = new Date(`${start}T00:00:00`); date.setDate(date.getDate() + index); return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(value) { if (!value) return "미정"; return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function fallbackGuide(conditions, variant, count) {
  const ordered = [...fallbackPlaces.slice(variant % fallbackPlaces.length), ...fallbackPlaces.slice(0, variant % fallbackPlaces.length)];
  return { region: conditions.region || "여수", hotel: { name: conditions.hotel || "추천 출발지" }, tip: "오전에는 대표 관광지를 여유롭게 둘러보고, 해 질 무렵에는 바다와 야경을 즐겨보세요.", spots: ordered.slice(0, count).map((spot, index) => ({ ...spot, time: `${10 + index * 2}:00`, stayMinutes: 60, travelMinutes: index ? 20 : 0, distanceFromPreviousKm: index ? 2.4 : 0 })) };
}
function normalizePlace(item) { return { name: item.title || item.name, address: item.address || "", category: item.category || "관광", description: item.overview || item.description || "새로 추가한 관광지입니다.", latitude: Number(item.mapY ?? item.latitude), longitude: Number(item.mapX ?? item.longitude), imageUrl: item.thumbnailUrl || item.firstImage || "", time: "", stayMinutes: 60, travelMinutes: 0, distanceFromPreviousKm: 0 }; }

export default function TravelGuidePage() {
  const { guideId, draftId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const conditions = useMemo(() => location.state || JSON.parse(sessionStorage.getItem("travelGuideConditions") || "{}"), [location.state]);
  const restored = useMemo(() => { try { return JSON.parse(sessionStorage.getItem("travelGuideResult") || "null"); } catch { return null; } }, []);
  const validRestored = Boolean((restored?.guides || restored?.guide?.days || [restored?.guide]).filter(Boolean).some((item) => item?.spots?.length));
  const [guides, setGuides] = useState(validRestored ? (restored?.guides || restored?.guide?.days || [restored.guide]) : []);
  const [activeDay, setActiveDay] = useState(0);
  const [active, setActive] = useState(0);
  const [returnMode, setReturnMode] = useState(false);
  const [loading, setLoading] = useState(!validRestored);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(Number(restored?.attempt) || 1);
  const [saved, setSaved] = useState(Boolean(restored?.saved));
  const [savedId, setSavedId] = useState(restored?.savedGuideId || "");
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState(null);
  const [placeModal, setPlaceModal] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const guide = guides[activeDay];
  const spot = guide?.spots?.[active];

  function remember(nextGuides = guides, extra = {}) { const first = nextGuides[0]; sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide: { ...first, days: nextGuides }, guides: nextGuides, attempt, conditions, saved, savedGuideId: savedId, ...extra })); }
  async function load(alternative = false) {
    if (alternative && attempt >= 2) { setMessage("다른 코스 추천은 한 번만 가능해요."); return; }
    setLoading(true); setError(""); setMessage("");
    const nextAttempt = alternative ? 2 : attempt;
    const days = tripDayCount(conditions);
    const excludedSpots = alternative ? guides.flatMap((item) => item.spots?.map((place) => place.name) || []) : [];
    try {
      const next = []; const used = [...excludedSpots];
      for (let index = 0; index < days; index += 1) {
        const placeCount = Math.max(1, Math.min(5, Number(conditions.dailyPlaceCounts?.[index]) || 3));
        const result = await apiRequest("/api/travel-guide", { method: "POST", body: JSON.stringify({ ...conditions, attempt: nextAttempt, dayIndex: index + 1, tripDays: days, placeCount, excludedSpots: used.slice(-35) }) });
        if (!Array.isArray(result.spots) || result.spots.length === 0) throw new Error("추천 API에서 관광지 결과를 받지 못했습니다.");
        result.spots = (result.spots || []).slice(0, placeCount); next.push(result); used.push(...result.spots.map((place) => place.name));
      }
      setGuides(next); setAttempt(nextAttempt); setSaved(false); setSavedId(""); remember(next, { attempt: nextAttempt, saved: false, savedGuideId: "" });
    } catch (requestError) {
      const next = Array.from({ length: days }, (_, index) => fallbackGuide(conditions, nextAttempt + index, Number(conditions.dailyPlaceCounts?.[index]) || 3));
      setGuides(next); setAttempt(nextAttempt); setMessage(`기본 추천 코스를 표시합니다. ${requestError.message}`); remember(next, { attempt: nextAttempt, saved: false });
    } finally { setActiveDay(0); setActive(0); setReturnMode(false); setLoading(false); }
  }
  useEffect(() => {
    const detailId = guideId || draftId;
    if (!detailId) { if (!validRestored) load(false); return; }
    let active = true;
    setLoading(true); setError("");
    ;(guideId ? getSavedTravelGuide(guideId) : getTravelGuideDraft(draftId))
      .then((detail) => {
        if (!active) return;
        const backendDays = (detail.days || []).map((day) => ({
          region: conditions.region || "전라도",
          hotel: { name: "추천 출발지" },
          tip: detail.travelTip || "여행 전 운영 시간과 이동 방법을 확인해 주세요.",
          spots: (day.items || []).map((item) => ({ name: item.title, address: "", category: "관광지", description: item.reason || "추천 관광지입니다.", latitude: item.latitude, longitude: item.longitude, imageUrl: item.thumbnailUrl || "", time: String(item.recommendedTime || "").slice(0, 5), stayMinutes: item.stayMinutes, travelMinutes: item.travelMinutes, distanceFromPreviousKm: 0 }))
        }));
        setGuides(backendDays); setSaved(Boolean(guideId)); setSavedId(String(detail.guideId || "")); setMessage(detail.summary || "여행 가이드를 불러왔습니다.");
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [guideId, draftId]);

  function updateCurrentSpots(nextSpots) { const next = guides.map((item, index) => index === activeDay ? { ...item, spots: nextSpots } : item); setGuides(next); setSaved(false); setSavedId(""); remember(next, { saved: false, savedGuideId: "" }); }
  function dropAt(index) { if (dragged == null || dragged === index) return; const next = [...guide.spots]; const [moved] = next.splice(dragged, 1); next.splice(index, 0, moved); updateCurrentSpots(next); setDragged(null); setActive(index); }
  function removeSpot(index) { if (guide.spots.length <= 1) { setMessage("관광지는 한 곳 이상 필요합니다."); return; } updateCurrentSpots(guide.spots.filter((_, itemIndex) => itemIndex !== index)); setActive(Math.max(0, Math.min(active, guide.spots.length - 2))); }

  async function searchPlaces() {
    setPlaceLoading(true); setMessage("");
    try { const result = await apiRequest(authApiUrl(`/tour/places?region=${encodeURIComponent(guide.region || conditions.region || "전주")}&pageNo=1&numOfRows=30`)); const items = result.items || []; const query = placeQuery.trim(); setPlaceResults(items.map(normalizePlace).filter((item) => !query || item.name.includes(query)).filter((item) => !guide.spots.some((spotItem) => spotItem.name === item.name))); }
    catch (requestError) { setMessage(requestError.message); setPlaceResults([]); }
    finally { setPlaceLoading(false); }
  }
  async function toggleSave() {
    if (guideId) {
      if (!window.confirm("저장한 여행 가이드를 목록에서 삭제할까요?")) return;
      setSaving(true); setMessage("");
      try { await removeSavedTravelGuide(guideId); navigate("/mypage?tab=guides", { replace: true }); }
      catch (requestError) { setMessage(requestError.message); }
      finally { setSaving(false); }
      return;
    }
    if (draftId) {
      setSaving(true); setMessage("");
      try { const result = await saveTravelGuideDraft(draftId); setSaved(true); setSavedId(String(result.guideId || "")); setMessage("여행 가이드를 저장했습니다."); }
      catch (requestError) { setMessage(requestError.message); }
      finally { setSaving(false); }
      return;
    }
    if (!hasSession()) { setMessage("로그인 후 일정을 저장할 수 있어요."); return; }
    setSaving(true); setMessage("");
    try {
      if (saved && savedId) { await apiRequest(`/api/me/guides/${savedId}`, { method: "DELETE" }); setSaved(false); setSavedId(""); remember(guides, { saved: false, savedGuideId: "" }); setMessage("저장한 일정에서 삭제했습니다."); }
      else { const payload = { ...guides[0], days: guides, tripStart: conditions.start || "", tripEnd: conditions.end || "", conditions }; const result = await apiRequest("/api/me/guides", { method: "POST", body: JSON.stringify({ title: `${guide.region} 맞춤 여행 가이드`, guide: payload }) }); const id = String(result.id || ""); setSaved(true); setSavedId(id); remember(guides, { saved: true, savedGuideId: id }); setMessage("여행 가이드를 저장했습니다."); }
    } catch (requestError) { setMessage(requestError.message); } finally { setSaving(false); }
  }

  if (loading) return <main className="travel-result-main"><section className="travel-guide-loading"><div className="travel-loading-orbit"><span>일</span><i /></div><span className="travel-guide-eyebrow">AI TRAVEL CURATOR</span><h1>당신만의 여행을<br />만들고 있어요</h1><p>입력한 지역과 숙소 주변 관광지를 비교하고 있어요.</p><ol className="travel-loading-steps"><li className="is-active"><b>01</b><span>숙소 위치 확인</span></li><li><b>02</b><span>주변 관광지 검색</span></li><li><b>03</b><span>최적 동선 만들기</span></li></ol><div className="travel-loading-bar"><span /></div></section></main>;
  if (error || !guide) return <main className="travel-result-main"><section className="travel-guide-error"><span>!</span><h1>가이드를 만들지 못했어요</h1><p>{error || "추천 결과가 없습니다."}</p><div><Link className="button" to="/recommend">조건 다시 선택</Link><button className="button button-primary" onClick={() => load(false)}>다시 시도</button></div></section></main>;

  const totalMinutes = guide.spots.reduce((sum, item) => sum + Number(item.stayMinutes || 0) + Number(item.travelMinutes || 0), 0);
  const totalDistance = guide.spots.reduce((sum, item) => sum + Number(item.distanceFromPreviousKm || 0), 0);
  const preferences = [...(conditions.themes || []), conditions.transport, conditions.companion].filter(Boolean);
  return <main className="travel-result-main"><section className="travel-guide-content travel-result-content">
    <Link className="travel-guide-back" to="/recommend">← 조건 다시 선택하기</Link>
    <header className="travel-guide-heading"><div><span className="travel-guide-eyebrow">YOUR PERSONAL GUIDE</span><h2><strong>{guide.region || "전라도"}</strong>, 이렇게 둘러보세요</h2><p><b>{guide.hotel?.name || "추천 출발지"}</b>에서 출발하는 실제 위치 기반 추천 동선이에요.</p><div className="travel-selected-preferences">{preferences.map((value) => <span key={value}># {value}</span>)}</div></div><div className="travel-guide-period"><span>{formatDate(conditions.start)} — {formatDate(conditions.end)}</span><div className="travel-guide-actions"><button className="travel-save-guide" data-saved={saved} type="button" onClick={toggleSave} disabled={saving}>{saved ? "♥ 저장됨" : saving ? "저장 중" : "♡ 일정 저장"}</button><button className="travel-recommend-again" type="button" onClick={() => load(true)} disabled={attempt >= 2}>{attempt >= 2 ? "✓ 추천 완료" : "↻ 한 번 더 추천받기"}</button></div></div></header>
    {message && <div className="page-status is-visible">{message}</div>}
    <nav className="travel-day-navigation" aria-label="여행 날짜별 일정"><div>{guides.map((_, index) => <button data-day={index} className={index === activeDay ? "is-active" : ""} type="button" key={index} onClick={() => { setActiveDay(index); setActive(0); setReturnMode(false); }}><b>DAY {index + 1}</b><small>{dayLabel(conditions.start, index)}</small></button>)}</div></nav>
    <div className="travel-route-layout" key={activeDay}><aside className="travel-place-panel"><div className="travel-route-summary"><span>DAY {activeDay + 1} · 추천 동선</span><b>관광지 {guide.spots.length}곳 · 약 {Math.max(1, Math.round(totalMinutes / 60))}시간 · {totalDistance.toFixed(1)}km</b></div><div>{guide.spots.map((item, index) => <button className={`travel-place-card${!returnMode && index === active ? " is-active" : ""}`} type="button" draggable="true" onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropAt(index)} onClick={() => { setActive(index); setReturnMode(false); }} onContextMenu={(event) => { event.preventDefault(); removeSpot(index); }} title="끌어서 순서 변경 · 우클릭으로 제거" key={`${item.name}-${index}`}><span className="travel-place-number">{index + 1}</span><span><b>{item.name}</b><small>{item.category}</small></span><span className="travel-driving-info"><b>{item.time}</b><small>{item.stayMinutes || 60}분</small></span></button>)}</div><button className="travel-add-place" type="button" onClick={() => { setPlaceModal(true); setPlaceResults([]); }}><b>＋</b> 관광지 추가하기</button><button className={`travel-return-hotel${returnMode ? " is-active" : ""}`} type="button" onClick={() => setReturnMode(true)}><span>숙소로 복귀</span><small>복귀 경로 보기</small></button></aside>
      <section className="travel-route-map travel-kakao-map-wrap" aria-label="숙소 주변 추천 관광지와 여행 경로"><KakaoRouteMap guide={guide} active={returnMode ? -1 : active} onSelect={(index) => { setActive(index); setReturnMode(false); }} />{!returnMode && spot && <article className="travel-map-card"><span>{active + 1}</span><div><b>{spot.name}</b><small>{spot.address || spot.category}</small><p>{spot.description}</p>{spot.sourceUrl && <a href={spot.sourceUrl} target="_blank" rel="noreferrer">{spot.sourceTitle || "정보 출처"} ↗</a>}</div></article>}</section>
    </div>
    <aside className="travel-guide-tip"><span>AI 여행 TIP</span><p>{guide.tip}</p></aside><div className="travel-jobs-cta"><div><span>WORK NEARBY</span><strong>추천 지역 주변에서 일자리도 찾아보세요</strong><p>관광·축제·팝업 등 지역에 등록된 일자리를 바로 확인할 수 있어요.</p></div><Link to={`/map?region=${encodeURIComponent(guide.region || "")}`}>주변 일자리 찾아보기 <b>→</b></Link></div>
  </section>
  {placeModal && <div className="travel-place-search-backdrop"><section className="travel-place-search-dialog" role="dialog" aria-modal="true" aria-labelledby="travel-place-search-title"><header><div><span>ADD A PLACE</span><h2 id="travel-place-search-title">관광지 추가하기</h2></div><button type="button" aria-label="닫기" onClick={() => setPlaceModal(false)}>×</button></header><label><span>⌕</span><input type="search" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchPlaces(); } }} placeholder="관광지 이름을 검색하세요" autoFocus /></label><div id="travel-place-search-results">{placeLoading ? <p>관광지를 검색하고 있어요.</p> : placeResults.length ? placeResults.map((item) => <button type="button" key={item.name} onClick={() => { updateCurrentSpots([...guide.spots, item]); setActive(guide.spots.length); setPlaceModal(false); }}><span><b>{item.name}</b><small>{item.address}</small></span><strong>추가 →</strong></button>) : <p>검색어를 입력하고 Enter를 눌러주세요.</p>}</div></section></div>}
  </main>;
}
