const { request, requireLogin, setStatus, escapeHtml } = Workation;
const form = document.querySelector("#job-recommend-form");
const statusElement = document.querySelector("#job-page-status");
const regionSelect = form.elements.region;
const startInput = form.elements.tripStart;
const endInput = form.elements.tripEnd;
let duration = "당일";

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function syncDates() {
  if (endInput.value < startInput.value) endInput.value = startInput.value;
  endInput.min = startInput.value;
  const start = new Date(`${startInput.value}T00:00:00`);
  const end = new Date(`${endInput.value}T00:00:00`);
  const days = Math.round((end - start) / 86_400_000) + 1;
  duration = days === 1 ? "당일" : days <= 7 ? "1주" : "1개월";
  document.querySelector("#job-date-hint").textContent = `${days}일 일정 · 검색 기준 ${duration}`;
}

form.querySelectorAll('input[name="source"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const direct = form.elements.source.value === "region";
    regionSelect.disabled = !direct;
    regionSelect.required = direct;
  });
});

function renderJobs(data) {
  const list = document.querySelector("#job-result-list");
  document.querySelector("#job-result-kind").textContent = data.recommendationType === "short"
    ? `${data.region}의 행사·팝업 단기 일자리`
    : `${data.region}의 일반 알바 공고`;
  if (!data.jobs.length) {
    list.innerHTML = `<div class="page-status is-visible">${escapeHtml(data.region)}에 등록된 일자리 공고가 없습니다.</div>`;
    return;
  }
  list.innerHTML = data.jobs.map((job) => `
    <article class="result-item job-result-card" tabindex="0" role="link" data-job-id="${job.id}">
      <div class="result-head">
        <div><span>${escapeHtml(job.category || "관광 일자리")}</span><h3>${escapeHtml(job.title)}</h3></div>
        <strong>${job.jobKind === "short" ? "단기" : "일반"}</strong>
      </div>
      <p>${escapeHtml(job.companyName || "")}</p>
      <div class="tag-row"><span>${escapeHtml(job.region)}</span><span>${escapeHtml(job.workType)}</span><span>${escapeHtml(job.duration)}</span></div>
      <footer><span>${escapeHtml(job.location || job.region)}</span><a class="detail-link" href="job-detail.html?id=${job.id}">상세 보기 →</a></footer>
    </article>
  `).join("");

  list.querySelectorAll(".job-result-card").forEach((card) => {
    const open = () => { location.href = `job-detail.html?id=${card.dataset.jobId}`; };
    card.addEventListener("click", (event) => {
      if (!event.target.closest("a")) open();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const source = form.elements.source.value;
  if (source === "local-fit" && !requireLogin(statusElement)) return;
  if (source === "region" && !regionSelect.value) {
    setStatus(statusElement, "지역을 선택해 주세요.", "error");
    return;
  }
  try {
    setStatus(statusElement, "등록 일자리를 찾는 중입니다.");
    const query = new URLSearchParams({ source });
    if (regionSelect.value) query.set("region", regionSelect.value);
    query.set("duration", duration);
    if (form.elements.workType.value) query.set("workType", form.elements.workType.value);
    if (form.elements.time.value) query.set("time", form.elements.time.value);
    const data = await request(`/api/jobs/recommend?${query}`);
    setStatus(statusElement);
    renderJobs(data);
  } catch (error) {
    setStatus(statusElement, error.message, "error");
  }
});

startInput.addEventListener("change", syncDates);
endInput.addEventListener("change", syncDates);
const today = formatDateInput(new Date());
startInput.value = today;
endInput.value = today;
syncDates();

const initialParams = new URLSearchParams(location.search);
if (initialParams.get("source") === "region" && initialParams.get("region")) {
  const region = initialParams.get("region");
  const directRadio = form.querySelector('input[name="source"][value="region"]');
  directRadio.checked = true;
  regionSelect.disabled = false;
  regionSelect.required = true;
  if ([...regionSelect.options].some((option) => option.value === region)) regionSelect.value = region;
  requestAnimationFrame(() => form.requestSubmit());
}
