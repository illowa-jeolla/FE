const { request, requireLogin, setStatus, escapeHtml } = Workation;
const gatheringForm = document.querySelector("#gathering-form");
const formStatus = document.querySelector("#gathering-status");
const listStatus = document.querySelector("#gathering-list-status");
const gatheringList = document.querySelector("#gathering-list");
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit"
});

function localDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  return dateTimeFormatter.format(new Date(value));
}

function renderGatherings(gatherings) {
  if (!gatherings.length) {
    gatheringList.innerHTML = "";
    setStatus(listStatus, "선택한 지역에 열린 게더링이 없습니다.");
    return;
  }
  setStatus(listStatus);
  gatheringList.innerHTML = gatherings.map((gathering) => {
    const full = gathering.participant_count >= gathering.capacity;
    return `
      <article class="gathering-item">
        <div class="gathering-head">
          <div><time>${formatDateTime(gathering.event_time)}</time><h3>${escapeHtml(gathering.title)}</h3></div>
          <strong>${gathering.participant_count}/${gathering.capacity}명</strong>
        </div>
        <p>${escapeHtml(gathering.region)} · ${escapeHtml(gathering.location)} · 만든 사람 ${escapeHtml(gathering.username)}</p>
        <div class="tag-row"><span>${escapeHtml(gathering.concept || "자유 모임")}</span></div>
        <footer><span>${full ? "정원 마감" : `${gathering.capacity - gathering.participant_count}자리 남음`}</span><button class="button button-primary join-button" type="button" data-gathering-id="${gathering.id}" ${full ? "disabled" : ""}>참여하기</button></footer>
      </article>
    `;
  }).join("");
}

async function loadGatherings() {
  const region = document.querySelector("#gathering-region-filter").value;
  try {
    setStatus(listStatus, "게더링을 불러오는 중입니다.");
    const query = region ? `?region=${encodeURIComponent(region)}` : "";
    renderGatherings(await request(`/api/gatherings${query}`));
  } catch (error) {
    setStatus(listStatus, error.message, "error");
  }
}

gatheringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(formStatus)) return;
  const body = Object.fromEntries(new FormData(gatheringForm));
  body.capacity = Number(body.capacity);
  try {
    setStatus(formStatus, "게더링을 만드는 중입니다.");
    await request("/api/gatherings", { method: "POST", body: JSON.stringify(body) });
    gatheringForm.reset();
    document.querySelector("#gathering-time").min = localDateTimeValue(new Date());
    setStatus(formStatus, "게더링을 열었습니다.", "success");
    await loadGatherings();
  } catch (error) {
    setStatus(formStatus, error.message, "error");
  }
});

document.querySelector("#gathering-filter-button").addEventListener("click", loadGatherings);

gatheringList.addEventListener("click", async (event) => {
  const button = event.target.closest(".join-button");
  if (!button) return;
  if (!requireLogin(listStatus)) return;
  try {
    await request(`/api/gatherings/${button.dataset.gatheringId}/join`, { method: "POST" });
    setStatus(listStatus, "게더링에 참여했습니다.", "success");
    await loadGatherings();
  } catch (error) {
    setStatus(listStatus, error.message, "error");
  }
});

const now = new Date();
document.querySelector("#gathering-time").min = localDateTimeValue(now);
document.querySelector("#gathering-time").value = localDateTimeValue(new Date(now.getTime() + 3_600_000));
loadGatherings();
