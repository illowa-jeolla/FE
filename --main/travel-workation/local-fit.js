const { request, requireLogin, setStatus, escapeHtml } = Workation;
const form = document.querySelector("#local-fit-form");
const statusElement = document.querySelector("#local-fit-status");

document.querySelectorAll('.metric-control input[type="range"]').forEach((input) => {
  input.addEventListener("input", () => {
    input.parentElement.querySelector("output").textContent = input.value;
  });
});

function renderEntries(data) {
  const list = document.querySelector("#local-fit-list");
  const score = data.averageScore;
  document.querySelector("#average-score").textContent = score ?? "-";
  document.querySelector("#score-ring").style.setProperty("--score", `${score || 0}%`);
  document.querySelector("#score-title").textContent = score == null
    ? "첫 여행을 기록해 보세요"
    : score >= 80 ? "지역과 아주 잘 맞아요" : score >= 60 ? "취향이 선명해지고 있어요" : "새로운 여행을 더 만나보세요";

  if (!data.entries.length) {
    list.innerHTML = '<div class="page-status is-visible">아직 저장된 여행 기록이 없습니다.</div>';
    return;
  }

  list.innerHTML = data.entries.map((entry) => `
    <article class="record-item">
      <div class="record-head">
        <div><span>${escapeHtml(entry.region)} · ${escapeHtml(entry.concept)}</span><h3>${escapeHtml(entry.destination_name)}</h3></div>
        <strong class="record-score">${entry.score}</strong>
      </div>
      <div class="tag-row"><span>${escapeHtml(entry.transport)}</span><span>${escapeHtml(entry.companion)}</span></div>
      ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
    </article>
  `).join("");
}

async function loadEntries() {
  if (!sessionStorage.getItem("accessToken")) return;
  try {
    renderEntries(await request("/api/local-fit"));
  } catch (error) {
    setStatus(statusElement, error.message, "error");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(statusElement)) return;
  const body = Object.fromEntries(new FormData(form));
  for (const key of ["immersion", "discovery", "convenience", "connection"]) {
    body[key] = Number(body[key]);
  }
  try {
    setStatus(statusElement, "여행 기록을 저장하는 중입니다.");
    const saved = await request("/api/local-fit", { method: "POST", body: JSON.stringify(body) });
    setStatus(statusElement, `로컬 핏 ${saved.score}점으로 저장했습니다.`, "success");
    form.reset();
    document.querySelectorAll(".metric-control output").forEach((output) => { output.textContent = "3"; });
    await loadEntries();
  } catch (error) {
    setStatus(statusElement, error.message, "error");
  }
});

loadEntries();
