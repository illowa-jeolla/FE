import BrandCharacter from "../components/BrandCharacter";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { hasSession } from "../auth/session";
import KakaoRouteMap from "../components/KakaoRouteMap";
import { getSavedTravelGuide, getSavedTravelGuides, getTourPlaceDetail, getTravelGuideDraft, removeSavedTravelGuide, requestTravelGuideAlternative, requestTravelRecommendation, saveTravelGuideDraft, waitForTravelRecommendation } from "../api/travelRecommendations";

function dayLabel(start, index) { if (!start) return ""; const date = new Date(`${start}T00:00:00`); date.setDate(date.getDate() + index); return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(value) { if (!value) return "미정"; return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function routeDuration(minutes) { const value = Math.max(1, Math.round(Number(minutes) || 0)); const hours = Math.floor(value / 60); const rest = value % 60; return hours ? `${hours}시간${rest ? ` ${rest}분` : ""}` : `${rest}분`; }
function coordinates(item) { const latitude = Number(item?.latitude ?? item?.lat ?? item?.y); const longitude = Number(item?.longitude ?? item?.lng ?? item?.x); return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null; }
function estimatedLeg(from, to, transportType) { const a = coordinates(from); const b = coordinates(to); if (!a || !b) return null; const radians = (value) => value * Math.PI / 180; const dLat = radians(b.latitude - a.latitude); const dLng = radians(b.longitude - a.longitude); const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2; const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)); const speed = String(transportType).includes("도보") ? 4 : String(transportType).includes("대중") ? 25 : 35; return { distanceMeters: distanceKm * 1000, durationMinutes: distanceKm / speed * 60, estimated: true }; }
function homepageUrl(value) { const text = String(value || ""); const href = text.match(/href=["']<?([^"'>]+)>?["']/i)?.[1]; return String(href || text.match(/https?:\/\/[^\s"<]+/i)?.[0] || "").replace(/^<|>$/g, "").replace(/&amp;/g, "&"); }
function logGuideJson(label, value) {
  console.log(`[travel-guide] ${label}:`, value);
  console.log(`[travel-guide] ${label} JSON:`, JSON.stringify(value, null, 2));
}

function normalizeDraft(detail, conditions) {
  const days = [...(detail.days || [])].sort((a, b) => Number(a.dayNumber || 0) - Number(b.dayNumber || 0));
  const hotel = detail.accommodation || conditions.accommodation;
  const startLocation = detail.startLocation || conditions.startLocation;
  const endLocation = detail.endLocation || conditions.endLocation;
  return days.map((day, dayIndex) => {
    const routeSegments = [...(day.routeSegments || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((segment) => ({ ...segment, distanceMeters: Number(segment.distanceMeters || 0), durationMinutes: Number(segment.durationMinutes || 0), estimated: Boolean(segment.estimated), path: (segment.path || []).map((point) => ({ latitude: Number(point.latitude), longitude: Number(point.longitude) })) }));
    const items = [...(day.items || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const isLastDay = dayIndex === days.length - 1;
    const destination = isLastDay ? endLocation : hotel;
    return { region: detail.regionName || conditions.regionName || "전라도", hotel: { name: hotel?.name || "추천 출발지", address: hotel?.address || "", latitude: hotel?.latitude, longitude: hotel?.longitude }, routeStart: dayIndex === 0 ? (startLocation || hotel) : hotel, routeDestination: destination, destinationLabel: isLastDay ? (destination?.name || "마지막 날 도착지") : "숙소로 복귀", isLastDay, tip: detail.travelTip || "여행 전 운영 시간과 이동 방법을 확인해 주세요.", routeSegments, spots: items.map((item, index) => { const segment = routeSegments[index]; return { contentId: String(item.contentId || ""), name: item.title || item.name, address: item.address || "", category: item.category || "관광지", description: item.reason || item.description || "추천 관광지입니다.", latitude: Number(item.latitude), longitude: Number(item.longitude), imageUrl: item.thumbnailUrl || item.firstImage || "", sourceUrl: item.sourceUrl || item.homepageUrl || item.detailUrl || "", sourceTitle: item.sourceTitle || "상세 정보", stayMinutes: Number(item.stayMinutes || 0), travelMinutes: Number(segment?.durationMinutes ?? item.travelMinutes ?? 0), distanceFromPreviousKm: Number(segment ? Number(segment.distanceMeters || 0) / 1000 : item.distanceFromPreviousKm || 0), routeEstimated: Boolean(segment?.estimated) }; }) };
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
    transportType: "CAR",
    companionType: conditions.companionType
  };
}

export default function TravelGuidePage() {
  const { guideId, draftId } = useParams();
  const location = useLocation();
  const restored = useMemo(() => { try { return JSON.parse(sessionStorage.getItem("travelGuideResult") || "null"); } catch { return null; } }, []);
  const conditions = useMemo(() => location.state || restored?.conditions || JSON.parse(sessionStorage.getItem("travelGuideConditions") || "{}"), [location.state, restored]);
  const validRestored = Boolean((restored?.guides || restored?.guide?.days || [restored?.guide]).filter(Boolean).some((item) => item?.spots?.length));
  const [guides, setGuides] = useState(validRestored ? (restored?.guides || restored?.guide?.days || [restored.guide]) : []);
  const [activeDay, setActiveDay] = useState(0);
  const [active, setActive] = useState(0);
  const [hoveredSpotIndex, setHoveredSpotIndex] = useState(null);
  const [mapFocusKey, setMapFocusKey] = useState(0);
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
  const [saveToast, setSaveToast] = useState(null);
  const [spotDetail, setSpotDetail] = useState(null);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const guide = guides[activeDay];
  const spot = guide?.spots?.[active];
  const previewSpot = hoveredSpotIndex == null ? spot : guide?.spots?.[hoveredSpotIndex];
  const displayedSpot = spotDetail?.contentId === previewSpot?.contentId ? { ...previewSpot, ...spotDetail } : previewSpot;
  const displayedSpotIndex = hoveredSpotIndex == null ? active : hoveredSpotIndex;
  useEffect(() => {
    if (!saveToast) return undefined;
    const timer = window.setTimeout(() => setSaveToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [saveToast]);

  useEffect(() => {
    let current = true;
    setSpotDetail(null);
    setDetailExpanded(false);
    if (!previewSpot?.contentId) return () => { current = false; };
    getTourPlaceDetail(previewSpot.contentId).then((detail) => { if (current) setSpotDetail({ contentId: String(detail.contentId || previewSpot.contentId), name: detail.title || previewSpot.name, address: detail.address || previewSpot.address, description: detail.overview || previewSpot.description, imageUrl: detail.firstImage || detail.firstImageThumbnail || previewSpot.imageUrl, sourceUrl: homepageUrl(detail.homepage) || previewSpot.sourceUrl, sourceTitle: homepageUrl(detail.homepage) ? "공식 사이트에서 보기" : previewSpot.sourceTitle }); }).catch(() => {});
    return () => { current = false; };
  }, [previewSpot?.contentId]);

  function remember(nextGuides = guides, extra = {}) { const first = nextGuides[0]; sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide: { ...first, days: nextGuides }, guides: nextGuides, attempt, conditions, saved, savedGuideId: savedId, ...extra })); }
  async function load(alternative = false) {
    if (alternative && (!refreshAvailable || attempt >= 2)) { setMessage("이 여행안은 더 이상 새로 추천받을 수 없어요."); return; }
    setLoading(true); setError(""); setMessage("");
    const nextAttempt = alternative ? 2 : attempt;
    try {
      let response = alternative && generatedDraftId ? await requestTravelGuideAlternative(generatedDraftId) : await requestTravelRecommendation(recommendationPayload(conditions));
      logGuideJson(alternative ? "alternative response" : "POST /api/v1/travel-recommendations response", response);
      if (response.requestId && String(response.status || "").toUpperCase() !== "COMPLETED") {
        const requestId = response.requestId;
        response = await waitForTravelRecommendation(requestId);
        logGuideJson(`GET /api/v1/travel-recommendations/${requestId} response`, response);
      }
      const nextDraftId = response.draftId || response.travelGuideDraftId || response.guideDraftId || generatedDraftId;
      const detail = response.days?.length ? response : await getTravelGuideDraft(nextDraftId);
      logGuideJson(response.days?.length ? "travel guide detail response" : `GET /api/v1/travel-guides/drafts/${nextDraftId} response`, detail);
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
        logGuideJson(guideId ? `GET /api/v1/travel-guides/${guideId} response` : `GET /api/v1/travel-guides/drafts/${draftId} response`, detail);
        const backendDays = normalizeDraft(detail, conditions);
        const loadedSaved = Boolean(guideId || detail.saved || detail.isSaved || detail.savedAt || detail.savedGuideId);
        const loadedSavedId = String(guideId || detail.savedGuideId || (loadedSaved ? detail.guideId : "") || "");
        setGuides(backendDays); setRefreshAvailable(Boolean(detail.refreshAvailable)); setSaved(loadedSaved); setSavedId(loadedSavedId); setMessage(detail.summary || "여행 가이드를 불러왔습니다.");
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [guideId, draftId]);

  async function toggleSave() {
    if (saved) {
      const targetId = guideId || savedId;
      if (!targetId) { setSaved(false); setMessage(""); setSaveToast({ text: "저장이 취소되었습니다.", id: Date.now() }); return; }
      setSaving(true); setMessage("");
      try {
        await removeSavedTravelGuide(targetId);
        setSaved(false); setSavedId("");
        remember(guides, { saved: false, savedGuideId: "" });
        setMessage(""); setSaveToast({ text: "저장이 취소되었습니다.", id: Date.now() });
      }
      catch (requestError) { setMessage(requestError.message); }
      finally { setSaving(false); }
      return;
    }
    if (draftId || generatedDraftId) {
      setSaving(true); setMessage("");
      try { const result = await saveTravelGuideDraft(draftId || generatedDraftId); const nextSavedId = String(result.guideId || result.id || ""); setSaved(true); setSavedId(nextSavedId); remember(guides, { saved: true, savedGuideId: nextSavedId }); setMessage(""); setSaveToast({ text: "저장되었습니다.", id: Date.now() }); }
      catch (requestError) {
        if (/이미\s*저장|already\s*saved/i.test(requestError.message || "")) {
          let existingId = "";
          try {
            const savedData = await getSavedTravelGuides();
            const savedItems = Array.isArray(savedData) ? savedData : savedData?.content || savedData?.items || savedData?.guides || [];
            const currentDraftId = String(draftId || generatedDraftId || "");
            const existing = savedItems.find((item) => String(item.draftId || item.travelGuideDraftId || item.sourceDraftId || "") === currentDraftId);
            existingId = String(existing?.guideId || existing?.id || "");
          } catch { /* The saved visual state is still known from the backend conflict. */ }
          setSaved(true); setSavedId(existingId); remember(guides, { saved: true, savedGuideId: existingId }); setMessage(""); setSaveToast({ text: "저장되었습니다.", id: Date.now() });
        } else setMessage(requestError.message);
      }
      finally { setSaving(false); }
      return;
    }
    if (!hasSession()) { setMessage("로그인 후 일정을 저장할 수 있어요."); return; }
    setMessage("백엔드에서 생성한 여행안만 저장할 수 있습니다. 추천을 다시 생성해 주세요.");
  }

  if (loading) return <main className="travel-result-main"><section className="travel-guide-loading"><BrandCharacter pose="loading" /><span className="travel-guide-eyebrow">AI TRAVEL CURATOR</span><h1>당신만의 여행을<br />만들고 있어요</h1><p>입력한 지역과 숙소 주변 관광지를 비교하고 있어요.</p><ol className="travel-loading-steps"><li className="is-active"><b>01</b><span>숙소 위치 확인</span></li><li><b>02</b><span>주변 관광지 검색</span></li><li><b>03</b><span>최적 동선 만들기</span></li></ol><div className="travel-loading-bar"><span /></div></section></main>;
  if (error || !guide) return <main className="travel-result-main"><section className="travel-guide-error"><span>!</span><h1>가이드를 만들지 못했어요</h1><p>{error || "추천 결과가 없습니다."}</p><div><Link className="button" to="/recommend">조건 다시 선택</Link><button className="button button-primary" onClick={() => load(false)}>다시 시도</button></div></section></main>;

  const finalSegment = guide.routeSegments[guide.spots.length];
  const finalLeg = finalSegment?.durationMinutes || finalSegment?.distanceMeters ? finalSegment : estimatedLeg(guide.spots.at(-1), guide.routeDestination, conditions.transportType);
  const finalLegText = finalLeg ? `${finalLeg.estimated ? "예상 " : "약 "}${routeDuration(finalLeg.durationMinutes)} · ${(Number(finalLeg.distanceMeters || 0) / 1000).toFixed(1)}km` : "경로 정보 확인 필요";
  const totalTravelMinutes = guide.spots.reduce((sum, item) => sum + Number(item.travelMinutes || 0), 0) + Number(finalLeg?.durationMinutes || 0);
  const totalDistance = guide.spots.reduce((sum, item) => sum + Number(item.distanceFromPreviousKm || 0), 0) + Number(finalLeg?.distanceMeters || 0) / 1000;
  const preferences = [...(conditions.themes || []), conditions.transportType, conditions.companionType].filter(Boolean);
  return <main className="travel-result-main travel-result-map-page">{saveToast && <div className="travel-save-toast" key={saveToast.id} role="status">{saveToast.text}</div>}<section className="travel-guide-content travel-result-content">
    <div className="travel-result-map-stage" key={activeDay}>
      <section className="travel-route-map travel-kakao-map-wrap" aria-label="숙소 주변 추천 관광지와 여행 경로"><KakaoRouteMap guide={guide} active={returnMode ? guide.spots.length : active} focusKey={mapFocusKey} onPreviewChange={setHoveredSpotIndex} onSelect={(index, options) => { setHoveredSpotIndex(null); setActive(index); setReturnMode(false); if (options?.focusMap !== false) setMapFocusKey((value) => value + 1); }} />{!returnMode && displayedSpot && <article className={`travel-map-card${detailExpanded ? " is-expanded" : ""}`} key={`map-card-${displayedSpotIndex}-${hoveredSpotIndex == null ? "selected" : "preview"}`}>{displayedSpot.imageUrl && <img className="travel-map-card-image" src={displayedSpot.imageUrl} alt="" />}<div className="travel-map-card-copy"><div className="travel-map-card-heading"><span>{displayedSpotIndex + 1}</span><b>{displayedSpot.name}</b></div><small>{displayedSpot.address || displayedSpot.category}</small><p>{displayedSpot.description}</p><div className="travel-map-card-actions"><button type="button" onClick={() => setDetailExpanded((value) => !value)}>{detailExpanded ? "접기" : "더보기"}</button>{detailExpanded && displayedSpot.sourceUrl && <a className="travel-map-card-site-link" href={displayedSpot.sourceUrl} target="_blank" rel="noreferrer">사이트 이동 ↗</a>}</div></div></article>}</section>
      <div className="travel-result-toolbar">
        <Link className="travel-guide-back" to="/recommend">← 조건 다시 선택하기</Link>
        <div className="travel-guide-period"><span>{formatDate(conditions.startDate)} — {formatDate(conditions.endDate)}</span><div className="travel-guide-actions"><button className="travel-save-guide" data-saved={saved} type="button" onClick={toggleSave} disabled={saving}>{saved ? "♥ 저장됨" : saving ? "저장 중" : "♡ 일정 저장"}</button><button className="travel-recommend-again" type="button" onClick={() => load(true)} disabled={!refreshAvailable || attempt >= 2}>{!refreshAvailable || attempt >= 2 ? "✓ 추천 완료" : "↻ 한 번 더 추천받기"}</button></div></div>
      </div>
      <aside className="travel-result-side-panel">
        <header className="travel-guide-heading"><div><span className="travel-guide-eyebrow">YOUR PERSONAL GUIDE</span><h2><strong>{guide.region || "전라도"}</strong>, 이렇게 둘러보세요</h2><p><b>{guide.hotel?.name || "추천 출발지"}</b>에서 출발하는 실제 위치 기반 추천 동선이에요.</p><div className="travel-selected-preferences">{preferences.map((value) => <span key={value}># {value}</span>)}</div></div></header>
        {message && <div className="page-status is-visible">{message}</div>}
        <nav className="travel-day-navigation" aria-label="여행 날짜별 일정"><div>{guides.map((_, index) => <button data-day={index} className={index === activeDay ? "is-active" : ""} type="button" key={index} onClick={() => { setActiveDay(index); setActive(0); setReturnMode(false); }}><b>DAY {index + 1}</b><small>{dayLabel(conditions.startDate, index)}</small></button>)}</div></nav>
        <div className="travel-place-panel"><div className="travel-route-summary"><span>DAY {activeDay + 1} · 추천 동선</span><b>관광지 {guide.spots.length}곳 · 이동 약 {routeDuration(totalTravelMinutes)} · {totalDistance.toFixed(1)}km</b></div><div>{guide.spots.map((item, index) => <button className={`travel-place-card${!returnMode && index === active ? " is-active" : ""}`} type="button" onClick={() => { setActive(index); setReturnMode(false); setMapFocusKey((value) => value + 1); }} key={`${item.name}-${index}`}><span className="travel-place-number">{index + 1}</span><span><b>{item.name}</b><small>{item.category}</small></span><span className="travel-driving-info"><b>{item.routeEstimated ? "예상 " : "약 "}{routeDuration(item.travelMinutes)}</b><small>{item.distanceFromPreviousKm.toFixed(1)}km</small></span></button>)}</div><button className={`travel-place-card travel-return-hotel${returnMode ? " is-active" : ""}`} type="button" onClick={() => { setReturnMode(true); setMapFocusKey((value) => value + 1); }}><span className="travel-return-icon" aria-hidden="true">{guide.isLastDay ? "→" : "↩"}</span><span><b>{guide.isLastDay ? "마지막 도착지" : "숙소로 복귀"}</b><small>{guide.destinationLabel}</small></span><span className="travel-driving-info"><b>{finalLegText.split("·")[0]?.trim()}</b><small>{finalLegText.split("·")[1]?.trim()}</small></span></button></div>
        <aside className="travel-guide-tip"><span>AI 여행 TIP</span><p>{guide.tip}</p></aside>
        <div className="travel-jobs-cta"><div><span>WORK NEARBY</span><strong>추천 지역 주변 일자리</strong></div><Link to={`/jobs?region=${encodeURIComponent(guide.region || "")}`}>찾아보기 <b>→</b></Link></div>
      </aside>
    </div>
  </section></main>;
}
