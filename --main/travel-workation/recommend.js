const { request, setStatus, escapeHtml } = Workation;
const recommendationForm = document.querySelector("#recommendation-form");
const recommendationStatus = document.querySelector("#recommendation-status");
const recommendationResults = document.querySelector("#recommendation-results");
const recommendationPrompt = document.querySelector("#recommendation-prompt");
const recommendationActions = document.querySelector("#recommendation-actions");
const retryButton = document.querySelector("#retry-recommendation");
const resetButton = document.querySelector("#reset-recommendation");
let retry = 0;

function checkedValues(name) {
  return [...recommendationForm.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function renderRecommendations(data) {
  recommendationPrompt.textContent = data.prompt || "선택한 취향을 바탕으로 추천했어요.";
  document.querySelector("#recommendation-round").textContent = data.retry >= data.maxRetries ? "마지막 추천" : `${data.retry + 1}차 추천`;
  if (!data.destinations.length) {
    recommendationResults.innerHTML = '<div class="page-status is-visible">조건에 맞는 관광지가 아직 등록되지 않았어요. 조건을 바꿔 다시 시도해 주세요.</div>';
  } else {
    recommendationResults.innerHTML = data.destinations.map((destination, index) => `
      <article class="preference-result">
        <div><span>추천 ${index + 1}</span><h4>${escapeHtml(destination.name)}</h4><p>${escapeHtml(destination.region)} · ${escapeHtml(destination.category || "전라도 여행")}</p><p>${escapeHtml(destination.description || "관광데이터 기반 추천 여행지입니다.")}</p></div>
        <strong>${destination.rating == null ? "추천" : `${Number(destination.rating).toFixed(1)}점`}</strong>
      </article>
    `).join("");
  }
  recommendationActions.hidden = false;
  retryButton.hidden = data.retry >= data.maxRetries;
}

async function submitRecommendation() {
  const themes = checkedValues("themes");
  const transports = checkedValues("transports");
  const companions = checkedValues("companions");
  if (!themes.length || !transports.length || !companions.length) {
    setStatus(recommendationStatus, "테마, 이동 방식, 동행 유형을 하나 이상씩 선택해 주세요.", "error");
    return;
  }
  try {
    setStatus(recommendationStatus, "관광데이터에서 취향에 맞는 여행지를 찾는 중입니다.");
    const data = await request("/api/destinations/recommend", {
      method: "POST",
      body: JSON.stringify({ region: recommendationForm.elements.region.value, themes, transports, companions, retry })
    });
    setStatus(recommendationStatus);
    renderRecommendations(data);
  } catch (error) {
    setStatus(recommendationStatus, error.message, "error");
  }
}

recommendationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  retry = 0;
  submitRecommendation();
});

retryButton.addEventListener("click", () => {
  retry += 1;
  submitRecommendation();
});

resetButton.addEventListener("click", () => {
  retry = 0;
  recommendationForm.reset();
  recommendationResults.innerHTML = '<div class="page-status is-visible">왼쪽에서 여행 취향을 선택해 주세요.</div>';
  recommendationPrompt.textContent = "취향을 선택하면 추천 이유와 여행지가 여기에 표시됩니다.";
  recommendationActions.hidden = true;
  setStatus(recommendationStatus);
  recommendationForm.scrollIntoView({ behavior: "smooth", block: "start" });
});
