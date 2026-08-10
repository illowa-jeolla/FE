const state = { region: "", reviews: [], regionData: null, summaryView: "region", aiSummary: "", aiSummaryEnabled: false, summaryRegion: "" };
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
  state.regionData = summary;
  const rating = Number(summary.averageRating);
  const reviewCount = Number(summary.reviewCount);
  $("#region-summary-copy").textContent = summary.destinationCount
    ? `${summary.region}에 등록된 관광지 ${summary.destinationCount}곳의 평가와 여행 이야기를 모았어요.`
    : `${summary.region}의 관광지 정보와 여행 이야기를 확인해 보세요.`;
  $("#region-rating").textContent = `★ ${Number.isFinite(rating) ? rating.toFixed(1) : "0.0"}`;
  $("#region-review-count").textContent = `${Number.isFinite(reviewCount) ? reviewCount : 0}개`;
  $("#region-summary-metrics").hidden = false;
  state.reviews = summary.reviews || [];
  state.aiSummary = "";
  state.aiSummaryEnabled = false;
  state.summaryRegion = "";
  $("#region-review-list").hidden = true;
  $("#region-review-list").innerHTML = "";
  if (state.summaryView === "reviews") showReviewSummary();
}

function showRegionInfo() {
  $("#region-review-detail-button").hidden = !state.reviews.length;
  $("#region-review-detail-list").hidden = true;
  $("#region-all-reviews-button").hidden = true;
  $("#region-review-detail-button").textContent = "리뷰 보기";
  state.summaryView = "region";
  $$('[data-summary-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.summaryView === "region"));
  $("#region-panel-eyebrow").textContent = "지역 정보";
  $("#summary-region-title").textContent = state.region || "지역을";
  $("#region-review-list").hidden = true;
  if (state.regionData) renderRegionSummary(state.regionData);
  else { $("#region-summary-copy").textContent = "지도에서 지역을 선택하면 관광지 평점과 여행자 리뷰를 확인할 수 있어요."; $("#region-summary-metrics").hidden = true; }
}

async function showReviewSummary() {
  $("#region-review-detail-button").hidden = true;
  $("#region-review-detail-list").hidden = true;
  $("#region-all-reviews-button").hidden = true;
  state.summaryView = "reviews";
  $$('[data-summary-view]').forEach((button) => button.classList.toggle("is-active", button.dataset.summaryView === "reviews"));
  $("#region-panel-eyebrow").textContent = "AI 리뷰 분석";
  $("#summary-region-title").textContent = state.region || "지역을";
  $("#region-summary-copy").textContent = state.region ? `${state.region} 여행 리뷰의 공통 의견을 AI가 분석해요.` : "지도에서 지역을 먼저 선택해 주세요.";
  $("#region-summary-metrics").hidden = true;
  const list = $("#region-review-list");
  list.hidden = false;
  if (!state.region) { list.innerHTML = `<article class="ai-review-summary"><strong>지역을 선택해 주세요</strong><p>지도에서 지역을 선택하면 리뷰 분석을 시작할게요.</p></article>`; return; }
  if (!state.reviews.length) { list.innerHTML = `<article class="ai-review-summary"><strong>작성된 리뷰가 아직 없어요</strong><p>${escapeHtml(state.region)} 여행 리뷰가 등록되면 AI가 공통 의견을 요약해 드려요.</p></article>`; return; }
  if (state.aiSummary && state.summaryRegion === state.region) {
    renderAiReviewSummary();
    return;
  }
  list.innerHTML = `<article class="ai-review-summary is-loading"><div class="ai-review-loader"><i></i><i></i><i></i></div><span>AI REVIEW SUMMARY</span><strong>${escapeHtml(state.region)} 리뷰를 분석하고 있어요</strong><p>별점과 후기에서 공통으로 언급된 내용을 찾고 있습니다.</p></article>`;
  const requestedRegion = state.region;
  try {
    const result = await request(`/api/regions/review-summary?region=${encodeURIComponent(requestedRegion)}`);
    if (state.region !== requestedRegion) return;
    state.aiSummary = result.summary;
    state.aiSummaryEnabled = Boolean(result.aiEnabled);
    state.summaryRegion = requestedRegion;
    renderAiReviewSummary();
  } catch (error) {
    list.innerHTML = `<article class="ai-review-summary is-error"><strong>요약을 만들지 못했어요</strong><p>${escapeHtml(error.message)}</p></article>`;
  }
}

function renderAiReviewSummary() {
  const list = $("#region-review-list");
  list.innerHTML = `<article class="ai-review-summary"><span>${state.aiSummaryEnabled ? "AI REVIEW SUMMARY" : "REVIEW SUMMARY"}</span><strong>${escapeHtml(state.region)} 여행자들의 공통 의견</strong><p>${escapeHtml(state.aiSummary)}</p><small>${state.aiSummaryEnabled ? "작성된 리뷰를 AI가 종합한 참고용 요약이에요." : "AI 연결 전에는 별점 통계를 기준으로 기본 요약을 보여드려요."}</small></article>`;

  list.innerHTML += state.reviews.map((review) => {
    const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5)));
    const images = review.images?.length ? review.images : review.imageData ? [review.imageData] : [];
    return `<article>
      ${images.length ? `<div class="region-review-images">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="여행 리뷰 사진 ${index + 1}">`).join("")}</div>` : ""}
      <div><strong>${escapeHtml(review.nickname || review.username)}</strong><span>${escapeHtml(review.concept || "여행 이야기")}</span></div>
      <span class="region-review-stars" aria-label="별점 ${rating}점">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
      <p>${escapeHtml(review.content)}</p>
    </article>`;
  }).join("");
}

function toggleReviewDetails() {
  const list = $("#region-review-detail-list");
  const opening = list.hidden;
  list.hidden = !opening;
  $("#region-review-detail-button").textContent = opening ? "리뷰 접기" : "리뷰 보기";
  $("#region-all-reviews-button").hidden = !opening || !state.reviews.length;
  if (!opening) return;
  list.innerHTML = state.reviews.map((review) => {
    const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5)));
    const images = review.images?.length ? review.images : review.imageData ? [review.imageData] : [];
    return `<article>
      ${images.length ? `<div class="region-review-images">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="여행 리뷰 사진 ${index + 1}">`).join("")}</div>` : ""}
      <div><strong>${escapeHtml(review.nickname || review.username)}</strong><span>${escapeHtml(review.concept || "여행 이야기")}</span></div>
      <span class="region-review-stars" aria-label="별점 ${rating}점">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
      <p>${escapeHtml(review.content)}</p>
    </article>`;
  }).join("");
}

const reviewModal = $("#region-reviews-modal");
const reviewModalGrid = $("#region-reviews-grid");
const reviewModalStatus = $("#region-reviews-status");
const reviewMoreButton = $("#region-reviews-more");
const REVIEW_PAGE_SIZE = 10;
let reviewOffset = 0;
let reviewTotal = 0;
let reviewLoading = false;

function renderFullReview(review) {
  const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5)));
  const images = review.images?.length ? review.images : review.imageData ? [review.imageData] : [];
  const createdAt = review.createdAt || review.created_at;
  const date = createdAt ? new Date(`${createdAt}${String(createdAt).includes("Z") ? "" : "Z"}`).toLocaleDateString("ko-KR") : "";
  return `<article class="region-full-review-card">
    ${images.length ? `<div class="region-full-review-images">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(state.region)} 여행 리뷰 사진 ${index + 1}">`).join("")}</div>` : ""}
    <div class="region-full-review-head"><div><strong>${escapeHtml(review.nickname || review.username)}</strong><span>${escapeHtml(review.concept || "여행 이야기")}</span></div><time>${escapeHtml(date)}</time></div>
    <span class="region-review-stars" aria-label="별점 ${rating}점">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>
    <p>${escapeHtml(review.content)}</p>
  </article>`;
}

async function loadFullReviews(reset = false) {
  if (!state.region || reviewLoading) return;
  if (reset) {
    reviewOffset = 0;
    reviewTotal = 0;
    reviewModalGrid.innerHTML = "";
  }
  reviewLoading = true;
  reviewMoreButton.disabled = true;
  reviewModalStatus.textContent = reset ? "전체 리뷰를 불러오는 중입니다." : "리뷰를 더 불러오는 중입니다.";
  try {
    const result = await request(`/api/regions/reviews?region=${encodeURIComponent(state.region)}&limit=${REVIEW_PAGE_SIZE}&offset=${reviewOffset}`);
    reviewTotal = Number(result.total) || 0;
    reviewModalGrid.insertAdjacentHTML("beforeend", (result.reviews || []).map(renderFullReview).join(""));
    reviewOffset += (result.reviews || []).length;
    reviewModalStatus.textContent = reviewTotal ? `전체 ${reviewTotal}개의 여행 리뷰` : "등록된 여행 리뷰가 없습니다.";
    reviewMoreButton.hidden = !result.hasMore;
  } catch (error) {
    reviewModalStatus.textContent = error.message || "전체 리뷰를 불러오지 못했습니다.";
    reviewMoreButton.hidden = true;
  } finally {
    reviewLoading = false;
    reviewMoreButton.disabled = false;
  }
}

function openFullReviews() {
  if (!state.region) return;
  $("#region-reviews-title").textContent = `${state.region} 전체 여행 리뷰`;
  reviewModal.hidden = false;
  document.body.classList.add("region-reviews-open");
  loadFullReviews(true);
}

function closeFullReviews() {
  reviewModal.hidden = true;
  document.body.classList.remove("region-reviews-open");
}

async function selectRegion(region) {
  $("#region-review-detail-button").hidden = true;
  $("#region-review-detail-list").hidden = true;
  $("#region-all-reviews-button").hidden = true;
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
    $("#region-review-detail-button").hidden = state.summaryView !== "region" || !state.reviews.length;
  } else {
    $("#region-summary-copy").textContent = `${region}의 등록된 평가와 여행 리뷰가 아직 없어요.`;
    state.reviews = [];
  }
}

async function clearRegionSelection() {
  $("#region-review-detail-button").hidden = true;
  $("#region-review-detail-list").hidden = true;
  $("#region-all-reviews-button").hidden = true;
  state.region = "";
  state.reviews = [];
  state.aiSummary = "";
  state.aiSummaryEnabled = false;
  state.summaryRegion = "";
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

$$('[data-summary-view]').forEach((button) => button.addEventListener("click", () => button.dataset.summaryView === "reviews" ? showReviewSummary() : showRegionInfo()));
$("#region-review-detail-button").addEventListener("click", toggleReviewDetails);
$("#region-all-reviews-button").addEventListener("click", openFullReviews);
$("#region-summary-metrics").addEventListener("click", openFullReviews);
$("#region-summary-metrics").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openFullReviews(); }
});
$("#region-review-detail-list").addEventListener("click", (event) => { if (event.target.closest("article")) openFullReviews(); });
$("#region-review-list").addEventListener("click", (event) => { if (event.target.closest("article") && state.reviews.length) openFullReviews(); });
reviewMoreButton.addEventListener("click", () => loadFullReviews(false));
reviewModal.querySelectorAll("[data-region-reviews-close]").forEach((button) => button.addEventListener("click", closeFullReviews));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !reviewModal.hidden) closeFullReviews(); });

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
