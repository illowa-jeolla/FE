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
const fallbackImages = ["assets/JvLTt.jpeg", "assets/lX3GW.jpeg", "assets/J6aHjc.jpeg", "assets/u3OD9c.jpeg", "assets/bI7WI.jpeg"];

function formatDate(value) { if (!value) return ""; const [y, m, d] = value.split("-"); return `${y}.${m}.${d}`; }
function minutesLabel(value) { const minutes = Number(value) || 60; return minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `${minutes}분`; }

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

function render() {
  document.querySelector("#guide-region-label").textContent = guide.region || "전라도";
  const supportedJobRegions = ["여수", "순천", "목포", "전주", "광주", "군산", "남원", "담양", "해남", "보성", "완도"];
  const jobRegion = supportedJobRegions.find((region) => String(guide.region || "").includes(region)) || guide.region || "";
  const jobsUrl = `map.html?view=search&region=${encodeURIComponent(jobRegion)}`;
  document.querySelector("#nearby-jobs-cta").href = jobsUrl;
  document.querySelector("#nearby-jobs-title").textContent = `${jobRegion || "추천 지역"} 주변에서 일자리도 찾아보세요`;
  document.querySelector("#guide-hotel-label").textContent = guide.hotel.name;
  document.querySelector("#map-hotel-label").textContent = guide.hotel.name;
  document.querySelector("#guide-date-label").textContent = conditions.start || conditions.end ? `${formatDate(conditions.start) || "미정"} — ${formatDate(conditions.end) || "미정"}` : "일정 미정";
  document.querySelector("#travel-tip").textContent = guide.tip;
  const calculatedMinutes = guide.spots.reduce((total, spot) => total + Number(spot.stayMinutes || 0) + Number(spot.travelMinutes || 0), 0);
  const calculatedDistance = guide.spots.reduce((total, spot) => total + Number(spot.distanceFromPreviousKm || 0), 0);
  document.querySelector("#travel-route-summary-detail").textContent = `관광지 5곳 · 약 ${minutesLabel(calculatedMinutes)} · ${calculatedDistance.toFixed(1)}km`;
  const preferences = [...(conditions.themes || []), conditions.transport, conditions.companion].filter(Boolean);
  document.querySelector("#guide-preference-label").innerHTML = preferences.map((value) => `<span># ${escapeHtml(value)}</span>`).join("");
  document.querySelector("#travel-place-list").innerHTML = guide.spots.map((spot, index) => `<button class="travel-place-card ${index === activeSpot ? "is-active" : ""}" type="button" data-spot="${index}"><span class="travel-place-number">${index + 1}</span><span><b>${escapeHtml(spot.name)}</b><small>${escapeHtml(spot.category)} · ${Number(spot.distanceFromPreviousKm || 0).toFixed(1)}km</small></span><span><b>${escapeHtml(spot.time)}</b><small>${minutesLabel(spot.stayMinutes)}</small></span></button>`).join("");
  document.querySelector("#travel-map-pins").innerHTML = guide.spots.map((spot, index) => {
    const pinImage = spot.imageUrl || fallbackImages[index % fallbackImages.length];
    return `<button class="travel-map-pin travel-photo-pin ${index === activeSpot ? "is-active" : ""}" style="--x:${spot.x}%;--y:${spot.y}%" type="button" data-spot="${index}" aria-label="${escapeHtml(spot.name)}"><img src="${escapeHtml(pinImage)}" alt="" onerror="this.src='${fallbackImages[index % fallbackImages.length]}'"><span>${index + 1}</span><small>${escapeHtml(spot.name)}</small></button>`;
  }).join("");
  const spot = guide.spots[activeSpot];
  const detailCard = document.querySelector("#travel-map-card");
  detailCard.hidden = !detailOpen;
  detailCard.innerHTML = `<span>${activeSpot + 1}</span><div><b>${escapeHtml(spot.name)}</b><small>${escapeHtml(spot.address)}</small><p>${escapeHtml(spot.description)}</p>${spot.sourceUrl ? `<a href="${escapeHtml(spot.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(spot.sourceTitle || "정보 출처")} ↗</a>` : ""}</div><button type="button" aria-label="장소 저장">♡</button>`;
  detailCard.classList.add("is-pin-detail");
  detailCard.dataset.side = spot.x > 58 ? "left" : "right";
  detailCard.style.setProperty("--detail-x", `${spot.x}%`);
  detailCard.style.setProperty("--detail-y", `${Math.max(14, Math.min(72, spot.y))}%`);
  const hotelPin = document.querySelector("#travel-hotel-pin"); hotelPin.style.left = `${guide.hotel.x}%`; hotelPin.style.top = `${guide.hotel.y}%`;
  const againButton = document.querySelector("#recommend-again");
  againButton.hidden = attempt >= 3;
  againButton.textContent = "↻ 다른 코스 추천";
  document.querySelector("#reset-conditions").hidden = attempt < 3;
  const saveButton = document.querySelector("#save-guide");
  saveButton.dataset.saved = String(isSavedGuide);
  saveButton.disabled = false;
  saveButton.textContent = isSavedGuide ? "♥ 저장됨" : "♡ 일정 저장";
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
    if (!conditions.region) conditions.region = guide.region;
    mapPositions(guide); activeSpot = 0; detailOpen = true;
    sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide, attempt, excludedSpots, conditions, saved: false }));
    render(); clearInterval(stepTimer); loadingView.hidden = true; guideView.hidden = false;
  } catch (error) {
    clearInterval(stepTimer); loadingView.hidden = true; errorView.hidden = false; document.querySelector("#travel-guide-error-message").textContent = error.message;
  }
}

document.querySelector("#travel-place-list").addEventListener("click", (event) => { const button = event.target.closest("[data-spot]"); if (button) { activeSpot = Number(button.dataset.spot); detailOpen = true; render(); } });
document.querySelector("#travel-map-pins").addEventListener("click", (event) => { const button = event.target.closest("[data-spot]"); if (button) { activeSpot = Number(button.dataset.spot); detailOpen = true; render(); } });
document.addEventListener("click", (event) => {
  if (!guide || !detailOpen) return;
  if (event.target.closest("[data-spot], #travel-map-card, #travel-hotel-pin, .travel-map-controls")) return;
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
