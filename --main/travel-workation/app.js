const state = {
  duration: "당일",
  workType: "원격 근무",
  region: "",
  time: "오전",
  tripStart: "",
  tripEnd: ""
};

const { request, escapeHtml } = Workation;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const jobGrid = $("#job-grid");
const jobsStatus = $("#jobs-status");
let recommendationRetry = 0;
let lastPreferences = null;

function showStatus(message = "", type = "") {
  jobsStatus.textContent = message;
  jobsStatus.className = `jobs-status${message ? " is-visible" : ""}${type ? ` is-${type}` : ""}`;
}

function updateSummary() {
  $("#summary-region-name").textContent = state.region || "희망 지역";
  $("#summary-region-copy").textContent = state.region
    ? "에서 찾는 일자리"
    : "을 선택해 주세요";
  $("#summary-tags").innerHTML = [getDateRangeLabel(), state.workType, state.time]
    .map((value) => `<span>${value}</span>`)
    .join("");
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value) {
  const [, month, day] = value.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

function getDateRangeLabel() {
  if (!state.tripStart || !state.tripEnd) return state.duration;
  if (state.tripStart === state.tripEnd) return `${formatShortDate(state.tripStart)} 당일`;
  return `${formatShortDate(state.tripStart)} → ${formatShortDate(state.tripEnd)}`;
}

function syncTravelDates() {
  const startInput = $("#trip-start");
  const endInput = $("#trip-end");
  if (!startInput.value || !endInput.value) return;

  if (endInput.value < startInput.value) endInput.value = startInput.value;
  endInput.min = startInput.value;
  state.tripStart = startInput.value;
  state.tripEnd = endInput.value;

  const start = new Date(`${state.tripStart}T00:00:00`);
  const end = new Date(`${state.tripEnd}T00:00:00`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  state.duration = days === 1 ? "당일" : days <= 7 ? "1주" : "1개월";
  $("#date-range-hint").textContent = `${days}일 일정 · 일자리 검색 기준 ${state.duration}`;
  updateSummary();
}

function selectRegion(region) {
  state.region = region;
  $$('[data-group="region"] .choice[data-value], .map-pin').forEach((button) => {
    const active = (button.dataset.value || button.dataset.region) === region;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", active);
  });
  updateSummary();

  const summary = $(".selection-summary");
  summary.classList.remove("is-region-active");
  void summary.offsetWidth;
  summary.classList.add("is-region-active");
}

function syncCondition(name, value) {
  state[name] = value;
  $$(`[data-group="${name}"] .choice[data-value]`).forEach((button) => {
    const active = button.dataset.value === value;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", active);
  });

  updateSummary();
}

function safeImageUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, location.href);
    return ["http:", "https:", "file:"].includes(url.protocol) ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
}

function setDataStatus(element, message = "", type = "") {
  element.textContent = message;
  element.className = `data-status${message ? " is-visible" : ""}${type ? ` is-${type}` : ""}`;
}

function setTravelMode(mode) {
  $("#trending-panel").hidden = mode !== "trending";
  $("#course-panel").hidden = mode !== "custom";
  $$("[data-travel-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.travelMode === mode);
  });
}

function renderDestinations(destinations) {
  const status = $("#destination-status");
  const grid = $("#destination-grid");

  if (!destinations.length) {
    grid.innerHTML = "";
    setDataStatus(status, "등록된 관광지 데이터가 없습니다.", "empty");
    return;
  }

  setDataStatus(status);
  grid.innerHTML = destinations.map((destination, index) => {
    const imageUrl = safeImageUrl(destination.imageUrl);
    const rating = destination.rating == null
      ? "평점 없음"
      : `평점 ${Number(destination.rating).toFixed(1)}`;
    return `
      <article class="destination-card${imageUrl ? " has-image" : ""}">
        ${imageUrl ? `<img src="${imageUrl}" alt="">` : ""}
        <span class="destination-rank">${index + 1}위</span>
        <h3>${escapeHtml(destination.name)}</h3>
        <p>${escapeHtml(destination.description || `${destination.region}의 등록 관광지`)}</p>
        <div class="destination-meta">
          <span>${escapeHtml(destination.region)} · ${escapeHtml(destination.category || "관광")}</span>
          <span>검색 ${Number(destination.searchVolume || 0).toLocaleString("ko-KR")} · ${rating}</span>
        </div>
      </article>
    `;
  }).join("");
}

async function loadTrendingDestinations() {
  const status = $("#destination-status");
  setDataStatus(status, "관광지 데이터를 불러오는 중입니다.");

  try {
    const data = await request("/api/destinations/trending?limit=6");
    renderDestinations(Array.isArray(data) ? data : data.destinations ?? []);
  } catch {
    $("#destination-grid").innerHTML = "";
    setDataStatus(status, "관광지 데이터 서버와 연결되지 않았습니다.", "error");
  }
}

function renderPreferenceResults(data) {
  const status = $("#preference-status");
  const results = $("#preference-results");
  const destinations = data.destinations || [];
  $("#generated-prompt").textContent = data.prompt || "";
  $("#generated-prompt").hidden = !data.prompt;
  $("#recommend-actions").hidden = false;

  if (!destinations.length) {
    results.innerHTML = "";
    setDataStatus(status, "선택한 조건에 맞는 등록 관광지가 없습니다.", "empty");
  } else {
    setDataStatus(status);
    results.innerHTML = destinations.map((destination) => `
      <article class="preference-result">
        <div>
          <span>${escapeHtml(destination.region)} · ${escapeHtml(destination.category || "관광")}</span>
          <h4>${escapeHtml(destination.name)}</h4>
          <p>${escapeHtml(destination.description || "등록된 관광지 설명이 없습니다.")}</p>
        </div>
        <strong>${destination.rating == null ? "평점 없음" : Number(destination.rating).toFixed(1)}</strong>
      </article>
    `).join("");
  }

  const exhausted = recommendationRetry >= 2;
  $("#retry-recommendation").hidden = exhausted;
  $("#reset-preferences").hidden = !exhausted;
}

function collectPreferences() {
  const form = $("#preference-form");
  const values = new FormData(form);
  return {
    region: values.get("region") || "",
    themes: values.getAll("themes"),
    transports: values.getAll("transports"),
    companions: values.getAll("companions")
  };
}

async function requestPreferenceRecommendation(preferences, retry = 0) {
  const status = $("#preference-status");
  setDataStatus(status, "취향에 맞는 관광지를 찾는 중입니다.");
  $("#preference-results").innerHTML = "";

  try {
    const data = await request("/api/destinations/recommend", {
      method: "POST",
      body: JSON.stringify({ ...preferences, retry })
    });
    renderPreferenceResults(data);
  } catch (error) {
    setDataStatus(status, error.message || "추천 서버와 연결되지 않았습니다.", "error");
  }
}

async function loadRegionAnalysis(region) {
  const status = $("#analysis-status");
  const metrics = $("#analysis-metrics");
  metrics.hidden = true;
  setDataStatus(status, `${region} 지역 데이터를 불러오는 중입니다.`);

  try {
    const data = await request(`/api/regions/analysis?region=${encodeURIComponent(region)}`);

    $("#analysis-visitors").textContent = Number(data.visitorCount || 0).toLocaleString("ko-KR");
    $("#analysis-searches").textContent = Number(data.searchVolume || 0).toLocaleString("ko-KR");
    $("#analysis-stay").textContent = data.averageStayDays == null ? "데이터 없음" : `${Number(data.averageStayDays).toFixed(1)}일`;
    $("#analysis-jobs").textContent = `${Number(data.jobCount || 0).toLocaleString("ko-KR")}개`;
    setDataStatus(status);
    metrics.hidden = false;
  } catch (error) {
    setDataStatus(
      status,
      error.message || "지역 분석 서버와 연결되지 않았습니다.",
      error.status === 404 ? "empty" : "error"
    );
  }
}

async function loadStats() {
  try {
    const stats = await request("/api/stats");
    $("#region-stat").textContent = `${Number(stats.regionCount || 0)}개`;
    $("#job-stat").textContent = `${Number(stats.jobCount || 0)}개`;
    $("#rating-stat").textContent = stats.averageRating == null
      ? "평점 없음"
      : Number(stats.averageRating).toFixed(1);
  } catch {
    $("#region-stat").textContent = "-";
    $("#job-stat").textContent = "-";
    $("#rating-stat").textContent = "평점 없음";
  }
}

function renderJobs(jobs) {
  $("#jobs-region").textContent = state.region;
  $("#jobs-description").textContent = `${getDateRangeLabel()} · ${state.time} · ${state.workType} 조건의 DB 조회 결과입니다.`;
  $("#result-count").textContent = jobs.length;

  if (!jobs.length) {
    jobGrid.innerHTML = "";
    showStatus(`${state.region}에 등록된 일자리가 없습니다.`, "empty");
    return;
  }

  showStatus();
  jobGrid.innerHTML = jobs.map((job) => `
    <article class="job-card">
      <div class="job-top">
        <span class="job-category">${escapeHtml(job.category)}</span>
        <span class="job-rating${job.rating == null ? " is-empty" : ""}">
          ${job.rating == null ? "평점 없음" : `★ ${Number(job.rating).toFixed(1)}`}
        </span>
      </div>
      <h3>${escapeHtml(job.title)}</h3>
      <p class="job-company">${escapeHtml(job.companyName)}</p>
      <div class="job-meta">
        <span>${escapeHtml(job.workType)}</span>
        <span>${escapeHtml(job.workTime)}</span>
        <span>${escapeHtml(job.duration)}</span>
      </div>
      <footer>
        <span>${escapeHtml(job.location)}</span>
        ${job.detailUrl ? `<a class="detail-link" href="${escapeHtml(job.detailUrl)}">상세 보기</a>` : `<strong>${escapeHtml(job.pay)}</strong>`}
      </footer>
    </article>
  `).join("");
}

async function loadJobs(scroll = false) {
  if (!state.region) {
    showStatus("희망 지역을 먼저 선택해 주세요.", "empty");
    return;
  }

  showStatus("등록된 일자리를 불러오는 중입니다.");
  jobGrid.innerHTML = "";
  $("#result-count").textContent = "-";

  try {
    const data = await request(`/api/jobs?${new URLSearchParams(state)}`);
    renderJobs(Array.isArray(data) ? data : data.jobs ?? data.content ?? []);
  } catch {
    $("#result-count").textContent = "0";
    showStatus("서버와 연결되지 않았습니다. api 상태를 확인해 주세요.", "error");
  }

  if (scroll) $("#jobs").scrollIntoView({ behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-scroll-to], [data-travel-mode], .choice[data-value]");
  if (!control) return;

  if (control.dataset.scrollTo) {
    $(`#${control.dataset.scrollTo}`).scrollIntoView({ behavior: "smooth" });
  }
  if (control.dataset.travelMode) setTravelMode(control.dataset.travelMode);

  if (control.matches(".choice[data-value]")) {
    const name = control.closest(".choice-group").dataset.group;
    if (name === "region") selectRegion(control.dataset.value);
    else syncCondition(name, control.dataset.value);
  }
});

$("#filter-panel").addEventListener("submit", (event) => {
  event.preventDefault();
  loadJobs(true);
});

$("#trip-start").addEventListener("change", syncTravelDates);
$("#trip-end").addEventListener("change", syncTravelDates);

$("#preference-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  recommendationRetry = 0;
  lastPreferences = collectPreferences();
  await requestPreferenceRecommendation(lastPreferences, recommendationRetry);
});

$("#retry-recommendation").addEventListener("click", async () => {
  if (!lastPreferences || recommendationRetry >= 2) return;
  recommendationRetry += 1;
  await requestPreferenceRecommendation(lastPreferences, recommendationRetry);
});

$("#reset-preferences").addEventListener("click", () => {
  recommendationRetry = 0;
  lastPreferences = null;
  $("#preference-form").reset();
  $("#preference-results").innerHTML = "";
  $("#generated-prompt").hidden = true;
  $("#recommend-actions").hidden = true;
  setDataStatus($("#preference-status"), "체크박스를 선택하면 추천 결과가 여기에 표시됩니다.");
  $("#preference-form").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("#analysis-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const region = new FormData(event.currentTarget).get("region");
  if (region) loadRegionAnalysis(region);
});

const today = formatDateInput(new Date());
$("#trip-start").value = today;
$("#trip-end").value = today;
syncTravelDates();
loadStats();
loadTrendingDestinations();

const storedUsername = sessionStorage.getItem("username");
if (storedUsername) {
  const loginLink = document.querySelector('.site-header a[href="auth.html"]');
  loginLink.textContent = storedUsername;
  loginLink.href = "local-fit.html";
}
