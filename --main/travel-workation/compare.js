const { request, escapeHtml, comparedJobs, wireBookmarkButton, renderCompareTray, showToast } = Workation;
const grid = document.querySelector("#compare-grid");
const status = document.querySelector("#compare-status");
const labels = [
  ["companyName", "사업장"], ["region", "지역"], ["location", "근무 위치"],
  ["pay", "급여"], ["workType", "근무 방식"], ["workTime", "근무 시간"],
  ["duration", "근무 기간"], ["category", "업무 분야"], ["rating", "평점"]
];

function removeJob(id) {
  localStorage.setItem("comparedJobs", JSON.stringify(comparedJobs().filter((job) => Number(job.id) !== Number(id))));
  renderCompareTray();
  loadComparison();
}

function render(jobs) {
  if (!jobs.length) {
    grid.hidden = false;
    grid.innerHTML = '<div class="compare-empty"><strong>비교할 일자리를 담아주세요</strong><p>공고 카드의 비교 버튼을 누르면 최대 3개까지 나란히 볼 수 있어요.</p><a class="button button-primary" href="map.html?view=search">일자리 찾기</a></div>';
    status.textContent = "";
    status.className = "page-status";
    return;
  }
  grid.hidden = false;
  grid.innerHTML = `<div class="compare-table" style="--compare-count:${jobs.length}">
    <div class="compare-label compare-heading">비교 항목</div>
    ${jobs.map((job) => `<article class="compare-job-heading"><button class="icon-action" type="button" data-remove-job="${job.id}" title="비교에서 제거">×</button><span>${escapeHtml(job.region)}</span><h2>${escapeHtml(job.title)}</h2><p>${escapeHtml(job.companyName || "지역 사업장")}</p><div><button class="icon-action" type="button" data-compare-bookmark="${job.id}" aria-pressed="false"><span data-bookmark-icon>♡</span><span data-bookmark-label>찜</span></button><a class="button button-small" href="job-detail.html?id=${job.id}">공고 보기</a></div></article>`).join("")}
    ${labels.map(([key, label]) => `<div class="compare-label">${label}</div>${jobs.map((job) => `<div class="compare-value">${key === "rating" && job[key] ? `${Number(job[key]).toFixed(1)}점` : escapeHtml(job[key] || "협의 후 결정")}</div>`).join("")}`).join("")}
    <div class="compare-label">일정 관리</div>${jobs.map((job) => `<div class="compare-value"><a class="button button-small" href="planner.html?itemType=job&itemId=${job.id}">일정에 추가</a></div>`).join("")}
  </div>`;
  status.textContent = "";
  status.className = "page-status";
  grid.querySelectorAll("[data-remove-job]").forEach((button) => button.addEventListener("click", () => removeJob(button.dataset.removeJob)));
  grid.querySelectorAll("[data-compare-bookmark]").forEach((button) => wireBookmarkButton(button, "job", Number(button.dataset.compareBookmark)));
}

async function loadComparison() {
  const selected = comparedJobs();
  try {
    const jobs = (await Promise.all(selected.map((job) => request(`/api/jobs/${job.id}`).catch(() => null)))).filter(Boolean);
    render(jobs);
  } catch (error) {
    status.textContent = error.message;
    status.className = "page-status is-visible is-error";
  }
}

document.addEventListener("job-compare-change", loadComparison);
loadComparison();
