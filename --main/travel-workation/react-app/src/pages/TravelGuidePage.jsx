import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { hasSession } from "../auth/session";
import KakaoRouteMap from "../components/KakaoRouteMap";
import { createManualTravelGuide, getNearbyManualPlaces, getSavedTravelGuide, getTravelGuideDraft, removeSavedTravelGuide, requestTravelGuideAlternative, requestTravelRecommendation, saveTravelGuideDraft, waitForTravelRecommendation } from "../api/travelRecommendations";

function dayLabel(start, index) { if (!start) return ""; const date = new Date(`${start}T00:00:00`); date.setDate(date.getDate() + index); return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(value) { if (!value) return "미정"; return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function normalizePlace(item) { return { contentId: String(item.contentId || item.id || ""), name: item.title || item.name, address: item.address || "", category: item.category || "관광", description: item.overview || item.description || "새로 추가한 관광지입니다.", latitude: Number(item.mapY ?? item.latitude), longitude: Number(item.mapX ?? item.longitude), imageUrl: item.thumbnailUrl || item.firstImage || "", distanceMeters: Number(item.distanceMeters || 0), time: "", stayMinutes: 60, travelMinutes: 0, distanceFromPreviousKm: 0 }; }
function normalizeDraft(detail, conditions) {
  return (detail.days || []).map((day) => {
    const routeSegments = (day.routeSegments || []).map((segment) => ({ ...segment, distanceMeters: Number(segment.distanceMeters || 0), durationMinutes: Number(segment.durationMinutes || 0), estimated: Boolean(segment.estimated), path: (segment.path || []).map((point) => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) })) }));
    return { region: detail.regionName || conditions.regionName || "전라도", hotel: { name: detail.accommodation?.name || conditions.accommodation?.name || "추천 출발지", latitude: detail.accommodation?.latitude ?? conditions.accommodation?.latitude, longitude: detail.accommodation?.longitude ?? conditions.accommodation?.longitude }, tip: detail.travelTip || "여행 전 운영 시간과 이동 방법을 확인해 주세요.", routeSegments, spots: (day.items || []).map((item, index) => { const segment = routeSegments[index]; return { contentId: String(item.contentId || ""), name: item.title || item.name, address: item.address || "", category: item.category || "관광지", description: item.reason || item.description || "추천 관광지입니다.", latitude: item.latitude, longitude: item.longitude, imageUrl: item.thumbnailUrl || "", time: String(item.recommendedTime || "").slice(0, 5), stayMinutes: item.stayMinutes, travelMinutes: item.travelMinutes ?? segment?.durationMinutes, distanceFromPreviousKm: item.distanceFromPreviousKm ?? Number(segment?.distanceMeters || 0) / 1000 }; }) };
  });
}

function recommendationPayload(conditions) {
  return {
    regionId: conditions.regionId,
    startDate: conditions.startDate,
    endDate: conditions.endDate,
    accommodation: conditions.accommodation,
    startLocation: conditions.startLocation,
    endLocation: conditions.endLocation,
    themes: conditions.themes,
    dailyPlaceCounts: conditions.dailyPlaceCounts,
    transportType: conditions.transportType,
    companionType: conditions.companionType
  };
}

function manualGuidePayload(conditions, guides) {
  return {
    ...recommendationPayload(conditions),
    ...(conditions.title ? { title: String(conditions.title).slice(0, 200) } : {}),
    days: guides.map((day, index) => ({
      dayNumber: index + 1,
      places: day.spots.map((spot) => ({
        contentId: String(spot.contentId || ""),
        title: spot.name,
        ...(spot.address ? { address: spot.address } : {}),
        ...(spot.imageUrl ? { thumbnailUrl: spot.imageUrl } : {}),
        latitude: Number(spot.latitude),
        longitude: Number(spot.longitude)
      }))
    }))
  };
}

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
  const [generatedDraftId, setGeneratedDraftId] = useState(restored?.draftId || "");
  const [refreshAvailable, setRefreshAvailable] = useState(restored?.refreshAvailable ?? true);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState(null);
  const [placeModal, setPlaceModal] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placePage, setPlacePage] = useState(1);
  const [placeHasNext, setPlaceHasNext] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const guide = guides[activeDay];
  const spot = guide?.spots?.[active];

  function remember(nextGuides = guides, extra = {}) { const first = nextGuides[0]; sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide: { ...first, days: nextGuides }, guides: nextGuides, attempt, conditions, saved, savedGuideId: savedId, ...extra })); }
  async function load(alternative = false) {
    if (alternative && (!refreshAvailable || attempt >= 2)) { setMessage("이 여행안은 더 이상 새로 추천받을 수 없어요."); return; }
    setLoading(true); setError(""); setMessage("");
    const nextAttempt = alternative ? 2 : attempt;
    try {
      let response = alternative && generatedDraftId ? await requestTravelGuideAlternative(generatedDraftId) : await requestTravelRecommendation(recommendationPayload(conditions));
      if (response.requestId && String(response.status || "").toUpperCase() !== "COMPLETED") response = await waitForTravelRecommendation(response.requestId);
      const nextDraftId = response.draftId || response.travelGuideDraftId || response.guideDraftId || generatedDraftId;
      const detail = response.days?.length ? response : await getTravelGuideDraft(nextDraftId);
      const next = normalizeDraft(detail, conditions);
      if (!next.some((day) => day.spots.length)) throw new Error("추천 API에서 관광지 결과를 받지 못했습니다.");
      setGeneratedDraftId(String(nextDraftId)); setRefreshAvailable(Boolean(detail.refreshAvailable)); setGuides(next); setAttempt(nextAttempt); setSaved(false); setSavedId(""); remember(next, { attempt: nextAttempt, saved: false, savedGuideId: "", draftId: String(nextDraftId), refreshAvailable: Boolean(detail.refreshAvailable) });
    } catch (requestError) {
      setGuides([]); setError(requestError.message);
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
        const backendDays = normalizeDraft(detail, conditions);
        setGuides(backendDays); setRefreshAvailable(Boolean(detail.refreshAvailable)); setSaved(Boolean(guideId)); setSavedId(String(detail.guideId || "")); setMessage(detail.summary || "여행 가이드를 불러왔습니다.");
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [guideId, draftId]);

  function updateCurrentSpots(nextSpots) { const next = guides.map((item, index) => index === activeDay ? { ...item, spots: nextSpots } : item); setGuides(next); setManuallyEdited(true); setSaved(false); setSavedId(""); remember(next, { saved: false, savedGuideId: "", manuallyEdited: true }); }
  function dropAt(index) { if (dragged == null || dragged === index) return; const next = [...guide.spots]; const [moved] = next.splice(dragged, 1); next.splice(index, 0, moved); updateCurrentSpots(next); setDragged(null); setActive(index); }
  function removeSpot(index) { if (guide.spots.length <= 1) { setMessage("관광지는 한 곳 이상 필요합니다."); return; } updateCurrentSpots(guide.spots.filter((_, itemIndex) => itemIndex !== index)); setActive(Math.max(0, Math.min(active, guide.spots.length - 2))); }

  async function searchPlaces(pageNo = 1) {
    setPlaceLoading(true); setMessage("");
    try { const result = await getNearbyManualPlaces({ latitude: conditions.accommodation?.latitude, longitude: conditions.accommodation?.longitude, pageNo }); const items = result.items || []; const query = placeQuery.trim(); const nextItems = items.map(normalizePlace).filter((item) => !query || item.name.includes(query)).filter((item) => !guides.some((day) => day.spots.some((spotItem) => spotItem.contentId === item.contentId))); setPlaceResults((current) => pageNo === 1 ? nextItems : [...current, ...nextItems.filter((item) => !current.some((currentItem) => currentItem.contentId === item.contentId))]); setPlacePage(Number(result.pageNo || pageNo)); setPlaceHasNext(Boolean(result.hasNext)); }
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
    if (manuallyEdited) {
      setSaving(true); setMessage("");
      try {
        const contentIds = guides.flatMap((day) => day.spots.map((spot) => spot.contentId));
        if (contentIds.some((contentId) => !contentId)) throw new Error("관광지 식별 정보가 없어 수동 일정을 저장할 수 없습니다.");
        if (new Set(contentIds).size !== contentIds.length) throw new Error("같은 관광지를 중복 선택할 수 없습니다.");
        const manualDraft = await createManualTravelGuide(manualGuidePayload(conditions, guides));
        const nextDraftId = manualDraft.draftId;
        const result = await saveTravelGuideDraft(nextDraftId);
        setGeneratedDraftId(String(nextDraftId)); setManuallyEdited(false); setRefreshAvailable(false); setSaved(true); setSavedId(String(result.guideId || result.id || "")); setMessage("수정한 여행 일정을 저장했습니다.");
      } catch (requestError) { setMessage(requestError.message); }
      finally { setSaving(false); }
      return;
    }
    if (draftId || generatedDraftId) {
      setSaving(true); setMessage("");
      try { const result = await saveTravelGuideDraft(draftId || generatedDraftId); setSaved(true); setSavedId(String(result.guideId || result.id || "")); setMessage("여행 가이드를 저장했습니다."); }
      catch (requestError) { setMessage(requestError.message); }
      finally { setSaving(false); }
      return;
    }
    if (!hasSession()) { setMessage("로그인 후 일정을 저장할 수 있어요."); return; }
    setMessage("백엔드에서 생성한 여행안만 저장할 수 있습니다. 추천을 다시 생성해 주세요.");
  }

  if (loading) return <main className="travel-result-main"><section className="travel-guide-loading"><div className="travel-loading-orbit"><span>일</span><i /></div><span className="travel-guide-eyebrow">AI TRAVEL CURATOR</span><h1>당신만의 여행을<br />만들고 있어요</h1><p>입력한 지역과 숙소 주변 관광지를 비교하고 있어요.</p><ol className="travel-loading-steps"><li className="is-active"><b>01</b><span>숙소 위치 확인</span></li><li><b>02</b><span>주변 관광지 검색</span></li><li><b>03</b><span>최적 동선 만들기</span></li></ol><div className="travel-loading-bar"><span /></div></section></main>;
  if (error || !guide) return <main className="travel-result-main"><section className="travel-guide-error"><span>!</span><h1>가이드를 만들지 못했어요</h1><p>{error || "추천 결과가 없습니다."}</p><div><Link className="button" to="/recommend">조건 다시 선택</Link><button className="button button-primary" onClick={() => load(false)}>다시 시도</button></div></section></main>;

  const totalMinutes = guide.spots.reduce((sum, item) => sum + Number(item.stayMinutes || 0) + Number(item.travelMinutes || 0), 0);
  const totalDistance = guide.spots.reduce((sum, item) => sum + Number(item.distanceFromPreviousKm || 0), 0);
  const preferences = [...(conditions.themes || []), conditions.transportType, conditions.companionType].filter(Boolean);
  return <main className="travel-result-main"><section className="travel-guide-content travel-result-content">
    <Link className="travel-guide-back" to="/recommend">← 조건 다시 선택하기</Link>
    <header className="travel-guide-heading"><div><span className="travel-guide-eyebrow">YOUR PERSONAL GUIDE</span><h2><strong>{guide.region || "전라도"}</strong>, 이렇게 둘러보세요</h2><p><b>{guide.hotel?.name || "추천 출발지"}</b>에서 출발하는 실제 위치 기반 추천 동선이에요.</p><div className="travel-selected-preferences">{preferences.map((value) => <span key={value}># {value}</span>)}</div></div><div className="travel-guide-period"><span>{formatDate(conditions.startDate)} — {formatDate(conditions.endDate)}</span><div className="travel-guide-actions"><button className="travel-save-guide" data-saved={saved} type="button" onClick={toggleSave} disabled={saving}>{saved ? "♥ 저장됨" : saving ? "저장 중" : "♡ 일정 저장"}</button><button className="travel-recommend-again" type="button" onClick={() => load(true)} disabled={!refreshAvailable || attempt >= 2}>{!refreshAvailable || attempt >= 2 ? "✓ 추천 완료" : "↻ 한 번 더 추천받기"}</button></div></div></header>
    {message && <div className="page-status is-visible">{message}</div>}
    <nav className="travel-day-navigation" aria-label="여행 날짜별 일정"><div>{guides.map((_, index) => <button data-day={index} className={index === activeDay ? "is-active" : ""} type="button" key={index} onClick={() => { setActiveDay(index); setActive(0); setReturnMode(false); }}><b>DAY {index + 1}</b><small>{dayLabel(conditions.startDate, index)}</small></button>)}</div></nav>
    <div className="travel-route-layout" key={activeDay}><aside className="travel-place-panel"><div className="travel-route-summary"><span>DAY {activeDay + 1} · 추천 동선</span><b>관광지 {guide.spots.length}곳 · 약 {Math.max(1, Math.round(totalMinutes / 60))}시간 · {totalDistance.toFixed(1)}km</b></div><div>{guide.spots.map((item, index) => <button className={`travel-place-card${!returnMode && index === active ? " is-active" : ""}`} type="button" draggable="true" onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropAt(index)} onClick={() => { setActive(index); setReturnMode(false); }} onContextMenu={(event) => { event.preventDefault(); removeSpot(index); }} title="끌어서 순서 변경 · 우클릭으로 제거" key={`${item.name}-${index}`}><span className="travel-place-number">{index + 1}</span><span><b>{item.name}</b><small>{item.category}</small></span><span className="travel-driving-info"><b>{item.time}</b><small>{item.stayMinutes || 60}분</small></span></button>)}</div><button className="travel-add-place" type="button" onClick={() => { setPlaceModal(true); setPlaceResults([]); }}><b>＋</b> 관광지 추가하기</button><button className={`travel-return-hotel${returnMode ? " is-active" : ""}`} type="button" onClick={() => setReturnMode(true)}><span>숙소로 복귀</span><small>복귀 경로 보기</small></button></aside>
      <section className="travel-route-map travel-kakao-map-wrap" aria-label="숙소 주변 추천 관광지와 여행 경로"><KakaoRouteMap guide={guide} active={returnMode ? -1 : active} onSelect={(index) => { setActive(index); setReturnMode(false); }} />{!returnMode && spot && <article className="travel-map-card"><span>{active + 1}</span><div><b>{spot.name}</b><small>{spot.address || spot.category}</small><p>{spot.description}</p>{spot.sourceUrl && <a href={spot.sourceUrl} target="_blank" rel="noreferrer">{spot.sourceTitle || "정보 출처"} ↗</a>}</div></article>}</section>
    </div>
    <aside className="travel-guide-tip"><span>AI 여행 TIP</span><p>{guide.tip}</p></aside><div className="travel-jobs-cta"><div><span>WORK NEARBY</span><strong>추천 지역 주변에서 일자리도 찾아보세요</strong><p>관광·축제·팝업 등 지역에 등록된 일자리를 바로 확인할 수 있어요.</p></div><Link to={`/map?region=${encodeURIComponent(guide.region || "")}`}>주변 일자리 찾아보기 <b>→</b></Link></div>
  </section>
  {placeModal && <div className="travel-place-search-backdrop"><section className="travel-place-search-dialog" role="dialog" aria-modal="true" aria-labelledby="travel-place-search-title"><header><div><span>ADD A PLACE</span><h2 id="travel-place-search-title">관광지 추가하기</h2></div><button type="button" aria-label="닫기" onClick={() => setPlaceModal(false)}>×</button></header><label><span>⌕</span><input type="search" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchPlaces(1); } }} placeholder="관광지 이름을 검색하세요" autoFocus /></label><div id="travel-place-search-results">{placeResults.length ? <>{placeResults.map((item) => <button type="button" key={item.contentId} onClick={() => { updateCurrentSpots([...guide.spots, item]); setActive(guide.spots.length); setPlaceModal(false); }}><span><b>{item.name}</b><small>{item.address}{item.distanceMeters ? ` · ${(item.distanceMeters / 1000).toFixed(1)}km` : ""}</small></span><strong>추가 →</strong></button>)}{placeHasNext && <button type="button" disabled={placeLoading} onClick={() => searchPlaces(placePage + 1)}><span><b>{placeLoading ? "불러오는 중" : "관광지 더 보기"}</b><small>다음 30개 결과</small></span><strong>＋</strong></button>}</> : <p>{placeLoading ? "관광지를 검색하고 있어요." : "검색어를 입력하고 Enter를 눌러주세요."}</p>}</div></section></div>}
  </main>;
}
