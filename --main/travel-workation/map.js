const state = { region: "", reviews: [] };
const { request, escapeHtml } = Workation;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function setStatus(message = "", type = "") {
  const status = $("#map-jobs-status");
  status.textContent = message;
  status.className = `jobs-status${message ? " is-visible" : ""}${type ? ` is-${type}` : ""}`;
}

function renderJobs(jobs) {
  $("#map-result-region").textContent = state.region;
  $("#map-result-count").textContent = jobs.length;

  if (!jobs.length) {
    $("#map-job-list").innerHTML = "";
    setStatus(`${state.region}에 등록된 일자리가 없습니다.`, "empty");
    return;
  }

  setStatus();
  $("#map-job-list").innerHTML = jobs.map((job) => `
    <article class="map-job-item">
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
        ${job.detailUrl
          ? `<a class="detail-link" href="${escapeHtml(job.detailUrl)}">공고 보기</a>`
          : `<strong>${escapeHtml(job.pay || "급여 정보 없음")}</strong>`}
      </footer>
    </article>
  `).join("");
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
      <div><strong>${escapeHtml(review.username)}</strong><span>${escapeHtml(review.concept || "여행 이야기")}</span></div>
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

$$("[data-region]").forEach((button) => {
  button.addEventListener("click", () => selectRegion(button.dataset.region));
});

$("#region-review-button").addEventListener("click", renderReviews);
