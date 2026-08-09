const { request, escapeHtml, requireLogin, setStatus, wireBookmarkButton, recordRecentView, comparedJobs, toggleJobComparison } = Workation;
const $ = (selector) => document.querySelector(selector);
let currentJobId = null;
let hasApplied = false;
let currentJob = null;

function text(selector, value, fallback = "정보 확인 필요") {
  const element = $(selector);
  if (!element) return;
  element.textContent = value || fallback;
}

function showError(message) {
  const status = $("#job-detail-status");
  status.textContent = message;
  status.className = "job-detail-status is-visible is-error";
}

function renderJob(job) {
  currentJob = job;
  const region = job.region || "전라도";
  const location = job.location || region;
  const rating = Number(job.rating);
  const searchForm = $("#job-detail-search-form");
  searchForm.elements.region.value = [...searchForm.elements.region.options].some((option) => option.value === region) ? region : "";
  searchForm.elements.workType.value = [...searchForm.elements.workType.options].some((option) => option.value === job.workType) ? job.workType : "";
  const matchedTime = [...searchForm.elements.time.options].find((option) => job.workTime?.includes(option.value) && option.value);
  searchForm.elements.time.value = matchedTime?.value || "";
  text("#job-intro-title", `${job.title} · 상세 공고`);
  text("#job-insight-title", `${region} 관광권에서 경험을 쌓기 좋은 공고예요`);
  text("#job-insight-body", `${location}의 여행 동선과 연결되는 ${job.category || "관광"} 분야 일자리입니다.`);
  text("#job-hero-eyebrow", `${job.category || "관광 일자리"} · ${region} · ${location}`);
  text("#job-title", job.title);
  text("#job-company", `${job.companyName || "지역 사업장"}에서 등록한 관광 일자리 공고입니다.`);
  text("#job-pay", job.pay, "급여 협의");
  text("#job-time-metric", job.workTime, "시간 협의");
  text("#job-rating", Number.isFinite(rating) && rating > 0 ? `${rating.toFixed(1)}점` : "신규");
  text("#job-location-title", location);
  text("#job-location-copy", `${region}에서 근무하는 공고입니다. 지원 전에 정확한 집결 위치를 확인해 주세요.`);
  text("#job-map-label", location);
  text("#job-detail-duration", job.duration, "근무 기간 협의");
  text("#job-detail-worktime", job.workTime, "근무 시간 협의");

  const chips = [region, job.workType, job.duration].filter(Boolean);
  $("#job-insight-chips").innerHTML = chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("");

  $("#job-detail-status").className = "job-detail-status";
  $("#job-detail-content").hidden = false;
  requestAnimationFrame(initFixedJobSearch);
}

function updateCompareButton() {
  const button = $("#job-compare-button");
  const selected = comparedJobs().some((job) => Number(job.id) === Number(currentJobId));
  button.classList.toggle("is-saved", selected);
  button.setAttribute("aria-pressed", String(selected));
  button.querySelector("span:last-child").textContent = selected ? "비교 중" : "비교";
}

$("#job-compare-button").addEventListener("click", () => {
  if (!currentJob) return;
  toggleJobComparison(currentJob);
  updateCompareButton();
});
document.addEventListener("job-compare-change", updateCompareButton);

let fixedSearchInitialized = false;
let fixedSearchThreshold = 0;
let fixedSearchPlaceholder;

function initFixedJobSearch() {
  if (fixedSearchInitialized) return;
  const card = $(".job-criteria-card");
  fixedSearchPlaceholder = document.createElement("div");
  fixedSearchPlaceholder.className = "job-search-placeholder";
  card.before(fixedSearchPlaceholder);
  fixedSearchInitialized = true;

  const releaseCard = () => {
    card.classList.remove("is-fixed-search");
    card.style.left = "";
    card.style.width = "";
    fixedSearchPlaceholder.classList.remove("is-active");
    fixedSearchPlaceholder.style.height = "";
  };

  const measure = () => {
    releaseCard();
    const rect = card.getBoundingClientRect();
    fixedSearchThreshold = window.scrollY + rect.top - 88;
    update();
  };

  const update = () => {
    if (window.innerWidth <= 860 || window.scrollY < fixedSearchThreshold) {
      releaseCard();
      return;
    }
    if (!fixedSearchPlaceholder.classList.contains("is-active")) {
      fixedSearchPlaceholder.style.height = `${card.offsetHeight}px`;
      fixedSearchPlaceholder.classList.add("is-active");
    }
    const anchorRect = fixedSearchPlaceholder.getBoundingClientRect();
    card.style.left = `${anchorRect.left}px`;
    card.style.width = `${anchorRect.width}px`;
    card.classList.add("is-fixed-search");
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", measure);
  measure();
}

$("#job-back-button").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.href = "map.html";
});

function updateDetailTripHint() {
  const form = $("#job-detail-search-form");
  const start = new Date(`${form.elements.tripStart.value}T00:00:00`);
  const end = new Date(`${form.elements.tripEnd.value}T00:00:00`);
  const hint = $("#job-detail-date-hint");
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    hint.textContent = "여행 날짜를 순서대로 선택해 주세요.";
    return;
  }
  const days = Math.round((end - start) / 86400000) + 1;
  hint.textContent = `${Math.max(0, days - 1)}박 ${days}일 일정으로 추천 결과를 좁혀 보여드려요.`;
}

$("#job-detail-search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const query = new URLSearchParams({ view: "search" });
  ["region", "workType", "time", "tripStart", "tripEnd"].forEach((name) => {
    if (form.elements[name].value) query.set(name, form.elements[name].value);
  });
  location.href = `map.html?${query}`;
});
$("#job-detail-search-form").elements.tripStart.addEventListener("change", updateDetailTripHint);
$("#job-detail-search-form").elements.tripEnd.addEventListener("change", updateDetailTripHint);

const applyModal = $("#job-apply-modal");
const applyOpenButton = $("#job-apply-open");
const applyConfirmButton = $("#job-apply-confirm");
const applyStatus = $("#job-apply-status");

function updateApplicationUi() {
  applyOpenButton.textContent = hasApplied ? "지원 완료 · 마이페이지에서 보기" : "이 공고 지원하기";
  applyConfirmButton.hidden = hasApplied;
  $("#job-apply-title").textContent = hasApplied ? "지원이 완료된 공고예요" : "이 공고에 지원할까요?";
  $("#job-apply-description").textContent = hasApplied
    ? "지원 내역과 공고 정보는 마이페이지에서 확인하거나 취소할 수 있어요."
    : "지원하면 마이페이지에서 공고와 지원일을 다시 확인할 수 있어요.";
}

function openApplyModal() {
  applyModal.hidden = false;
  document.body.classList.add("modal-open");
  applyModal.querySelector(".job-apply-close").focus();
}

function closeApplyModal() {
  applyModal.hidden = true;
  document.body.classList.remove("modal-open");
  applyOpenButton.focus();
}

applyOpenButton.addEventListener("click", () => {
  if (!requireLogin(applyStatus)) {
    location.href = `auth.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  if (hasApplied) {
    location.href = "mypage.html?view=applications";
    return;
  }
  setStatus(applyStatus);
  openApplyModal();
});
applyConfirmButton.addEventListener("click", async () => {
  if (!currentJobId || !requireLogin(applyStatus)) return;
  try {
    applyConfirmButton.disabled = true;
    setStatus(applyStatus, "지원 정보를 저장하고 있습니다.");
    await request(`/api/jobs/${currentJobId}/application`, { method: "POST" });
    hasApplied = true;
    updateApplicationUi();
    setStatus(applyStatus, "지원이 완료되었습니다. 마이페이지에서 확인할 수 있어요.");
  } catch (error) {
    setStatus(applyStatus, error.message, "error");
  } finally {
    applyConfirmButton.disabled = false;
  }
});
applyModal.querySelectorAll("[data-apply-close]").forEach((button) => button.addEventListener("click", closeApplyModal));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !applyModal.hidden) closeApplyModal();
});

(async function loadJob() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id || !/^\d+$/.test(id)) {
    showError("잘못된 공고 주소입니다. 지도에서 일자리 카드를 다시 선택해 주세요.");
    return;
  }
  try {
    currentJobId = Number(id);
    renderJob(await request(`/api/jobs/${id}`));
    wireBookmarkButton($("#job-bookmark-button"), "job", currentJobId);
    recordRecentView("job", currentJobId);
    updateCompareButton();
    if (sessionStorage.getItem("accessToken")) {
      const result = await request(`/api/jobs/${id}/application`);
      hasApplied = result.applied;
      updateApplicationUi();
    }
  } catch (error) {
    showError(error.message || "공고 정보를 불러오지 못했습니다. 서버를 확인해 주세요.");
  }
})();
