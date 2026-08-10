const { request, requireLogin, setStatus, escapeHtml } = Workation;
const searchForm = document.querySelector("#gathering-search-form");
const listStatus = document.querySelector("#gathering-list-status");
const gatheringList = document.querySelector("#gathering-list");
const resultCount = document.querySelector("#gathering-result-count");
const createModal = document.querySelector("#gathering-create-modal");
const createForm = document.querySelector("#gathering-create-form");
const createStatus = document.querySelector("#gathering-create-status");
const createTime = document.querySelector("#gathering-create-time");
const detailModal = document.querySelector("#gathering-detail-modal");
const detailContent = document.querySelector("#gathering-detail-content");
let renderedGatherings = [];
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit"
});

function formatDateTime(value) {
  return dateTimeFormatter.format(new Date(value));
}

function localDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function setDefaultCreateTime() {
  const now = new Date();
  createTime.min = localDateTimeValue(now);
  createTime.value = localDateTimeValue(new Date(now.getTime() + 3_600_000));
}

function openCreateModal() {
  createModal.hidden = false;
  document.body.classList.add("gathering-create-open");
  setStatus(createStatus);
  setDefaultCreateTime();
  createForm.elements.title.focus();
}

function closeCreateModal() {
  createModal.hidden = true;
  document.body.classList.remove("gathering-create-open");
  document.querySelector("#gathering-create-open").focus();
}

function renderGatherings(gatherings) {
  const sortedGatherings = [...gatherings].sort((left, right) => Number(Boolean(right.owned)) - Number(Boolean(left.owned)));
  renderedGatherings = sortedGatherings;
  resultCount.textContent = gatherings.length;
  if (!gatherings.length) {
    gatheringList.innerHTML = "";
    setStatus(listStatus, "선택한 조건에 맞는 게더링이 없습니다.");
    return;
  }
  setStatus(listStatus);
  const ownedCount = sortedGatherings.filter((gathering) => Boolean(gathering.owned)).length;
  gatheringList.innerHTML = sortedGatherings.map((gathering, index) => {
    const full = gathering.participant_count >= gathering.capacity;
    const joined = Boolean(gathering.joined);
    const owned = Boolean(gathering.owned);
    const participated = joined && !owned;
    const confirmed = Boolean(gathering.confirmed);
    const remaining = Math.max(0, gathering.capacity - gathering.participant_count);
    const divider = index === ownedCount && ownedCount > 0 && ownedCount < sortedGatherings.length
      ? `<div class="gathering-list-divider"><span>다른 게더링</span></div>`
      : "";
    return `${divider}
      <article class="gathering-item gathering-item-compact${participated ? " is-joined" : ""}${owned ? " is-owned" : ""}" data-gathering-card="${gathering.id}" tabindex="0" role="button" aria-label="${escapeHtml(gathering.title)} 상세 보기">
        <div class="gathering-head">
          <div><h3>${escapeHtml(gathering.title)}</h3><p class="gathering-card-location">${escapeHtml(gathering.location)}</p></div>
          <div class="gathering-card-schedule"><time>${formatDateTime(gathering.event_time)}</time><strong>${gathering.participant_count}/${gathering.capacity}명</strong><small>${confirmed ? "모집 확정" : full ? "정원 마감" : `${remaining}자리 남음`}</small></div>
        </div>
        <footer><span class="gathering-footer-concept">${escapeHtml(gathering.concept || "자유 모임")}${owned && confirmed ? " · 확정됨" : ""}</span>${owned ? `<div class="gathering-owner-actions"><button class="button gathering-confirm-button" type="button" data-gathering-id="${gathering.id}" data-action="confirm">${confirmed ? "확정됨" : "확정짓기"}</button><button class="button join-button is-cancel" type="button" data-gathering-id="${gathering.id}" data-action="cancel">취소하기</button></div>` : participated ? `<div class="gathering-participation-actions"><span>참여 중</span><button class="button button-primary join-button is-leave" type="button" data-gathering-id="${gathering.id}" data-action="leave">참여 취소</button></div>` : `<button class="button button-primary join-button" type="button" data-gathering-id="${gathering.id}" data-action="join" ${(full || confirmed) ? "disabled" : ""}>${confirmed ? "참여 마감" : "참여하기"}</button>`}</footer>
      </article>
    `;
  }).join("");
}

function openGatheringDetail(gathering) {
  if (!gathering) return;
  const joined = Boolean(gathering.joined);
  const owned = Boolean(gathering.owned);
  const full = gathering.participant_count >= gathering.capacity;
  detailContent.innerHTML = `
    <p class="eyebrow dark">GATHERING DETAIL</p>
    <time>${formatDateTime(gathering.event_time)}</time>
    <h2 id="gathering-detail-title">${escapeHtml(gathering.title)}</h2>
    <p class="gathering-detail-description">${escapeHtml(gathering.description || "등록된 상세 설명이 없습니다.")}</p>
    <dl class="gathering-detail-info">
      <div><dt>지역</dt><dd>${escapeHtml(gathering.region)}</dd></div>
      <div><dt>장소</dt><dd>${escapeHtml(gathering.location)}</dd></div>
      <div><dt>콘셉트</dt><dd>${escapeHtml(gathering.concept || "자유 모임")}</dd></div>
      <div><dt>올린 사람</dt><dd>${escapeHtml(gathering.nickname || gathering.username)}</dd></div>
      <div><dt>참여 인원</dt><dd>${gathering.participant_count}/${gathering.capacity}명</dd></div>
      <div><dt>상태</dt><dd>${owned ? `내가 올린 게더링${gathering.confirmed ? " · 확정됨" : ""}` : joined ? "참여 중" : gathering.confirmed ? "모집 확정" : full ? "정원 마감" : `${gathering.capacity - gathering.participant_count}자리 남음`}</dd></div>
    </dl>
    <section class="gathering-detail-participants"><strong>참여한 사람</strong><div>${(gathering.participants || []).map((name) => `<span>${escapeHtml(name)}</span>`).join("") || "<p>아직 참여자가 없습니다.</p>"}</div></section>`;
  detailModal.hidden = false;
  document.body.classList.add("gathering-detail-open");
  detailModal.querySelector(".gathering-detail-close").focus();
}

function closeGatheringDetail() {
  detailModal.hidden = true;
  document.body.classList.remove("gathering-detail-open");
}

detailModal.querySelectorAll("[data-gathering-detail-close]").forEach((button) => button.addEventListener("click", closeGatheringDetail));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !detailModal.hidden) closeGatheringDetail(); });

async function loadGatherings() {
  const query = new URLSearchParams();
  const data = new FormData(searchForm);
  for (const key of ["region", "date", "time", "dateScope", "concept"]) {
    const value = String(data.get(key) || "").trim();
    if (value) query.set(key, value);
  }
  try {
    resultCount.textContent = "-";
    setStatus(listStatus, "조건에 맞는 게더링을 찾고 있습니다.");
    const queryString = query.toString();
    renderGatherings(await request(`/api/gatherings${queryString ? `?${queryString}` : ""}`));
  } catch (error) {
    resultCount.textContent = "0";
    setStatus(listStatus, error.message, "error");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadGatherings();
});

document.querySelector("#gathering-search-reset").addEventListener("click", () => {
  searchForm.reset();
  loadGatherings();
});

document.querySelector("#gathering-create-open").addEventListener("click", openCreateModal);
createModal.querySelectorAll("[data-gathering-create-close]").forEach((button) => button.addEventListener("click", closeCreateModal));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !createModal.hidden) closeCreateModal(); });

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(createStatus)) return;
  const body = Object.fromEntries(new FormData(createForm));
  body.capacity = Number(body.capacity);
  try {
    setStatus(createStatus, "게더링을 만드는 중입니다.");
    await request("/api/gatherings", { method: "POST", body: JSON.stringify(body) });
    createForm.reset();
    closeCreateModal();
    await loadGatherings();
  } catch (error) {
    setStatus(createStatus, error.message, "error");
  }
});

gatheringList.addEventListener("click", async (event) => {
  const button = event.target.closest(".join-button, .gathering-confirm-button");
  if (!button) {
    const card = event.target.closest("[data-gathering-card]");
    if (card) openGatheringDetail(renderedGatherings.find((item) => String(item.id) === card.dataset.gatheringCard));
    return;
  }
  if (!requireLogin(listStatus)) return;
  try {
    const cancelling = button.dataset.action === "cancel";
    const confirming = button.dataset.action === "confirm";
    const leaving = button.dataset.action === "leave";
    if (cancelling && !confirm("이 게더링을 취소할까요? 참여자 목록과 게더링 정보가 함께 삭제됩니다.")) return;
    await request(confirming ? `/api/gatherings/${button.dataset.gatheringId}/confirm` : cancelling ? `/api/gatherings/${button.dataset.gatheringId}` : `/api/gatherings/${button.dataset.gatheringId}/join`, { method: confirming ? "PATCH" : (cancelling || leaving) ? "DELETE" : "POST" });
    await loadGatherings();
  } catch (error) {
    setStatus(listStatus, error.message, "error");
  }
});

gatheringList.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-gathering-card]")) {
    event.preventDefault();
    openGatheringDetail(renderedGatherings.find((item) => String(item.id) === event.target.dataset.gatheringCard));
  }
});

loadGatherings();
