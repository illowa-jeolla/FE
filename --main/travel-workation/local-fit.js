const { request, requireLogin, setStatus, escapeHtml } = Workation;
const form = document.querySelector("#local-fit-form");
const statusElement = document.querySelector("#local-fit-status");
const processingOverlay = document.querySelector("#ai-processing");
const priorityInputs = [...document.querySelectorAll('input[name="priorities"]')];
const priorityCount = document.querySelector("#priority-count");
const analysisSteps = [...document.querySelectorAll(".ai-analysis-step")];
const analysisProgress = document.querySelector("#ai-analysis-progress");
const analysisTime = document.querySelector("#ai-analysis-time");
const resultPanel = document.querySelector(".ai-match-result-panel");
const detailOverlay = document.querySelector("#ai-detail-overlay");
const detailTitle = document.querySelector("#ai-detail-title");
const detailLoading = document.querySelector("#ai-detail-loading");
const detailAnswer = document.querySelector("#ai-detail-answer");
let currentRecommendation = null;
const detailCache = new Map();
let analysisTimer;

function showAnalysisStep(step) {
  analysisSteps.forEach((element, index) => {
    element.classList.toggle("is-active", index === step);
    element.classList.toggle("is-complete", index < step);
    element.querySelector("i").textContent = index < step ? "✓" : index === step ? "●" : "○";
  });
  analysisProgress.style.width = `${(step + 1) * 25}%`;
  analysisTime.textContent = step === 3 ? "추천 결과를 정리하고 있어요 · 4 / 4 단계" : `약 10초 정도 걸려요 · ${step + 1} / 4 단계`;
}

function startAnalysis() {
  let step = 0;
  showAnalysisStep(step);
  processingOverlay.hidden = false;
  analysisTimer = window.setInterval(() => {
    if (step < 3) showAnalysisStep(++step);
  }, 900);
}

function finishAnalysis() {
  window.clearInterval(analysisTimer);
  showAnalysisStep(3);
  analysisSteps[3].classList.add("is-complete");
  analysisSteps[3].classList.remove("is-active");
  analysisSteps[3].querySelector("i").textContent = "✓";
}

function updatePriorityCount() {
  const count = priorityInputs.filter((input) => input.checked).length;
  priorityCount.textContent = `${count} / 4 선택`;
}

priorityInputs.forEach((input) => input.addEventListener("change", updatePriorityCount));

document.querySelectorAll('.metric-control input[type="range"]').forEach((input) => {
  input.addEventListener("input", () => {
    input.parentElement.querySelector("output").textContent = input.value;
  });
});

function renderRecommendation(saved) {
  const recommendation = saved.recommendation || {};
  const residence = recommendation.residence;
  const job = recommendation.job;
  const places = recommendation.places || [];
  const placeNames = places.map((place) => place.name).join(" · ") || "추천 관광지를 분석 중이에요";
  const list = document.querySelector("#local-fit-list");
  currentRecommendation = saved.recommendation || {};
  detailCache.clear();

  document.querySelector("#average-score").textContent = saved.score;
  document.querySelector("#score-ring").style.setProperty("--score", `${saved.score}%`);
  document.querySelector("#score-title").textContent = residence
    ? `${residence.name} ${saved.score}% 매칭`
    : `AI 추천 결과 ${saved.score}% 매칭`;
  document.querySelector("#local-fit-ai-summary").textContent = saved.aiSummary || "관광·채용 데이터를 연결해 추천했어요.";
  const factorLabels = ["생활 적합", "일자리", "관광 접근", "교통·연결"];
  const factorScores = [saved.score, Math.max(55, saved.score - 4), Math.min(98, saved.score + 2), Math.max(50, saved.score - 12)];
  document.querySelector("#ai-factor-scores").innerHTML = factorLabels.map((label, index) => `
    <div><strong>${factorScores[index]}</strong><span>${label}</span></div>
  `).join("");

  if (residence?.imageUrl) document.querySelector(".ai-match-photo").src = residence.imageUrl;
  const residenceTags = (residence?.advantages || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  list.innerHTML = `
    <article class="record-item residence-recommendation ai-detail-card" tabindex="0" role="button" data-detail-type="residence" data-detail-name="${escapeHtml(residence?.name || "전라도 추천 생활권")}"><div class="record-head"><div><span>AI 추천 거주지</span><h3>${escapeHtml(residence?.name || "전라도 추천 생활권")}</h3></div><strong class="record-score">${saved.score}%</strong></div><p>${escapeHtml(residence?.description || "입력 조건과 지역 데이터를 바탕으로 고른 생활권이에요.")}</p>${residenceTags ? `<div class="tag-row">${residenceTags}</div>` : ""}${residence?.caution ? `<p class="residence-caution"><strong>생활 전 확인</strong>${escapeHtml(residence.caution)}</p>` : ""}<small class="ai-detail-hint">정보 보기 →</small></article>
    <article class="record-item ai-detail-card" tabindex="0" role="button" data-detail-type="job" data-detail-name="${escapeHtml(job?.title || "조건에 맞는 지역 일자리")}"><div class="record-head"><div><span>AI 추천 일자리</span><h3>${escapeHtml(job?.title || "조건에 맞는 지역 일자리")}</h3></div><strong class="record-score">추천</strong></div><p>${escapeHtml(job ? `${job.companyName} · ${job.region} · ${job.workType}` : "현재 등록된 일자리 중 적합한 후보를 비교했어요.")}</p><small class="ai-detail-hint">정보 보기 →</small></article>
    <article class="record-item ai-detail-card" tabindex="0" role="button" data-detail-type="places" data-detail-name="${escapeHtml(placeNames)}"><div class="record-head"><div><span>AI 추천 관광지</span><h3>${escapeHtml(placeNames)}</h3></div><strong class="record-score">${places.length}곳</strong></div><p>추천 생활권에서 함께 즐기기 좋은 관광데이터 기반 장소예요.</p><small class="ai-detail-hint">정보 보기 →</small></article>
  `;
}

async function openAiDetail(card) {
  const type = card.dataset.detailType;
  const name = card.dataset.detailName;
  const cacheKey = `${type}:${name}`;
  detailTitle.textContent = name;
  detailAnswer.hidden = true;
  detailAnswer.textContent = "";
  detailOverlay.hidden = false;
  document.body.classList.add("modal-open");
  const cached = detailCache.get(cacheKey);
  if (cached) {
    detailLoading.hidden = true;
    detailAnswer.hidden = false;
    detailAnswer.classList.remove("is-error");
    detailAnswer.textContent = cached;
    return;
  }
  detailLoading.hidden = false;
  try {
    const result = await request("/api/local-fit/detail", {
      method: "POST",
      body: JSON.stringify({ type, name, context: currentRecommendation || {} })
    });
    detailLoading.hidden = true;
    detailAnswer.hidden = false;
    detailAnswer.textContent = result.detail;
    if (!result.aiEnabled) {
      detailAnswer.classList.add("is-error");
    } else {
      detailAnswer.classList.remove("is-error");
      detailCache.set(cacheKey, result.detail);
    }
  } catch (error) {
    detailLoading.hidden = true;
    detailAnswer.hidden = false;
    detailAnswer.classList.add("is-error");
    detailAnswer.textContent = error.message;
  }
}

function closeAiDetail() {
  detailOverlay.hidden = true;
  document.body.classList.remove("modal-open");
}

document.querySelector("#local-fit-list").addEventListener("click", (event) => {
  const card = event.target.closest(".ai-detail-card");
  if (card) openAiDetail(card);
});
document.querySelector("#local-fit-list").addEventListener("keydown", (event) => {
  const card = event.target.closest(".ai-detail-card");
  if (card && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    openAiDetail(card);
  }
});
document.querySelector("#ai-detail-close").addEventListener("click", closeAiDetail);
detailOverlay.addEventListener("click", (event) => { if (event.target === detailOverlay) closeAiDetail(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !detailOverlay.hidden) closeAiDetail(); });

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(statusElement)) return;
  const formData = new FormData(form);
  const body = Object.fromEntries(formData);
  body.priorities = formData.getAll("priorities");
  if (!body.priorities.length) {
    setStatus(statusElement, "생활 우선순위를 한 개 이상 선택해 주세요.", "error");
    return;
  }
  for (const key of ["immersion", "discovery", "convenience", "connection"]) {
    body[key] = Number(body[key]);
  }
  try {
    startAnalysis();
    const analysisStartedAt = Date.now();
    setStatus(statusElement, "관광·채용·생활권 데이터를 연결하는 중입니다.");
    const saved = await request("/api/local-fit", { method: "POST", body: JSON.stringify(body) });
    const remaining = Math.max(0, 3600 - (Date.now() - analysisStartedAt));
    if (remaining) await new Promise((resolve) => window.setTimeout(resolve, remaining));
    finishAnalysis();
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    renderRecommendation(saved);
    document.body.classList.add("ai-result-ready");
    if (saved.aiEnabled) {
      setStatus(statusElement, "AI가 추천 생활권·일자리·관광지를 찾았습니다.", "success");
    } else {
      setStatus(statusElement, `AI 연결에 실패해 데이터 기반 기본 추천을 표시했습니다. ${saved.aiError || "서버 설정을 확인해 주세요."}`, "error");
    }
    processingOverlay.hidden = true;
    resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus(statusElement, error.message, "error");
    window.clearInterval(analysisTimer);
    processingOverlay.hidden = true;
  }
});

document.querySelector("#retry-match").addEventListener("click", () => {
  document.body.classList.remove("ai-result-ready");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  form.querySelector("input:not([type='hidden']), select, textarea")?.focus();
});

