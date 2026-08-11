const { request, setStatus, escapeHtml } = Workation;

const hotelSuggestions = {
  여수: ["여수 베네치아 호텔", "소노캄 여수", "유탑 마리나 호텔", "라마다 프라자 여수"],
  전주: ["라한호텔 전주", "전주 왕의지밀", "베스트웨스턴 플러스 전주", "엔브릿지 호텔"],
  순천: ["에코그라드 호텔", "호텔 라움 순천", "순천만 스테이", "브라운도트 순천역점"]
};

const form = document.querySelector("#travel-guide-form");
const regionInput = document.querySelector("#travel-region");
const startInput = document.querySelector("#travel-start");
const endInput = document.querySelector("#travel-end");
const modal = document.querySelector("#hotel-search-modal");
const hotelQuery = document.querySelector("#hotel-search-query");
const selectedHotel = document.querySelector("#selected-hotel");
const guideContent = document.querySelector("#travel-guide-content");
const guideStatus = document.querySelector("#travel-guide-status");
const submitButton = form.querySelector(".travel-guide-submit");
let currentHotel = "";
let currentGuide = null;
let activeSpot = 0;

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function minutesLabel(minutes) {
  const value = Number(minutes) || 60;
  return value >= 60 ? `${Math.floor(value / 60)}시간${value % 60 ? ` ${value % 60}분` : ""}` : `${value}분`;
}

function renderHotels() {
  const query = hotelQuery.value.trim();
  const hotels = Object.entries(hotelSuggestions).flatMap(([region, names]) => names.map((name) => ({ region, name })))
    .filter(({ name, region }) => !query || name.includes(query) || region.includes(query));
  const custom = query ? `<button type="button" data-hotel="${escapeHtml(query)}" data-region="${escapeHtml(regionInput.value.trim())}"><span>⌕</span><span><b>‘${escapeHtml(query)}’ 숙소로 검색</b><small>AI가 실제 주소와 주변 관광지를 확인해요</small></span><strong>→</strong></button>` : "";
  const suggestions = hotels.map(({ region, name }) => `<button type="button" data-hotel="${escapeHtml(name)}" data-region="${escapeHtml(region)}"><span>⌂</span><span><b>${escapeHtml(name)}</b><small>${escapeHtml(region)} 추천 숙소</small></span><strong>→</strong></button>`).join("");
  document.querySelector("#hotel-results-list").innerHTML = custom + suggestions || '<p class="hotel-search-empty">호텔명이나 주소를 입력해 주세요.</p>';
}

function mapPositions(guide) {
  const points = [guide.hotel, ...guide.spots].filter((point) => Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude)));
  const lats = points.map((point) => Number(point.latitude));
  const lngs = points.map((point) => Number(point.longitude));
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const position = (point) => ({ x: 14 + ((Number(point.longitude) - minLng) / (maxLng - minLng || 1)) * 70, y: 18 + ((maxLat - Number(point.latitude)) / (maxLat - minLat || 1)) * 58 });
  return { spots: guide.spots.map(position), hotel: position(guide.hotel) };
}

function normalizeGuide(guide) {
  const positions = mapPositions(guide);
  return {
    ...guide,
    hotel: { ...guide.hotel, ...positions.hotel },
    spots: guide.spots.map((spot, index) => ({ ...spot, ...positions.spots[index] }))
  };
}

function renderGuide() {
  const guide = currentGuide;
  if (!guide) return;
  document.querySelector("#guide-region-label").textContent = guide.region || "전라도";
  document.querySelector("#guide-hotel-label").textContent = guide.hotel?.name || "추천 출발지";
  document.querySelector("#map-hotel-label").textContent = guide.hotel?.name || "추천 출발지";
  document.querySelector("#guide-date-label").textContent = startInput.value || endInput.value ? `${formatDate(startInput.value) || "미정"} — ${formatDate(endInput.value) || "미정"}` : "일정 미정";
  document.querySelector("#travel-tip").textContent = guide.tip;
  document.querySelector("#travel-route-summary-detail").textContent = `관광지 5곳 · 약 ${minutesLabel(guide.totalMinutes)} · ${Number(guide.totalDistanceKm || 0).toFixed(1)}km`;
  const preferences = [...form.querySelectorAll('input[name="themes"]:checked, input[name="transport"]:checked, input[name="companion"]:checked')].map((input) => input.value);
  document.querySelector("#guide-preference-label").innerHTML = preferences.map((value) => `<span># ${escapeHtml(value)}</span>`).join("");
  document.querySelector("#travel-place-list").innerHTML = guide.spots.map((spot, index) => `<button class="travel-place-card ${index === activeSpot ? "is-active" : ""}" type="button" data-spot="${index}"><span class="travel-place-number">${index + 1}</span><span><b>${escapeHtml(spot.name)}</b><small>${escapeHtml(spot.category)} · ${Number(spot.distanceFromPreviousKm || 0).toFixed(1)}km</small></span><span><b>${escapeHtml(spot.time)}</b><small>${minutesLabel(spot.stayMinutes)}</small></span></button>`).join("");
  document.querySelector("#travel-map-pins").innerHTML = guide.spots.map((spot, index) => `<button class="travel-map-pin ${index === activeSpot ? "is-active" : ""}" style="--x:${spot.x}%;--y:${spot.y}%" type="button" data-spot="${index}" aria-label="${escapeHtml(spot.name)}"><span>${index + 1}</span></button>`).join("");
  const spot = guide.spots[activeSpot];
  document.querySelector("#travel-map-card").innerHTML = `<span>${activeSpot + 1}</span><div><b>${escapeHtml(spot.name)}</b><small>${escapeHtml(spot.address || spot.category)}</small><p>${escapeHtml(spot.description)}</p>${spot.sourceUrl ? `<a href="${escapeHtml(spot.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(spot.sourceTitle || "정보 출처")} ↗</a>` : ""}</div><button type="button" aria-label="장소 저장">♡</button>`;
  const hotelPin = document.querySelector("#travel-hotel-pin");
  hotelPin.style.left = `${guide.hotel.x}%`;
  hotelPin.style.top = `${guide.hotel.y}%`;
}

function chooseSpot(index) { activeSpot = Number(index); renderGuide(); }

startInput.addEventListener("change", () => { endInput.min = startInput.value; if (endInput.value && endInput.value < startInput.value) endInput.value = startInput.value; });
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const themes = [...form.querySelectorAll('input[name="themes"]:checked')].map((input) => input.value);
  sessionStorage.setItem("travelGuideConditions", JSON.stringify({
    region: regionInput.value.trim(), hotel: currentHotel, start: startInput.value, end: endInput.value, themes,
    transport: form.querySelector('input[name="transport"]:checked')?.value,
    companion: form.querySelector('input[name="companion"]:checked')?.value
  }));
  sessionStorage.removeItem("travelGuideResult");
  location.href = "travel-guide.html";
});
document.querySelector("#travel-place-list").addEventListener("click", (event) => { const button = event.target.closest("[data-spot]"); if (button) chooseSpot(button.dataset.spot); });
document.querySelector("#travel-map-pins").addEventListener("click", (event) => { const button = event.target.closest("[data-spot]"); if (button) chooseSpot(button.dataset.spot); });
document.querySelector("#hotel-search-open").addEventListener("click", () => { modal.hidden = false; hotelQuery.value = ""; renderHotels(); requestAnimationFrame(() => hotelQuery.focus()); });
document.querySelector("#hotel-search-close").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (event) => { if (event.target === modal) modal.hidden = true; });
hotelQuery.addEventListener("input", renderHotels);
document.querySelector("#hotel-results-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-hotel]"); if (!button) return;
  currentHotel = button.dataset.hotel; selectedHotel.textContent = currentHotel;
  if (!regionInput.value.trim() && button.dataset.region) regionInput.value = button.dataset.region;
  currentGuide = null; modal.hidden = true;
});
document.querySelector("#save-guide").addEventListener("click", (event) => { event.currentTarget.textContent = event.currentTarget.textContent.includes("저장됨") ? "♡ 일정 저장" : "♥ 저장됨"; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !modal.hidden) modal.hidden = true; });
