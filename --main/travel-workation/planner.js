const { request, escapeHtml, setStatus, showToast } = Workation;
const form = document.querySelector("#planner-form");
const status = document.querySelector("#planner-status");
const routeDate = document.querySelector("#route-date");
let entries = [];
let sources = [];
const regionCoordinates = {
  전주: [35.8242, 127.1480], 군산: [35.9677, 126.7366], 남원: [35.4164, 127.3904],
  목포: [34.8118, 126.3922], 광주: [35.1595, 126.8526], 순천: [34.9506, 127.4872],
  여수: [34.7604, 127.6622], 보성: [34.7715, 127.0801], 완도: [34.3108, 126.7551]
};

function today() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatDay(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

function sourceKey(itemType, itemId) { return `${itemType}:${itemId}`; }

function buildSources(applications, bookmarks) {
  const map = new Map();
  applications.forEach(({ job }) => map.set(sourceKey("job", job.id), { itemType: "job", itemId: job.id, title: job.title, subtitle: `${job.region} · 지원 공고` }));
  bookmarks.forEach((item) => map.set(sourceKey(item.itemType, item.itemId), { itemType: item.itemType, itemId: item.itemId, title: item.title, subtitle: item.subtitle }));
  sources = [...map.values()];
  form.elements.source.innerHTML = sources.length
    ? sources.map((item) => `<option value="${item.itemType}:${item.itemId}">${item.itemType === "job" ? "일자리" : item.itemType === "destination" ? "관광지" : "여행 기록"} · ${escapeHtml(item.title)}</option>`).join("")
    : '<option value="">추가할 수 있는 항목이 없어요</option>';
  form.querySelector("button").disabled = !sources.length;
  const query = new URLSearchParams(location.search);
  const requested = sourceKey(query.get("itemType"), query.get("itemId"));
  if ([...form.elements.source.options].some((option) => option.value === requested)) form.elements.source.value = requested;
}

function renderSummary() {
  const grouped = Object.groupBy(entries, (entry) => entry.eventDate);
  const dates = Object.keys(grouped).sort();
  document.querySelector("#planner-date-summary").innerHTML = dates.length
    ? dates.map((date) => `<button type="button" data-jump-date="${date}"><span>${formatDay(date)}</span><strong>${grouped[date].length}개 일정</strong></button>`).join("")
    : '<p>아직 저장된 일정이 없어요.</p>';
  const selected = dates.includes(routeDate.value) ? routeDate.value : dates[0] || "";
  routeDate.innerHTML = dates.length ? dates.map((date) => `<option value="${date}">${formatDay(date)}</option>`).join("") : '<option value="">날짜 없음</option>';
  routeDate.value = selected;
}

function entryPayload(entry, overrides = {}) {
  return {
    eventDate: entry.eventDate,
    startTime: entry.startTime,
    endTime: entry.endTime,
    note: entry.note,
    routeOrder: entry.routeOrder,
    ...overrides
  };
}

function routeSegment(from, to) {
  const start = regionCoordinates[from.region];
  const end = regionCoordinates[to.region];
  if (!start || !end) return "이동";
  const radians = (value) => value * Math.PI / 180;
  const lat = radians(end[0] - start[0]);
  const lon = radians(end[1] - start[1]);
  const value = Math.sin(lat / 2) ** 2 + Math.cos(radians(start[0])) * Math.cos(radians(end[0])) * Math.sin(lon / 2) ** 2;
  const distance = Math.max(1, Math.round(6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))));
  const minutes = Math.max(10, Math.round(distance / 45 * 60 / 5) * 5);
  return from.region === to.region ? "지역 내 약 15분" : `약 ${distance}km · ${minutes}분`;
}

function renderRoute() {
  const dateEntries = entries.filter((entry) => entry.eventDate === routeDate.value).sort((a, b) => a.routeOrder - b.routeOrder || a.id - b.id);
  document.querySelector("#planner-route").innerHTML = dateEntries.length ? `<div class="planner-route-line">${dateEntries.map((entry, index) => `<div><span>${index + 1}</span><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.region || "지역 미정")} ${entry.startTime ? `· ${entry.startTime}` : ""}</small></div>${dateEntries[index + 1] ? `<i aria-label="${routeSegment(entry, dateEntries[index + 1])}"><b aria-hidden="true">→</b><small>${routeSegment(entry, dateEntries[index + 1])}</small></i>` : ""}`).join("")}</div><p>직선거리 기반 예상 이동시간입니다. 아래 화살표로 방문 순서를 바꿀 수 있어요.</p>` : '<p class="planner-route-empty">선택한 날짜에 저장된 동선이 없어요.</p>';
}

function renderList() {
  const grouped = Object.groupBy(entries, (entry) => entry.eventDate);
  const dates = Object.keys(grouped).sort();
  document.querySelector("#planner-list").innerHTML = dates.length ? dates.map((date) => `<section class="planner-day" id="planner-day-${date}"><div class="planner-day-heading"><h3>${formatDay(date)}</h3><span>${grouped[date].length}개 일정</span></div>${grouped[date].sort((a, b) => a.routeOrder - b.routeOrder || a.id - b.id).map((entry, index) => `<article class="planner-entry" data-entry-id="${entry.id}">
    <div class="planner-entry-order"><strong>${index + 1}</strong><div><button type="button" data-move="up" title="앞 순서로 이동">↑</button><button type="button" data-move="down" title="뒤 순서로 이동">↓</button></div></div>
    <div class="planner-entry-main"><span>${entry.itemType === "job" ? "일자리" : entry.itemType === "destination" ? "관광지" : "여행 기록"} · ${escapeHtml(entry.region || "지역 미정")}</span><h4>${escapeHtml(entry.title)}</h4><a href="${escapeHtml(entry.link)}">상세 보기 →</a></div>
    <form class="planner-entry-form"><label>날짜<input name="eventDate" type="date" value="${entry.eventDate}" required></label><label>시작<input name="startTime" type="time" value="${entry.startTime}"></label><label>종료<input name="endTime" type="time" value="${entry.endTime}"></label><label class="planner-note">메모<input name="note" maxlength="300" value="${escapeHtml(entry.note)}"></label><button class="button button-small" type="submit">저장</button><button class="icon-action" type="button" data-delete-entry title="일정 삭제">×</button></form>
  </article>`).join("")}</section>`).join("") : '<div class="planner-empty"><strong>첫 일정을 추가해 보세요</strong><p>지원한 일자리와 찜한 관광지를 한 일정에서 관리할 수 있어요.</p></div>';
}

function renderAll() { renderSummary(); renderRoute(); renderList(); }

async function loadPlanner() {
  if (!sessionStorage.getItem("accessToken")) {
    location.replace(`auth.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
    return;
  }
  try {
    const query = new URLSearchParams(location.search);
    const requestedType = query.get("itemType");
    const requestedId = query.get("itemId");
    const requestedPromise = requestedType && requestedId
      ? request(`/api/items/${requestedType}/${requestedId}`).catch(() => null)
      : Promise.resolve(null);
    const [applications, bookmarks, plannerEntries, requestedItem] = await Promise.all([request("/api/me/applications"), request("/api/me/bookmarks"), request("/api/me/planner"), requestedPromise]);
    const sourceBookmarks = requestedItem && !bookmarks.some((item) => item.itemType === requestedItem.itemType && Number(item.itemId) === Number(requestedItem.itemId))
      ? [...bookmarks, requestedItem]
      : bookmarks;
    buildSources(applications, sourceBookmarks);
    entries = plannerEntries;
    renderAll();
    document.querySelector("#planner-workspace").hidden = false;
    setStatus(status);
  } catch (error) { setStatus(status, error.message, "error"); }
}

form.elements.eventDate.value = today();
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const [itemType, itemId] = form.elements.source.value.split(":");
  try {
    const result = await request("/api/me/planner", { method: "POST", body: JSON.stringify({ itemType, itemId: Number(itemId), eventDate: form.elements.eventDate.value, startTime: form.elements.startTime.value, endTime: form.elements.endTime.value, note: form.elements.note.value }) });
    showToast(result.message);
    form.elements.note.value = "";
    await loadPlanner();
  } catch (error) { showToast(error.message); }
});

routeDate.addEventListener("change", renderRoute);
document.querySelector("#planner-date-summary").addEventListener("click", (event) => {
  const button = event.target.closest("[data-jump-date]");
  if (!button) return;
  document.querySelector(`#planner-day-${button.dataset.jumpDate}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#planner-list").addEventListener("submit", async (event) => {
  const entryElement = event.target.closest("[data-entry-id]");
  if (!entryElement) return;
  event.preventDefault();
  const entry = entries.find((item) => item.id === Number(entryElement.dataset.entryId));
  const values = Object.fromEntries(new FormData(event.target));
  try {
    const result = await request(`/api/me/planner/${entry.id}`, { method: "PATCH", body: JSON.stringify(entryPayload(entry, values)) });
    showToast(result.message);
    await loadPlanner();
  } catch (error) { showToast(error.message); }
});

document.querySelector("#planner-list").addEventListener("click", async (event) => {
  const entryElement = event.target.closest("[data-entry-id]");
  if (!entryElement) return;
  const entry = entries.find((item) => item.id === Number(entryElement.dataset.entryId));
  if (event.target.closest("[data-delete-entry]")) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    try { await request(`/api/me/planner/${entry.id}`, { method: "DELETE" }); await loadPlanner(); } catch (error) { showToast(error.message); }
    return;
  }
  const moveButton = event.target.closest("[data-move]");
  if (!moveButton) return;
  const sameDay = entries.filter((item) => item.eventDate === entry.eventDate).sort((a, b) => a.routeOrder - b.routeOrder || a.id - b.id);
  const index = sameDay.findIndex((item) => item.id === entry.id);
  const target = sameDay[index + (moveButton.dataset.move === "up" ? -1 : 1)];
  if (!target) return;
  try {
    await Promise.all([
      request(`/api/me/planner/${entry.id}`, { method: "PATCH", body: JSON.stringify(entryPayload(entry, { routeOrder: target.routeOrder })) }),
      request(`/api/me/planner/${target.id}`, { method: "PATCH", body: JSON.stringify(entryPayload(target, { routeOrder: entry.routeOrder })) })
    ]);
    await loadPlanner();
  } catch (error) { showToast(error.message); }
});

loadPlanner();
