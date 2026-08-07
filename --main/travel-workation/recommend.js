const { request, setStatus, escapeHtml } = Workation;
const recommendationForm = document.querySelector("#recommendation-form");
const recommendationStatus = document.querySelector("#recommendation-status");
const recommendationResults = document.querySelector("#recommendation-results");
const recommendationPrompt = document.querySelector("#recommendation-prompt");
const retryButton = document.querySelector("#retry-recommendation");
const resetButton = document.querySelector("#reset-recommendation");
const submitButton = recommendationForm.querySelector(".recommend-submit");
const inputView = document.querySelector("#recommendation-input-view");
const resultView = document.querySelector("#recommendation-result-view");
let retry = 0;

function checkedValues(name) {
  return [...recommendationForm.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function selectedPreferences() {
  const labels = { 자연: "자연·힐링", 미식: "미식 여행", 사진: "감성 사진", 문화: "역사·문화", 도보: "도보 중심" };
  return [...checkedValues("themes"), ...checkedValues("transports"), ...checkedValues("companions")].map((value) => labels[value] || value);
}

function imageMarkup(destination) {
  if (!destination.imageUrl) return '<div class="recommend-image-fallback" aria-hidden="true"></div>';
  return `<img src="${escapeHtml(destination.imageUrl)}" alt="${escapeHtml(destination.name)}">`;
}

function destinationMarkup(destination, index) {
  return `
    <article class="recommend-destination" tabindex="0">
      ${imageMarkup(destination)}
      <div class="recommend-destination__body">
        <span class="recommend-destination__meta">추천 ${index + 1} · ${escapeHtml(destination.region)}</span>
        <h2>${escapeHtml(destination.name)}</h2>
        <p>${escapeHtml(destination.category || "전라도 여행")} · ${destination.rating == null ? "관광데이터 추천" : `평점 ${Number(destination.rating).toFixed(1)}`}</p>
        <p>${escapeHtml(destination.description || "선택한 취향과 잘 어울리는 전라도 여행지입니다.")}</p>
        <div class="recommend-destination__reason"><span>추천 이유 보기</span><span>⌄</span></div>
      </div>
    </article>`;
}

function renderRecommendations(data) {
  const preferences = selectedPreferences();
  const round = Number(data.retry || 0) + 1;
  const exhausted = data.retry >= data.maxRetries;
  const titles = [
    "초록과 미식을 따라가는<br>남도 감각 여행",
    "바다와 골목을 잇는<br>서남해 감성 여행",
    "차분과 한옥이 머무는<br>느린 남도 여행"
  ];

  document.querySelector("#recommendation-round").textContent = `추천 결과 · ${round} / 3`;
  document.querySelector("#recommendation-title").innerHTML = titles[Math.min(data.retry, titles.length - 1)];
  document.querySelector("#recommendation-match-score").textContent = `${92 - data.retry * 4}%`;
  document.querySelector("#recommendation-selected").innerHTML = preferences.map((value) => `<span># ${escapeHtml(value)}</span>`).join("");
  recommendationPrompt.textContent = data.prompt || "선택한 취향을 바탕으로 추천했어요.";

  if (!data.destinations.length) {
    recommendationResults.innerHTML = '<div class="page-status is-visible">조건에 맞는 관광지가 아직 등록되지 않았어요. 조건을 바꿔 다시 시도해 주세요.</div>';
  } else {
    recommendationResults.innerHTML = data.destinations.map(destinationMarkup).join("");
  }

  document.querySelector("#recommendation-help").textContent = exhausted
    ? "↻ 두 번 모두 살펴봤어요. 취향을 바꾸면 더 정확해져요."
    : "↻ 아직 새로운 여행지가 있어요.";
  retryButton.hidden = exhausted;
  inputView.hidden = true;
  resultView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitRecommendation({ loadingButton = null, loadingText = "AI가 다른 여행지를 찾는 중…" } = {}) {
  const themes = checkedValues("themes");
  const transports = checkedValues("transports");
  const companions = checkedValues("companions");
  if (!themes.length || !transports.length || !companions.length) {
    setStatus(recommendationStatus, "여행 테마, 이동 수단, 동행 유형을 모두 선택해 주세요.", "error");
    return;
  }
  const originalButtonHtml = loadingButton?.innerHTML;
  if (loadingButton) {
    loadingButton.disabled = true;
    loadingButton.setAttribute("aria-busy", "true");
    loadingButton.classList.add("is-loading");
    loadingButton.innerHTML = `<span class="recommend-button-spinner" aria-hidden="true"></span><span>${loadingText}</span>`;
  }
  try {
    setStatus(recommendationStatus, "관광데이터에서 취향에 맞는 여행지를 찾는 중입니다.");
    const data = await request("/api/destinations/recommend", {
      method: "POST",
      body: JSON.stringify({ region: "", themes, transports, companions, retry })
    });
    setStatus(recommendationStatus);
    renderRecommendations(data);
  } catch (error) {
    setStatus(recommendationStatus, error.message, "error");
  } finally {
    if (loadingButton) {
      loadingButton.disabled = false;
      loadingButton.removeAttribute("aria-busy");
      loadingButton.classList.remove("is-loading");
      loadingButton.innerHTML = originalButtonHtml;
    }
  }
}

recommendationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitButton.disabled) return;
  retry = 0;
  await submitRecommendation({ loadingButton: submitButton, loadingText: "AI가 여행지를 찾는 중…" });
});

retryButton.addEventListener("click", async () => {
  if (retryButton.disabled) return;
  retry += 1;
  await submitRecommendation({ loadingButton: retryButton });
});

resetButton.addEventListener("click", () => {
  retry = 0;
  resultView.hidden = true;
  inputView.hidden = false;
  retryButton.hidden = false;
  setStatus(recommendationStatus);
  window.scrollTo({ top: 0, behavior: "smooth" });
});
