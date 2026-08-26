const { request, escapeHtml } = Workation;
const loadingView = document.querySelector("#travel-guide-loading");
const errorView = document.querySelector("#travel-guide-error");
const guideView = document.querySelector("#travel-guide-content");
const loadingMessage = document.querySelector("#travel-loading-message");
const loadingSteps = [...document.querySelectorAll(".travel-loading-steps li")];
const conditions = JSON.parse(sessionStorage.getItem("travelGuideConditions") || "{}");
let guide = null;
let activeSpot = 0;
let detailOpen = true;
let stepTimer;
let attempt = 1;
let isSavedGuide = new URLSearchParams(location.search).get("saved") === "1";
let savedGuideId = new URLSearchParams(location.search).get("guideId") || "";
const excludedSpots = [];
let kakaoMap = null;
let kakaoMarkers = [];
let kakaoRoute = null;
let kakaoSdkPromise = null;
let kakaoGuideSignature = "";
let kakaoRoadRouteSignature = "";
let kakaoRoadPoints = [];
let kakaoDrivingLegs = [];
let kakaoDrivingSummary = null;

function formatDate(value) { if (!value) return ""; const [y, m, d] = value.split("-"); return `${y}.${m}.${d}`; }
function minutesLabel(value) { const minutes = Number(value) || 60; return minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `${minutes}분`; }
function drivingTimeLabel(seconds) { const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `${minutes}분`; }
function drivingDistanceLabel(meters) { const distance = Number(meters) || 0; return distance >= 1000 ? `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)}km` : `${Math.round(distance)}m`; }

function updateDrivingInfo() {
  if (!kakaoDrivingSummary) return;
  document.querySelector("#travel-route-summary-detail").textContent = `자동차 총 ${drivingDistanceLabel(kakaoDrivingSummary.distanceMeters)} · 약 ${drivingTimeLabel(kakaoDrivingSummary.durationSeconds)}`;
  document.querySelectorAll(".travel-place-card").forEach((card, index) => {
    const leg = kakaoDrivingLegs[index];
    const drivingInfo = card.querySelector(".travel-driving-info");
    if (!leg || !drivingInfo) return;
    drivingInfo.innerHTML = `<b>자동차 ${drivingTimeLabel(leg.durationSeconds)}</b><small>${drivingDistanceLabel(leg.distanceMeters)}</small>`;
  });
}

function beginLoadingSteps() {
  let step = 0;
  const messages = ["입력한 지역과 숙소 위치를 확인하고 있어요.", "숙소 주변의 실제 관광지를 검색하고 있어요.", "거리와 이동 순서를 비교해 동선을 만들고 있어요."];
  stepTimer = setInterval(() => { step = Math.min(step + 1, 2); loadingSteps.forEach((item, index) => item.classList.toggle("is-active", index <= step)); loadingMessage.textContent = messages[step]; }, 3200);
}

function mapPositions(data) {
  const fixedPositions = [
    { x: 18, y: 35 },
    { x: 34, y: 56 },
    { x: 50, y: 70 },
    { x: 66, y: 45 },
    { x: 81, y: 63 }
  ];
  data.hotel = { ...data.hotel, x: 10, y: 22 };
  data.spots = data.spots.map((spot, index) => ({ ...spot, ...fixedPositions[index] }));
}

async function loadKakaoSdk() {
  if (window.kakao?.maps) return window.kakao.maps;
  if (kakaoSdkPromise) return kakaoSdkPromise;
  kakaoSdkPromise = (async () => {
    const config = await request("/api/public-config");
    if (!config.kakaoMapJavaScriptKey) throw new Error("카카오맵 키가 설정되지 않았습니다.");
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(config.kakaoMapJavaScriptKey)}&autoload=false&libraries=services`;
      script.onload = () => window.kakao.maps.load(resolve);
      script.onerror = () => reject(new Error("카카오맵을 불러오지 못했습니다."));
      document.head.appendChild(script);
    });
    return window.kakao.maps;
  })();
  return kakaoSdkPromise;
}

function resolveKakaoPosition(maps, item, region = "") {
  const fallback = { latitude: Number(item?.latitude), longitude: Number(item?.longitude) };
  const query = `${region} ${String(item?.name || "").trim()}`.trim();
  return new Promise((resolve) => {
    const finishWithAddress = () => {
      const address = String(item?.address || "").trim();
      if (!address || !maps.services?.Geocoder) { resolve(fallback); return; }
      new maps.services.Geocoder().addressSearch(address, (results, status) => {
        if (status === maps.services.Status.OK && results[0]) resolve({ latitude: Number(results[0].y), longitude: Number(results[0].x) });
        else resolve(fallback);
      });
    };
    if (!query || !maps.services?.Places) { finishWithAddress(); return; }
    new maps.services.Places().keywordSearch(query, (results, status) => {
      if (status !== maps.services.Status.OK || !results.length) { finishWithAddress(); return; }
      const normalizedName = String(item?.name || "").replace(/\s+/g, "").toLowerCase();
      const matched = results.find((result) => {
        const placeName = String(result.place_name || "").replace(/\s+/g, "").toLowerCase();
        return placeName.includes(normalizedName) || normalizedName.includes(placeName);
      }) || results[0];
      resolve({ latitude: Number(matched.y), longitude: Number(matched.x) });
    });
  });
}

async function renderKakaoMap() {
  const container = document.querySelector("#travel-kakao-map");
  const status = document.querySelector("#travel-kakao-map-status");
  if (!container || !guide?.spots?.length) return;
  try {
    const maps = await loadKakaoSdk();
    status.hidden = true;
    const resolvedPositions = await Promise.all(guide.spots.map((spot) => resolveKakaoPosition(maps, spot, guide.region)));
    const validSpots = guide.spots.map((spot, index) => ({ spot, index, latitude: resolvedPositions[index].latitude, longitude: resolvedPositions[index].longitude }))
      .filter(({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude));
    if (!validSpots.length) throw new Error("관광지 위치 정보가 없습니다.");
    const nextGuideSignature = validSpots.map(({ spot, latitude, longitude }) => `${spot.name}:${latitude}:${longitude}`).join("|");
    const shouldFitBounds = nextGuideSignature !== kakaoGuideSignature;
    kakaoGuideSignature = nextGuideSignature;
    const center = new maps.LatLng(validSpots[0].latitude, validSpots[0].longitude);
    if (!kakaoMap) kakaoMap = new maps.Map(container, { center, level: 7 });
    kakaoMarkers.forEach((marker) => marker.setMap(null));
    kakaoMarkers = [];
    if (kakaoRoute) kakaoRoute.setMap(null);
    const bounds = new maps.LatLngBounds();
    const routePath = [];
    const hotelPositionData = await resolveKakaoPosition(maps, guide.hotel, guide.region);
    const hotelLatitude = hotelPositionData.latitude;
    const hotelLongitude = hotelPositionData.longitude;
    if (Number.isFinite(hotelLatitude) && Number.isFinite(hotelLongitude)) {
      const hotelPosition = new maps.LatLng(hotelLatitude, hotelLongitude);
      const hotelMarker = new maps.Marker({ map: kakaoMap, position: hotelPosition, title: guide.hotel.name || "숙소" });
      kakaoMarkers.push(hotelMarker); bounds.extend(hotelPosition); routePath.push(hotelPosition);
    }
    validSpots.forEach(({ spot, index, latitude, longitude }) => {
      const position = new maps.LatLng(latitude, longitude);
      const markerContent = document.createElement("button");
      const verifiedImage = /^https:\/\//.test(String(spot.imageUrl || "")) ? spot.imageUrl : "";
      markerContent.className = `kakao-photo-marker${verifiedImage ? "" : " no-photo"}${activeSpot === index ? " is-active" : ""}`;
      markerContent.type = "button";
      markerContent.dataset.spot = String(index);
      markerContent.title = `${index + 1}. ${spot.name}`;
      markerContent.innerHTML = `${verifiedImage ? `<img src="${escapeHtml(verifiedImage)}" alt="${escapeHtml(spot.name)}">` : `<i aria-hidden="true">⌖</i>`}<b>${index + 1}</b><span>${escapeHtml(spot.name)}</span>`;
      markerContent.querySelector("img")?.addEventListener("error", () => { markerContent.classList.add("no-photo"); markerContent.querySelector("img")?.remove(); markerContent.insertAdjacentHTML("afterbegin", '<i aria-hidden="true">⌖</i>'); }, { once: true });
      markerContent.addEventListener("click", (event) => { event.stopPropagation(); activeSpot = index; detailOpen = true; render(); });
      const marker = new maps.CustomOverlay({ map: kakaoMap, position, content: markerContent, yAnchor: 0 });
      kakaoMarkers.push(marker); bounds.extend(position); routePath.push(position);
    });
    const routingPoints = [
      ...(Number.isFinite(hotelLatitude) && Number.isFinite(hotelLongitude) ? [{ name: guide.hotel?.name || "숙소", latitude: hotelLatitude, longitude: hotelLongitude }] : []),
      ...validSpots.map(({ spot, latitude, longitude }) => ({ name: spot.name, latitude, longitude }))
    ];
    const routeSignature = routingPoints.map((point) => `${point.name}:${point.latitude}:${point.longitude}`).join("|");
    if (routeSignature !== kakaoRoadRouteSignature) {
      kakaoRoadRouteSignature = routeSignature;
      try {
        const roadRoute = await request("/api/travel-route", { method: "POST", body: JSON.stringify({ points: routingPoints }) });
        kakaoRoadPoints = Array.isArray(roadRoute.points) ? roadRoute.points : [];
        kakaoDrivingLegs = Array.isArray(roadRoute.legs) ? roadRoute.legs : [];
        kakaoDrivingSummary = { distanceMeters: Number(roadRoute.distanceMeters) || 0, durationSeconds: Number(roadRoute.durationSeconds) || 0 };
        updateDrivingInfo();
      } catch {
        kakaoRoadPoints = [];
        kakaoDrivingLegs = [];
        kakaoDrivingSummary = null;
      }
    }
    const roadPath = kakaoRoadPoints.map((point) => new maps.LatLng(Number(point.latitude), Number(point.longitude)))
      .filter((point) => Number.isFinite(point.getLat()) && Number.isFinite(point.getLng()));
    kakaoRoute = new maps.Polyline({ map: kakaoMap, path: roadPath.length > 1 ? roadPath : routePath, strokeWeight: 5, strokeColor: "#b74f81", strokeOpacity: .88, strokeStyle: "solid" });
    kakaoMap.relayout();
    if (shouldFitBounds) kakaoMap.setBounds(bounds, 60, 60, 60, 60);
  } catch (error) {
    status.hidden = false;
    status.textContent = error.message;
  }
}

function render() {
  document.querySelector("#guide-region-label").textContent = guide.region || "전라도";
  const supportedJobRegions = ["여수", "순천", "목포", "전주", "광주", "군산", "남원", "담양", "해남", "보성", "완도"];
  const jobRegion = supportedJobRegions.find((region) => String(guide.region || "").includes(region)) || guide.region || "";
  const jobsUrl = `map.html?view=search&region=${encodeURIComponent(jobRegion)}`;
  document.querySelector("#nearby-jobs-cta").href = jobsUrl;
  document.querySelector("#nearby-jobs-title").textContent = `${jobRegion || "추천 지역"} 주변에서 일자리도 찾아보세요`;
  document.querySelector("#guide-hotel-label").textContent = guide.hotel.name;
  document.querySelector("#guide-date-label").textContent = conditions.start || conditions.end ? `${formatDate(conditions.start) || "미정"} — ${formatDate(conditions.end) || "미정"}` : "일정 미정";
  document.querySelector("#travel-tip").textContent = guide.tip;
  const calculatedMinutes = guide.spots.reduce((total, spot) => total + Number(spot.stayMinutes || 0) + Number(spot.travelMinutes || 0), 0);
  const calculatedDistance = guide.spots.reduce((total, spot) => total + Number(spot.distanceFromPreviousKm || 0), 0);
  document.querySelector("#travel-route-summary-detail").textContent = `관광지 5곳 · 약 ${minutesLabel(calculatedMinutes)} · ${calculatedDistance.toFixed(1)}km`;
  const preferences = [...(conditions.themes || []), conditions.transport, conditions.companion].filter(Boolean);
  document.querySelector("#guide-preference-label").innerHTML = preferences.map((value) => `<span># ${escapeHtml(value)}</span>`).join("");
  document.querySelector("#travel-place-list").innerHTML = guide.spots.map((spot, index) => `<button class="travel-place-card ${index === activeSpot ? "is-active" : ""}" type="button" data-spot="${index}"><span class="travel-place-number">${index + 1}</span><span><b>${escapeHtml(spot.name)}</b><small>${escapeHtml(spot.category)}</small></span><span class="travel-driving-info"><b>${escapeHtml(spot.time)}</b><small>${minutesLabel(spot.stayMinutes)}</small></span></button>`).join("");
  updateDrivingInfo();
  const spot = guide.spots[activeSpot];
  const detailCard = document.querySelector("#travel-map-card");
  detailCard.hidden = !detailOpen;
  detailCard.innerHTML = `<span>${activeSpot + 1}</span><div><b>${escapeHtml(spot.name)}</b><small>${escapeHtml(spot.address)}</small><p>${escapeHtml(spot.description)}</p>${spot.sourceUrl ? `<a href="${escapeHtml(spot.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(spot.sourceTitle || "정보 출처")} ↗</a>` : ""}</div>`;
  detailCard.classList.remove("is-pin-detail");
  const againButton = document.querySelector("#recommend-again");
  againButton.hidden = attempt >= 3;
  againButton.textContent = "↻ 다른 코스 추천";
  document.querySelector("#reset-conditions").hidden = attempt < 3;
  const saveButton = document.querySelector("#save-guide");
  saveButton.dataset.saved = String(isSavedGuide);
  saveButton.disabled = false;
  saveButton.textContent = isSavedGuide ? "♥ 저장됨" : "♡ 일정 저장";
  renderKakaoMap();
}

async function loadGuide(isRetry = false) {
  if (isRetry && attempt < 3) {
    if (guide?.spots) excludedSpots.push(...guide.spots.map((spot) => spot.name));
    attempt += 1;
    isSavedGuide = false;
  }
  clearInterval(stepTimer); loadingView.hidden = false; errorView.hidden = true; guideView.hidden = true; beginLoadingSteps();
  try {
    guide = await request("/api/travel-guide", { method: "POST", body: JSON.stringify({ ...conditions, attempt, excludedSpots }) });
    kakaoRoadRouteSignature = ""; kakaoRoadPoints = []; kakaoDrivingLegs = []; kakaoDrivingSummary = null;
    if (!conditions.region) conditions.region = guide.region;
    mapPositions(guide); activeSpot = 0; detailOpen = true;
    sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide, attempt, excludedSpots, conditions, saved: false }));
    render(); clearInterval(stepTimer); loadingView.hidden = true; guideView.hidden = false;
  } catch (error) {
    clearInterval(stepTimer); loadingView.hidden = true; errorView.hidden = false; document.querySelector("#travel-guide-error-message").textContent = error.message;
  }
}

document.querySelector("#travel-place-list").addEventListener("click", (event) => { const button = event.target.closest("[data-spot]"); if (button) { activeSpot = Number(button.dataset.spot); detailOpen = true; render(); } });
document.addEventListener("click", (event) => {
  if (!guide || !detailOpen) return;
  if (event.target.closest("[data-spot], .kakao-photo-marker, #travel-map-card, #travel-kakao-map")) return;
  detailOpen = false;
  document.querySelector("#travel-map-card").hidden = true;
});
document.querySelector("#retry-guide").addEventListener("click", () => loadGuide(false));
document.querySelector("#recommend-again").addEventListener("click", () => loadGuide(true));
document.querySelector("#save-guide").addEventListener("click", async (event) => {
  if (!sessionStorage.getItem("accessToken")) { location.href = "auth.html"; return; }
  const button = event.currentTarget;
  button.disabled = true;
  try {
    if (isSavedGuide && !savedGuideId) {
      const dashboard = await request("/api/me");
      const currentNames = (guide.spots || []).map((spot) => spot.name).join("|");
      const matched = (dashboard.guides || []).find((item) => item.region === guide.region && (item.guide?.spots || []).map((spot) => spot.name).join("|") === currentNames);
      savedGuideId = matched ? String(matched.id) : "";
      if (!savedGuideId) isSavedGuide = false;
    }
    if (isSavedGuide && savedGuideId) {
      button.textContent = "저장 해제 중…";
      await request(`/api/me/guides/${savedGuideId}`, { method: "DELETE" });
      isSavedGuide = false;
      savedGuideId = "";
      button.dataset.saved = "false";
      button.textContent = "♡ 일정 저장";
      button.disabled = false;
      sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide, attempt, excludedSpots, conditions, saved: false, savedGuideId: "" }));
      history.replaceState(null, "", "travel-guide.html");
      return;
    }
    button.textContent = "저장 중…";
    const savedGuide = { ...guide, tripStart: conditions.start || "", tripEnd: conditions.end || "", conditions: { ...conditions } };
    const result = await request("/api/me/guides", { method: "POST", body: JSON.stringify({ title: `${guide.region} 맞춤 여행 가이드`, guide: savedGuide }) });
    isSavedGuide = true;
    savedGuideId = String(result.id);
    button.dataset.saved = "true"; button.textContent = "♥ 저장됨"; button.disabled = false;
    sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide: savedGuide, attempt, excludedSpots, conditions, saved: true, savedGuideId }));
    history.replaceState(null, "", `travel-guide.html?saved=1&guideId=${encodeURIComponent(savedGuideId)}`);
  } catch (error) { button.textContent = error.message || "저장 실패"; button.disabled = false; }
});
let savedResult = null;
try { savedResult = JSON.parse(sessionStorage.getItem("travelGuideResult") || "null"); }
catch { sessionStorage.removeItem("travelGuideResult"); }
if (savedResult?.guide) {
  guide = savedResult.guide;
  isSavedGuide = isSavedGuide || Boolean(savedResult.saved);
  savedGuideId = savedGuideId || String(savedResult.savedGuideId || "");
  attempt = Math.max(1, Math.min(3, Number(savedResult.attempt) || 1));
  excludedSpots.splice(0, excludedSpots.length, ...(savedResult.excludedSpots || []));
  Object.assign(conditions, savedResult.conditions || {});
  mapPositions(guide);
  loadingView.hidden = true;
  guideView.hidden = false;
  render();
} else {
  loadGuide();
}
