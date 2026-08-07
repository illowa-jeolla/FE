const state = { region: "", reviews: [] };
const { request, escapeHtml } = Workation;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const jobPhotos = ["assets/J6aHjc.jpeg", "assets/JvLTt.jpeg", "assets/lX3GW.jpeg", "assets/OZ3bs.jpeg", "assets/s6jB4w.jpeg", "assets/u3OD9c.jpeg", "assets/wt960.jpeg", "assets/y0SxMq.jpeg"];

function jobPhoto(job) {
  return jobPhotos[Math.abs(Number(job.id) || 0) % jobPhotos.length];
}

function normalizeJobs(data) {
  return Array.isArray(data) ? data : data.jobs ?? data.content ?? [];
}

function setStatus(message = "", type = "") {
  const status = $("#map-jobs-status");
  status.textContent = message;
  status.className = `jobs-status${message ? " is-visible" : ""}${type ? ` is-${type}` : ""}`;
}

function renderJobs(jobs) {
  $("#map-result-region").textContent = state.region || "전체";
  $("#map-result-count").textContent = jobs.length;

  if (!jobs.length) {
    $("#map-job-list").innerHTML = "";
    setStatus(`${state.region}에 등록된 일자리가 없습니다.`, "empty");
    return;
  }

  setStatus();
  $("#map-job-list").innerHTML = jobs.map((job) => `
    <a class="map-job-item" href="job-detail.html?id=${job.id}">
      <img class="map-job-photo" src="${jobPhoto(job)}" alt="${escapeHtml(job.region || "지역")} 일자리 현장">
      <div>
        <span>${escapeHtml(job.category || "관광 일자리")}</span>
        <h3>${escapeHtml(job.title)}</h3>
        <p>${escapeHtml(job.companyName || "")}</p>
      </div>
      <div class="job-meta">
        <span>${escapeHtml(job.workType || "근무 방식 협의")}</span>
        <span>${escapeHtml(job.workTime || "시간 협의")}</span>
        <span>${escapeHtml(job.duration || "기간 협의")}</span>
      </div>
      <footer>
        <span>${escapeHtml(job.location || state.region)}</span>
        <strong>${escapeHtml(job.pay || "급여 정보 없음")}</strong><b>상세 보기 →</b>
      </footer>
    </a>
  `).join("");
}

async function searchJobs(form = null) {
  state.region = form?.elements.region.value || "";
  $("#map-job-list").innerHTML = "";
  $("#map-result-count").textContent = "-";
  setStatus("등록된 일자리를 검색하고 있습니다.");
  const query = new URLSearchParams();
  if (form) {
    if (form.elements.region.value) query.set("region", form.elements.region.value);
    if (form.elements.workType.value) query.set("workType", form.elements.workType.value);
    if (form.elements.time.value) query.set("time", form.elements.time.value);
  }
  try {
    const queryString = query.toString();
    renderJobs(normalizeJobs(await request(`/api/jobs${queryString ? `?${queryString}` : ""}`)));
  } catch (error) {
    setStatus(error.message || "일자리 목록을 불러오지 못했습니다.", "error");
  }
}

function changeJobView(view) {
  const searchMode = view === "search";
  document.body.classList.toggle("is-job-search-mode", searchMode);
  $(".region-summary-panel").hidden = searchMode;
  $(".job-search-panel").hidden = !searchMode;
  $(".map-canvas-panel").hidden = searchMode;
  $$('[data-job-view]').forEach((button) => {
    const active = button.dataset.jobView === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active);
  });
  if (searchMode) searchJobs($("#map-job-search-form"));
}

function renderRegionSummary(summary) {
  const rating = Number(summary.averageRating);
  const reviewCount = Number(summary.reviewCount);
  $("#region-summary-copy").textContent = summary.destinationCount
    ? `${summary.region}에 등록된 관광지 ${summary.destinationCount}곳의 평가와 여행 이야기를 모았어요.`
    : `${summary.region}의 관광지 정보와 여행 이야기를 확인해 보세요.`;
  $("#region-rating").textContent = `★ ${Number.isFinite(rating) ? rating.toFixed(1) : "0.0"}`;
  $("#region-review-count").textContent = `${Number.isFinite(reviewCount) ? reviewCount : 0}개`;
  $("#region-summary-metrics").hidden = false;
  state.reviews = summary.reviews || [];
  $("#region-review-list").hidden = true;
  $("#region-review-list").innerHTML = "";
  const reviewButton = $("#region-review-button");
  reviewButton.hidden = false;
  reviewButton.textContent = state.reviews.length ? "리뷰 자세히 보기" : "등록된 리뷰 없음";
  reviewButton.disabled = !state.reviews.length;
}

function renderReviews() {
  const list = $("#region-review-list");
  const opening = list.hidden;
  list.hidden = !opening;
  $("#region-review-button").textContent = opening ? "리뷰 접기" : "리뷰 자세히 보기";
  if (!opening || list.innerHTML) return;

  list.innerHTML = state.reviews.map((review) => `
    <article>
      <div><strong>${escapeHtml(review.nickname || review.username)}</strong><span>${escapeHtml(review.concept || "여행 이야기")}</span></div>
      <p>${escapeHtml(review.content)}</p>
    </article>
  `).join("");
}

async function selectRegion(region) {
  state.region = region;
  $("#selected-map-region").textContent = region;
  $("#region-summary-copy").textContent = `${region}의 관광지 정보와 여행 이야기를 불러오고 있어요.`;
  $("#region-rating").textContent = "★ 0.0";
  $("#region-review-count").textContent = "0개";
  $("#region-summary-metrics").hidden = false;
  $("#region-review-button").hidden = true;
  $("#region-review-list").hidden = true;
  $$("[data-region]").forEach((button) => {
    const active = button.dataset.region === region;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", active);
  });

  setStatus(`${region}의 일자리와 지역 정보를 불러오는 중입니다.`);
  $("#map-job-list").innerHTML = "";
  $("#map-result-count").textContent = "-";

  const [jobsResult, summaryResult] = await Promise.allSettled([
      request(`/api/jobs?region=${encodeURIComponent(region)}`),
      request(`/api/regions/summary?region=${encodeURIComponent(region)}`)
  ]);

  if (jobsResult.status === "fulfilled") {
    const jobs = jobsResult.value;
    renderJobs(Array.isArray(jobs) ? jobs : jobs.jobs ?? jobs.content ?? []);
  } else {
    $("#map-result-count").textContent = "0";
    setStatus(jobsResult.reason?.message || "일자리 데이터 서버와 연결되지 않았습니다.", "error");
  }

  if (summaryResult.status === "fulfilled") {
    renderRegionSummary(summaryResult.value);
  } else {
    $("#region-summary-copy").textContent = `${region}의 등록된 평가와 여행 리뷰가 아직 없어요.`;
    state.reviews = [];
  }
}

async function clearRegionSelection() {
  state.region = "";
  state.reviews = [];
  $("#selected-map-region").textContent = "선택 전";
  $("#summary-region-title").textContent = "지역을";
  $("#region-summary-copy").textContent = "지도에서 지역을 선택하면 관광지 평점과 여행자 리뷰를 확인할 수 있어요.";
  $("#region-summary-metrics").hidden = true;
  $("#region-review-button").hidden = true;
  $("#region-review-list").hidden = true;
  $$("[data-region]").forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
  setStatus("전체 지역의 일자리를 불러오는 중입니다.");
  $("#map-job-list").innerHTML = "";
  $("#map-result-count").textContent = "-";
  try {
    const jobs = normalizeJobs(await request("/api/jobs"));
    if (!state.region) renderJobs(jobs);
  } catch (error) {
    if (!state.region) setStatus(error.message || "전체 일자리 목록을 불러오지 못했습니다.", "error");
  }
}

$$("[data-region]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.region === button.dataset.region) clearRegionSelection();
    else selectRegion(button.dataset.region);
  });
});

$("#region-review-button").addEventListener("click", renderReviews);

$$('[data-job-view]').forEach((button) => {
  button.addEventListener("click", () => changeJobView(button.dataset.jobView));
});

$("#map-job-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  searchJobs(event.currentTarget);
});

$("#map-job-search-reset").addEventListener("click", () => {
  $("#map-job-search-form").reset();
  updateTripHint();
  searchJobs();
});

function updateTripHint() {
  const form = $("#map-job-search-form");
  const start = new Date(`${form.elements.tripStart.value}T00:00:00`);
  const end = new Date(`${form.elements.tripEnd.value}T00:00:00`);
  const hint = $("#map-job-date-hint");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    hint.textContent = "여행 날짜를 순서대로 선택해 주세요.";
    return;
  }
  const days = Math.round((end - start) / 86400000) + 1;
  hint.textContent = `${Math.max(0, days - 1)}박 ${days}일 일정으로 추천 결과를 좁혀 보여드려요.`;
}

$("#map-job-search-form").elements.tripStart.addEventListener("change", updateTripHint);
$("#map-job-search-form").elements.tripEnd.addEventListener("change", updateTripHint);

const initialSearch = new URLSearchParams(location.search);
if (initialSearch.get("view") === "search") {
  const form = $("#map-job-search-form");
  ["region", "workType", "time", "tripStart", "tripEnd"].forEach((name) => {
    const value = initialSearch.get(name);
    if (value && form.elements[name]) form.elements[name].value = value;
  });
  updateTripHint();
  changeJobView("search");
} else {
  clearRegionSelection();
}
