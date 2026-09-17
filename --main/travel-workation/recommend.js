const { request, setStatus, escapeHtml } = Workation;

const hotelSuggestions = {
  여수: ["여수 베네치아 호텔", "소노캄 여수", "유탑 마리나 호텔", "라마다 프라자 여수"],
  전주: ["라한호텔 전주", "전주 왕의지밀", "베스트웨스턴 플러스 전주", "엔브릿지 호텔"],
  순천: ["에코그라드 호텔", "호텔 라움 순천", "순천만 스테이", "브라운도트 순천역점"]
};
const travelRegions = ["전라도 전체", "전주", "군산", "남원", "목포", "광주", "순천", "여수", "보성", "완도"];

const form = document.querySelector("#travel-guide-form");
const regionInput = document.querySelector("#travel-region");
const regionField = document.querySelector("#travel-region-field");
const regionPicker = document.querySelector("#travel-region-picker");
const regionToggle = document.querySelector("#travel-region-toggle");
const startInput = document.querySelector("#travel-start");
const endInput = document.querySelector("#travel-end");
const modal = document.querySelector("#hotel-search-modal");
const hotelQuery = document.querySelector("#hotel-search-query");
const selectedHotel = document.querySelector("#selected-hotel");
const guideContent = document.querySelector("#travel-guide-content");
const guideStatus = document.querySelector("#travel-guide-status");
const submitButton = form.querySelector(".travel-guide-submit");
const calendarModal = document.querySelector("#travel-calendar-modal");
const calendarMonths = document.querySelector("#travel-calendar-months");
const calendarApply = document.querySelector("#travel-calendar-apply");
let currentHotel = "";
let currentGuide = null;
let activeSpot = 0;
let hotelSearchController = null;
let hotelSearchTimer = null;
let regionSearchTimer = null;
const today = new Date();
today.setHours(0, 0, 0, 0);
let calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
let draftStart = null;
let draftEnd = null;
let dailyPlaceCounts = [];

function dateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(date) { return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`; }
function sameDate(left, right) { return left && right && dateValue(left) === dateValue(right); }

function renderCalendarMonth(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay }, () => "<span></span>").join("");
  const days = Array.from({ length: lastDate }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const maxEnd = draftStart && !draftEnd ? new Date(draftStart.getFullYear(), draftStart.getMonth(), draftStart.getDate() + 6) : null;
    const disabled = date < today || (maxEnd && date > maxEnd);
    const selectedStart = sameDate(date, draftStart);
    const selectedEnd = sameDate(date, draftEnd);
    const inRange = draftStart && draftEnd && date > draftStart && date < draftEnd;
    return `<button type="button" data-date="${dateValue(date)}" ${disabled ? "disabled" : ""} class="${selectedStart ? "is-start " : ""}${selectedEnd ? "is-end " : ""}${inRange ? "is-range" : ""}"><b>${date.getDate()}</b>${selectedStart ? "<small>출발</small>" : selectedEnd ? "<small>도착</small>" : ""}</button>`;
  }).join("");
  return `<article class="travel-calendar-month"><h3>${year}.${String(month + 1).padStart(2, "0")}</h3><div class="travel-calendar-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="travel-calendar-days">${blanks}${days}</div></article>`;
}

function renderCalendar() {
  const nextMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  calendarMonths.innerHTML = renderCalendarMonth(calendarCursor) + renderCalendarMonth(nextMonth);
  calendarApply.disabled = !draftStart || !draftEnd;
  document.querySelector("#travel-calendar-prev").disabled = calendarCursor <= new Date(today.getFullYear(), today.getMonth(), 1);
}

function openCalendar() {
  draftStart = startInput.value ? new Date(`${startInput.value}T00:00:00`) : null;
  draftEnd = endInput.value ? new Date(`${endInput.value}T00:00:00`) : null;
  calendarCursor = draftStart ? new Date(draftStart.getFullYear(), draftStart.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  renderCalendar(); calendarModal.hidden = false; positionCalendar();
}

function renderDailyPlaceCounts() {
  const section = document.querySelector("#travel-daily-counts");
  if (!startInput.value || !endInput.value) { section.hidden = true; return; }
  const days = Math.max(1, Math.min(7, Math.round((new Date(`${endInput.value}T00:00:00`) - new Date(`${startInput.value}T00:00:00`)) / 86400000) + 1));
  dailyPlaceCounts = Array.from({ length: days }, (_, index) => dailyPlaceCounts[index] || 3);
  document.querySelector("#travel-daily-count-list").innerHTML = dailyPlaceCounts.map((count, index) => {
    return `<article><b>DAY ${index + 1}</b><div><button type="button" data-count-action="minus" data-day="${index}" ${count <= 1 ? "disabled" : ""} aria-label="DAY ${index + 1} 관광지 줄이기">−</button><strong>${count}</strong><button type="button" data-count-action="plus" data-day="${index}" ${count >= 5 ? "disabled" : ""} aria-label="DAY ${index + 1} 관광지 늘리기">＋</button></div></article>`;
  }).join("");
  section.hidden = false;
}

document.querySelector("#travel-daily-count-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-count-action]"); if (!button) return;
  const index = Number(button.dataset.day);
  dailyPlaceCounts[index] = Math.max(1, Math.min(5, dailyPlaceCounts[index] + (button.dataset.countAction === "plus" ? 1 : -1)));
  renderDailyPlaceCounts();
});

function positionCalendar() {
  if (calendarModal.hidden) return;
  const trigger = document.querySelector("#travel-date-open");
  const dialog = calendarModal.querySelector(".travel-calendar-dialog");
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(760, window.innerWidth - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const spaceBelow = window.innerHeight - rect.bottom;
  dialog.style.width = `${width}px`;
  dialog.style.left = `${left}px`;
  dialog.style.top = spaceBelow > 480 ? `${rect.bottom + 8}px` : `${Math.max(12, rect.top - Math.min(560, window.innerHeight - 24) - 8)}px`;
}

document.querySelector("#travel-date-open").addEventListener("click", openCalendar);
document.querySelector("#travel-calendar-close").addEventListener("click", () => { calendarModal.hidden = true; });
calendarModal.addEventListener("click", (event) => { if (event.target === calendarModal) calendarModal.hidden = true; });
document.querySelector("#travel-calendar-prev").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
document.querySelector("#travel-calendar-next").addEventListener("click", () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });
calendarMonths.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]"); if (!button || button.disabled) return;
  const selected = new Date(`${button.dataset.date}T00:00:00`);
  if (!draftStart || draftEnd || selected <= draftStart) { draftStart = selected; draftEnd = null; } else draftEnd = selected;
  renderCalendar();
});
calendarApply.addEventListener("click", () => {
  startInput.value = dateValue(draftStart); endInput.value = dateValue(draftEnd);
  const nights = Math.round((draftEnd - draftStart) / 86400000);
  document.querySelector("#travel-date-summary").innerHTML = `<span class="travel-date-value">${shortDate(draftStart)}</span><i>→</i><span class="travel-date-value">${shortDate(draftEnd)}</span><em>${nights}박</em>`;
  renderDailyPlaceCounts();
  calendarModal.hidden = true;
});
window.addEventListener("resize", positionCalendar);
window.addEventListener("scroll", positionCalendar, true);
document.addEventListener("pointerdown", (event) => {
  if (!calendarModal.hidden && !calendarModal.querySelector(".travel-calendar-dialog").contains(event.target) && !document.querySelector("#travel-date-open").contains(event.target)) calendarModal.hidden = true;
});

function renderRegionOptions(regions = travelRegions) {
  document.querySelector("#travel-region-options").innerHTML = regions.length
    ? regions.map((region) => `<button type="button" data-region="${region === "전라도 전체" ? "" : region}"><span>${region}</span></button>`).join("")
    : '<p class="travel-region-empty">일치하는 지역이 없어요.</p>';
  syncSelectedRegion();
}

renderRegionOptions();

function setRegionPicker(open) {
  regionPicker.hidden = !open;
  regionField.classList.toggle("is-open", open);
  regionInput.setAttribute("aria-expanded", String(open));
  regionToggle.setAttribute("aria-label", open ? "지역 선택 닫기" : "지역 선택 열기");
}

function syncSelectedRegion() {
  regionField.querySelectorAll("[data-region]").forEach((button) => {
    const selected = button.dataset.region === regionInput.value.trim();
    button.classList.toggle("is-selected", selected);
    const check = button.querySelector("i[data-check]");
    if (selected && button.dataset.region && !check) button.insertAdjacentHTML("beforeend", '<i data-check>✓</i>');
    if (!selected && check) check.remove();
  });
}

regionInput.addEventListener("focus", () => setRegionPicker(true));
regionInput.addEventListener("click", () => setRegionPicker(true));
regionInput.addEventListener("input", () => {
  clearTimeout(regionSearchTimer);
  setRegionPicker(true);
  document.querySelector("#travel-region-options").innerHTML = '<div class="hotel-search-loading" role="status" aria-label="지역 검색 중"><i aria-hidden="true"></i></div>';
  regionSearchTimer = setTimeout(() => {
    const query = regionInput.value.trim();
    renderRegionOptions(travelRegions.filter((item) => !query || item.includes(query)));
  }, 1000);
});
regionToggle.addEventListener("click", () => setRegionPicker(regionPicker.hidden));
regionPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-region]");
  if (!button) return;
  regionInput.value = button.dataset.region;
  syncSelectedRegion();
  setRegionPicker(false);
});
document.addEventListener("pointerdown", (event) => { if (!regionField.contains(event.target)) setRegionPicker(false); });

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function minutesLabel(minutes) {
  const value = Number(minutes) || 60;
  return value >= 60 ? `${Math.floor(value / 60)}시간${value % 60 ? ` ${value % 60}분` : ""}` : `${value}분`;
}

function fallbackHotels(query) {
  return Object.entries(hotelSuggestions).flatMap(([region, names]) => names.map((name) => ({ region, name, address: `${region} 추천 숙소` })))
    .filter(({ name, region }) => !query || name.includes(query) || region.includes(query));
}

function renderHotelResults(hotels, query, notice = "") {
  const custom = query ? `<button type="button" data-hotel="${escapeHtml(query)}" data-region="${escapeHtml(regionInput.value.trim())}"><span>⌕</span><span><b>‘${escapeHtml(query)}’ 직접 입력</b><small>입력한 숙소명으로 여행 코스를 만들어요</small></span><strong>→</strong></button>` : "";
  const suggestions = hotels.map(({ region = "", name, address = "" }) => `<button type="button" data-hotel="${escapeHtml(name)}" data-region="${escapeHtml(region)}"><span>⌂</span><span><b>${escapeHtml(name)}</b><small>${escapeHtml(address || `${region} 숙소`)}</small></span><strong>→</strong></button>`).join("");
  document.querySelector("#hotel-results-list").innerHTML = `${notice ? `<p class="hotel-search-empty">${escapeHtml(notice)}</p>` : ""}${custom}${suggestions}` || '<p class="hotel-search-empty">검색된 숙소가 없어요.</p>';
}

function renderHotels() {
  const query = hotelQuery.value.trim();
  clearTimeout(hotelSearchTimer);
  hotelSearchController?.abort();
  if (!query) { renderHotelResults(fallbackHotels(""), ""); return; }
  document.querySelector("#hotel-results-list").innerHTML = '<div class="hotel-search-loading" role="status" aria-label="숙소 검색 중"><i aria-hidden="true"></i></div>';
  hotelSearchTimer = setTimeout(async () => {
    hotelSearchController = new AbortController();
    try {
      const params = new URLSearchParams({ q: query, region: regionInput.value.trim() });
      const response = await fetch(`/api/hotels/search?${params}`, { signal: hotelSearchController.signal, headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "숙소를 검색하지 못했습니다.");
      renderHotelResults(data.hotels || [], query);
    } catch (error) {
      if (error.name === "AbortError") return;
      renderHotelResults(fallbackHotels(query), query, "실시간 검색에 연결하지 못해 추천 목록을 보여드려요.");
    }
  }, 1000);
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const themes = [...form.querySelectorAll('input[name="themes"]:checked')].map((input) => input.value);
  sessionStorage.setItem("travelGuideConditions", JSON.stringify({
    region: regionInput.value.trim(), hotel: currentHotel, start: startInput.value, end: endInput.value, themes,
    dailyPlaceCounts,
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
hotelQuery.addEventListener("input", () => { renderHotels(); });
document.querySelector("#hotel-results-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-hotel]"); if (!button) return;
  currentHotel = button.dataset.hotel; selectedHotel.textContent = currentHotel;
  if (!regionInput.value.trim() && button.dataset.region) regionInput.value = button.dataset.region;
  currentGuide = null; modal.hidden = true;
});
document.querySelector("#save-guide").addEventListener("click", (event) => { event.currentTarget.textContent = event.currentTarget.textContent.includes("저장됨") ? "♡ 일정 저장" : "♥ 저장됨"; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (!modal.hidden) modal.hidden = true; if (!calendarModal.hidden) calendarModal.hidden = true; setRegionPicker(false); } });
