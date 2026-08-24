const { request, setStatus, escapeHtml } = Workation;
const statusElement = document.querySelector("#mypage-status");
let dashboard;
let gatheringFilter = "";
const mypageJobPhotos = ["assets/J6aHjc.jpeg", "assets/JvLTt.jpeg", "assets/lX3GW.jpeg", "assets/OZ3bs.jpeg", "assets/s6jB4w.jpeg", "assets/u3OD9c.jpeg", "assets/wt960.jpeg", "assets/y0SxMq.jpeg"];
const mypageGuidePhotos = ["assets/JvLTt.jpeg", "assets/lX3GW.jpeg", "assets/J6aHjc.jpeg", "assets/u3OD9c.jpeg", "assets/bI7WI.jpeg"];

function empty(message) { return `<div class="mypage-empty"><span>♡</span><p>${message}</p></div>`; }
function date(value) { return value ? new Date(`${value}Z`).toLocaleDateString("ko-KR") : ""; }
function gatheringDate(value) { return value ? new Date(value).toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }) : ""; }
function favoriteJobPhoto(item) { return mypageJobPhotos[Math.abs(Number(item.jobId) || 0) % mypageJobPhotos.length]; }
function guideEndDate(item) { return item.guide?.tripEnd || item.guide?.conditions?.end || ""; }
function canReview(item) {
  const end = guideEndDate(item);
  if (!end) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(`${end}T00:00:00`) < today;
}
function render() {
  const { profile, trips, guides, posts, gatherings = [], applications, favoriteJobs = [] } = dashboard;
  const reviewedGuideIds = new Set(trips.map((trip) => String(trip.guideId)));
  const email = profile.email || profile.username || "";
  const displayName = profile.nickname || email.split("@")[0] || "사용자";
  document.querySelector("#mypage-nickname").textContent = `${displayName}님의 기록`;
  document.querySelector("#mypage-email").textContent = email;
  document.querySelector("#mypage-avatar").textContent = displayName.slice(0, 1);
  document.querySelector("#profile-email").value = email;
  document.querySelector("#profile-nickname").value = profile.nickname || displayName;
  [["trip", trips], ["guide", guides], ["post", posts], ["gathering", gatherings], ["application", applications], ["favorite", favoriteJobs]].forEach(([key, values]) => document.querySelector(`#${key}-count`).textContent = values.length);
  document.querySelector("#trip-list").innerHTML = trips.length ? trips.map((trip) => { const images = trip.images?.length ? trip.images : trip.imageData ? [trip.imageData] : []; const rating = Math.max(1, Math.min(5, Number(trip.rating) || 5)); return `<article class="mypage-trip-review" data-open-trip="${trip.id}" tabindex="0">${images.length ? `<div class="mypage-trip-cover"><img src="${escapeHtml(images[0])}" alt="${escapeHtml(trip.region)} 여행 리뷰 사진"><span>${escapeHtml(trip.region)}</span><b>★ ${rating}.0</b>${images.length > 1 ? `<small>+${images.length - 1}</small>` : ""}</div>` : `<div class="mypage-trip-cover is-empty"><span>${escapeHtml(trip.region)}</span><b>★ ${rating}.0</b></div>`}<div class="mypage-trip-copy"><span>MY TRAVEL REVIEW</span><h3>${escapeHtml(trip.destinationName)}</h3><p>${escapeHtml(trip.note || "여행 리뷰")}</p><footer><small>${date(trip.createdAt)}</small><strong>여행 기록 보기 →</strong></footer></div></article>`; }).join("") : empty("리뷰를 남긴 여행 가이드가 아직 없어요.");
  document.querySelector("#guide-list").innerHTML = guides.length ? guides.map((item) => {
    const end = guideEndDate(item);
    const spots = item.guide?.spots || [];
    return `<article class="mypage-guide-card" data-open-guide="${item.id}" tabindex="0">
      <div class="mypage-guide-copy"><span>SAVED GUIDE · ${escapeHtml(item.region)}</span><h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.hotel || "추천 출발지")}</p><div class="mypage-guide-summary"><b>${spots.length}곳 코스</b>${end ? `<b>${escapeHtml(end)}까지</b>` : ""}</div>
      <div class="mypage-guide-spots">${spots.slice(0, 5).map((spot, index) => `<div><span>${index + 1}</span><b>${escapeHtml(spot.name || `추천 장소 ${index + 1}`)}</b><img class="mypage-guide-hover-preview" src="${escapeHtml(spot.imageUrl || mypageGuidePhotos[index % mypageGuidePhotos.length])}" alt="${escapeHtml(spot.name || `추천 장소 ${index + 1}`)} 사진"></div>`).join("") || `<div class="is-empty"><b>상세 코스에서 추천 장소를 확인해 주세요.</b></div>`}</div>
      <small>${date(item.createdAt)} 저장</small></div>
      <div class="mypage-guide-actions">
        ${reviewedGuideIds.has(String(item.id)) ? `<button class="guide-review-button is-complete" type="button" disabled>리뷰 작성됨</button>` : canReview(item) ? `<button class="guide-review-button" type="button" data-review-guide="${item.id}">리뷰 쓰기</button>` : ""}
        <button class="guide-delete-button" type="button" data-delete-guide="${item.id}">삭제</button>
      </div>
    </article>`;
  }).join("") : empty("저장한 여행 가이드가 없어요.");
  document.querySelector("#post-list").innerHTML = posts.length ? posts.map((post) => `<a class="mypage-story-card" href="community-detail.html?id=${post.id}"><div class="mypage-story-body"><span>${escapeHtml(post.region)}</span><h3>${escapeHtml(post.concept || "여행 이야기")}</h3><p>${escapeHtml(post.content).slice(0, 110)}</p><footer><small>${date(post.createdAt)}</small><strong>이야기 보기 →</strong></footer></div>${post.imageData ? `<img src="${escapeHtml(post.imageData)}" alt="${escapeHtml(post.region)} 여행 사진">` : `<div class="mypage-story-placeholder" aria-hidden="true"><b>${escapeHtml(post.region).slice(0, 1)}</b><span>TRAVEL</span></div>`}</a>`).join("") : empty("공유한 여행 이야기가 없어요.");
  const visibleGatherings = gatherings.filter((item) => {
    if (!gatheringFilter) return true;
    const past = new Date(item.eventTime).getTime() < Date.now();
    if (gatheringFilter === "owned") return Boolean(item.createdByMe);
    if (gatheringFilter === "active") return !item.createdByMe && !past;
    return !item.createdByMe && past;
  });
  const gatheringEmptyCopy = gatheringFilter === "owned" ? "내가 올린 게더링이 없어요." : gatheringFilter === "active" ? "현재 참여 중인 게더링이 없어요." : gatheringFilter === "past" ? "이전에 참여한 게더링이 없어요." : "만들거나 참여한 게더링이 없어요.";
  document.querySelector("#gathering-list").innerHTML = visibleGatherings.length ? visibleGatherings.map((item) => {
    const past = new Date(item.eventTime).getTime() < Date.now();
    const owned = Boolean(item.createdByMe);
    const activeParticipation = !owned && !past;
    const remaining = Math.max(0, item.capacity - item.participantCount);
    return `<article class="gathering-item gathering-item-compact mypage-gathering-card${owned ? " is-owned" : ""}${activeParticipation ? " is-joined" : ""}" data-mypage-gathering="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)} 상세 보기">
      <div class="gathering-head"><div><h3>${escapeHtml(item.title)}</h3><p class="gathering-card-location">${escapeHtml(item.location)}</p></div><div class="gathering-card-schedule"><time>${gatheringDate(item.eventTime)}</time><strong>${item.participantCount}/${item.capacity}명</strong><small>${past ? "지난 게더링" : item.confirmed ? "모집 확정" : `${remaining}자리 남음`}</small></div></div>
      <footer><span class="gathering-footer-concept">${escapeHtml(item.concept || "자유 모임")}${owned && item.confirmed ? " · 확정됨" : ""}</span>${owned ? `<div class="gathering-owner-actions"><button class="button gathering-confirm-button" type="button" data-mypage-gathering-action="confirm" data-gathering-id="${item.id}">${item.confirmed ? "확정됨" : "확정짓기"}</button><button class="button join-button is-cancel" type="button" data-mypage-gathering-action="cancel" data-gathering-id="${item.id}">취소하기</button></div>` : activeParticipation ? `<div class="gathering-participation-actions"><span>참여 중</span><button class="button button-primary join-button is-leave" type="button" data-mypage-gathering-action="leave" data-gathering-id="${item.id}">참여 취소</button></div>` : `<span class="mypage-gathering-past">지난 게더링</span>`}</footer>
    </article>`;
  }).join("") : empty(gatheringEmptyCopy);
  document.querySelector("#application-list").innerHTML = applications.length ? applications.map((item) => `<a class="mypage-favorite-job" href="job-detail.html?id=${item.jobId}"><img src="${favoriteJobPhoto(item)}" alt="${escapeHtml(item.region)} 일자리 현장"><div class="mypage-favorite-job-body"><span>${escapeHtml(item.category || "관광 일자리")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.companyName || "지역 사업장")}</p><div class="mypage-favorite-job-meta"><b>${escapeHtml(item.workType || "근무 방식 협의")}</b><b>${escapeHtml(item.workTime || "시간 협의")}</b><b>${escapeHtml(item.duration || "기간 협의")}</b></div><footer><small>${escapeHtml(item.location || item.region)}</small><strong>${escapeHtml(item.pay || "급여 정보 없음")}</strong></footer></div></a>`).join("") : empty("지원한 공고가 없어요.");
  document.querySelector("#favorite-list").innerHTML = favoriteJobs.length ? favoriteJobs.map((item) => `<a class="mypage-favorite-job" href="job-detail.html?id=${item.jobId}"><img src="${favoriteJobPhoto(item)}" alt="${escapeHtml(item.region)} 일자리 현장"><div class="mypage-favorite-job-body"><span>${escapeHtml(item.category || "관광 일자리")}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.companyName || "지역 사업장")}</p><div class="mypage-favorite-job-meta"><b>${escapeHtml(item.workType || "근무 방식 협의")}</b><b>${escapeHtml(item.workTime || "시간 협의")}</b><b>${escapeHtml(item.duration || "기간 협의")}</b></div><footer><small>${escapeHtml(item.location || item.region)}</small><strong>${escapeHtml(item.pay || "급여 정보 없음")}</strong></footer></div></a>`).join("") : empty("찜한 일자리가 없어요.");
}

document.querySelector(".mypage-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]"); if (!button) return;
  document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === button.dataset.tab));
});
document.querySelector(".mypage-gathering-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-gathering-filter]");
  if (!button) return;
  gatheringFilter = gatheringFilter === button.dataset.gatheringFilter ? "" : button.dataset.gatheringFilter;
  document.querySelectorAll("[data-gathering-filter]").forEach((item) => {
    const selected = item.dataset.gatheringFilter === gatheringFilter;
    item.classList.toggle("is-active", selected);
    item.setAttribute("aria-pressed", String(selected));
  });
  render();
});
const gatheringDetailModal = document.querySelector("#mypage-gathering-detail-modal");
const gatheringDetailContent = document.querySelector("#mypage-gathering-detail-content");

function closeMypageGatheringDetail() { gatheringDetailModal.hidden = true; document.body.classList.remove("gathering-detail-open"); }
function openMypageGatheringDetail(item) {
  if (!item) return;
  const past = new Date(item.eventTime).getTime() < Date.now();
  gatheringDetailContent.innerHTML = `<p class="eyebrow dark">GATHERING DETAIL</p><time>${gatheringDate(item.eventTime)}</time><h2 id="mypage-gathering-detail-title">${escapeHtml(item.title)}</h2><p class="gathering-detail-description">${escapeHtml(item.description || "등록된 상세 설명이 없습니다.")}</p><dl class="gathering-detail-info"><div><dt>지역</dt><dd>${escapeHtml(item.region)}</dd></div><div><dt>장소</dt><dd>${escapeHtml(item.location)}</dd></div><div><dt>콘셉트</dt><dd>${escapeHtml(item.concept || "자유 모임")}</dd></div><div><dt>올린 사람</dt><dd>${escapeHtml(item.creatorNickname)}</dd></div><div><dt>참여 인원</dt><dd>${item.participantCount}/${item.capacity}명</dd></div><div><dt>상태</dt><dd>${past ? "지난 게더링" : item.confirmed ? "모집 확정" : item.createdByMe ? "내가 올린 게더링" : "참여 중"}</dd></div></dl><section class="gathering-detail-participants"><strong>참여한 사람</strong><div>${(item.participants || []).map((name) => `<span>${escapeHtml(name)}</span>`).join("") || "<p>아직 참여자가 없습니다.</p>"}</div></section>`;
  gatheringDetailModal.hidden = false;
  document.body.classList.add("gathering-detail-open");
}
gatheringDetailModal.querySelectorAll("[data-mypage-gathering-close]").forEach((button) => button.addEventListener("click", closeMypageGatheringDetail));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !gatheringDetailModal.hidden) closeMypageGatheringDetail(); });

document.querySelector("#gathering-list").addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-mypage-gathering-action]");
  if (actionButton) {
    event.stopPropagation();
    const action = actionButton.dataset.mypageGatheringAction;
    const id = actionButton.dataset.gatheringId;
    if (action === "cancel" && !confirm("이 게더링을 취소할까요? 참여자 목록과 게더링 정보가 함께 삭제됩니다.")) return;
    try {
      await request(action === "confirm" ? `/api/gatherings/${id}/confirm` : action === "cancel" ? `/api/gatherings/${id}` : `/api/gatherings/${id}/join`, { method: action === "confirm" ? "PATCH" : "DELETE" });
      dashboard = await request("/api/me");
      render();
    } catch (error) { setStatus(statusElement, error.message, "error"); }
    return;
  }
  const card = event.target.closest("[data-mypage-gathering]");
  if (card) openMypageGatheringDetail(dashboard.gatherings.find((item) => String(item.id) === card.dataset.mypageGathering));
});
document.querySelector("#gathering-list").addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-mypage-gathering]")) { event.preventDefault(); event.target.click(); } });
const reviewModal = document.querySelector("#guide-review-modal");
const reviewForm = document.querySelector("#guide-review-form");
const reviewStatus = document.querySelector("#guide-review-status");
const reviewRatingCopy = document.querySelector("#guide-rating-copy");
const reviewRatingLabels = { 1: "아쉬웠어요", 2: "조금 아쉬웠어요", 3: "괜찮았어요", 4: "좋았어요", 5: "정말 좋았어요" };
let reviewingGuideId = "";
let reviewImages = [];
const reviewImageInput = document.querySelector("#guide-review-image");
const reviewPhotoPreview = document.querySelector("#guide-review-photo-preview");

function renderReviewPhotos() { reviewPhotoPreview.innerHTML = reviewImages.map((image, index) => `<article class="photo-preview-card"><img src="${image}" alt="선택한 여행 사진 ${index + 1}">${index === 0 ? '<span>대표 사진</span>' : ""}<button type="button" data-remove-review-photo="${index}" aria-label="사진 삭제">×</button></article>`).join("") + (reviewImages.length < 5 ? '<button class="photo-add-card" type="button"><span>＋</span><b>사진 추가</b></button>' : ""); }
function clearReviewPhoto() { reviewImages = []; reviewImageInput.value = ""; renderReviewPhotos(); }
reviewImageInput.addEventListener("change", () => {
  const files = [...reviewImageInput.files];
  if (reviewImages.length + files.length > 5) { setStatus(reviewStatus, "사진은 최대 5장까지 올릴 수 있어요.", "error"); reviewImageInput.value = ""; return; }
  if (files.some((file) => file.size > 1_000_000)) { setStatus(reviewStatus, "사진은 한 장당 1MB 이하로 선택해 주세요.", "error"); reviewImageInput.value = ""; return; }
  files.forEach((file) => { const reader = new FileReader(); reader.onload = () => { reviewImages.push(reader.result); renderReviewPhotos(); }; reader.readAsDataURL(file); });
  reviewImageInput.value = "";
});
reviewPhotoPreview.addEventListener("click", (event) => { const button = event.target.closest("[data-remove-review-photo]"); if (button) { reviewImages.splice(Number(button.dataset.removeReviewPhoto), 1); renderReviewPhotos(); return; } if (event.target.closest(".photo-add-card")) reviewImageInput.click(); });

function closeReviewModal() { reviewModal.hidden = true; document.body.classList.remove("modal-open"); reviewingGuideId = ""; }
document.querySelectorAll("[data-review-close]").forEach((button) => button.addEventListener("click", closeReviewModal));
reviewForm.addEventListener("change", (event) => {
  if (event.target.name === "rating") reviewRatingCopy.textContent = `${event.target.value}점 · ${reviewRatingLabels[event.target.value]}`;
});
reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = reviewForm.querySelector("[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(reviewForm));
    values.imageData = reviewImages;
    const review = await request(`/api/me/guides/${reviewingGuideId}/review`, { method: "POST", body: JSON.stringify(values) });
    dashboard.trips.unshift(review);
    closeReviewModal();
    reviewForm.reset();
    clearReviewPhoto();
    reviewRatingCopy.textContent = "5점 · 정말 좋았어요";
    render();
    setStatus(statusElement, "여행 리뷰를 등록했어요.");
  } catch (error) { setStatus(reviewStatus, error.message, "error"); }
  finally { submit.disabled = false; }
});
document.querySelector("#guide-list").addEventListener("click", async (event) => {
  const reviewButton = event.target.closest("[data-review-guide]");
  if (reviewButton) {
    event.stopPropagation();
    reviewingGuideId = reviewButton.dataset.reviewGuide;
    const item = dashboard.guides.find((guide) => String(guide.id) === reviewingGuideId);
    document.querySelector("#guide-review-title").textContent = `${item?.region || "여행"} 여행 리뷰 남기기`;
    setStatus(reviewStatus);
    reviewModal.hidden = false;
    document.body.classList.add("modal-open");
    reviewForm.elements.content.focus();
    return;
  }
  const deleteButton = event.target.closest("[data-delete-guide]");
  if (deleteButton) {
    event.stopPropagation();
    if (!confirm("이 여행 가이드를 삭제할까요?")) return;
    try {
      await request(`/api/me/guides/${deleteButton.dataset.deleteGuide}`, { method: "DELETE" });
      dashboard.guides = dashboard.guides.filter((item) => String(item.id) !== deleteButton.dataset.deleteGuide);
      render();
      setStatus(statusElement, "저장한 여행 가이드를 삭제했어요.");
    } catch (error) { setStatus(statusElement, error.message, "error"); }
    return;
  }
  if (event.target.closest("a")) return;
  const card = event.target.closest("[data-open-guide]");
  if (!card) return;
  const item = dashboard.guides.find((guide) => String(guide.id) === card.dataset.openGuide);
  if (!item) return;
  const savedConditions = item.guide.conditions || { region: item.region, hotel: item.hotel, start: item.guide.tripStart || "", end: item.guide.tripEnd || "", themes: [], transport: "", companion: "" };
  sessionStorage.setItem("travelGuideConditions", JSON.stringify(savedConditions));
  sessionStorage.setItem("travelGuideResult", JSON.stringify({ guide: item.guide, attempt: 1, excludedSpots: [], conditions: savedConditions, saved: true, savedGuideId: item.id }));
  location.href = `travel-guide.html?saved=1&guideId=${encodeURIComponent(item.id)}`;
});
document.querySelector("#guide-list").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-open-guide]")) event.target.click();
});
let tripReviewModal;
function closeTripReview() {
  if (!tripReviewModal) return;
  tripReviewModal.hidden = true;
  document.body.classList.remove("modal-open");
}
function openTripReview(trip) {
  if (!trip) return;
  const images = trip.images?.length ? trip.images : trip.imageData ? [trip.imageData] : [];
  const rating = Math.max(1, Math.min(5, Number(trip.rating) || 5));
  if (!tripReviewModal) {
    tripReviewModal = document.createElement("div");
    tripReviewModal.className = "guide-review-modal trip-review-detail-modal";
    tripReviewModal.hidden = true;
    tripReviewModal.innerHTML = `<button class="guide-review-backdrop" type="button" aria-label="리뷰 상세 창 닫기" data-trip-review-close></button><section class="guide-review-dialog trip-review-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="trip-review-detail-title"><button class="guide-review-close" type="button" aria-label="닫기" data-trip-review-close>×</button><div id="trip-review-detail-content"></div></section>`;
    document.body.appendChild(tripReviewModal);
    tripReviewModal.addEventListener("click", (event) => { if (event.target.closest("[data-trip-review-close]")) closeTripReview(); });
  }
  tripReviewModal.querySelector("#trip-review-detail-content").innerHTML = `<span class="mypage-kicker">MY TRAVEL REVIEW</span><h2 id="trip-review-detail-title">${escapeHtml(trip.destinationName)}</h2><div class="trip-review-detail-meta"><span>${escapeHtml(trip.region)}</span><time>${date(trip.createdAt)}</time></div><div class="mypage-review-stars" aria-label="별점 ${rating}점">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>${images.length ? `<div class="trip-review-detail-images">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(trip.region)} 여행 리뷰 사진 ${index + 1}">`).join("")}</div>` : ""}<p class="trip-review-detail-content">${escapeHtml(trip.note || "작성한 리뷰 내용이 없습니다.")}</p>`;
  tripReviewModal.hidden = false;
  document.body.classList.add("modal-open");
  tripReviewModal.querySelector(".guide-review-close").focus();
}
document.querySelector("#trip-list").addEventListener("click", (event) => {
  const card = event.target.closest("[data-open-trip]");
  if (card) openTripReview(dashboard.trips.find((trip) => String(trip.id) === card.dataset.openTrip));
});
document.querySelector("#trip-list").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-open-trip]")) event.target.click();
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && tripReviewModal && !tripReviewModal.hidden) closeTripReview(); });
document.querySelector("#nickname-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const profile = await request("/api/me", { method: "PATCH", body: JSON.stringify({ nickname: document.querySelector("#profile-nickname").value }) }); sessionStorage.setItem("nickname", profile.nickname); dashboard.profile = profile; render(); setStatus(statusElement, "닉네임을 변경했습니다."); }
  catch (error) { setStatus(statusElement, error.message, "error"); }
});
document.querySelector("#mypage-logout").addEventListener("click", () => { sessionStorage.clear(); location.href = "index.html"; });
document.querySelector("#mypage-delete").addEventListener("click", async () => { if (!confirm("정말 탈퇴할까요? 모든 기록이 삭제되며 되돌릴 수 없습니다.")) return; try { await request("/api/me", { method: "DELETE" }); sessionStorage.clear(); location.href = "index.html"; } catch (error) { setStatus(statusElement, error.message, "error"); } });

(async function load() {
  if (!sessionStorage.getItem("accessToken")) { location.href = "auth.html"; return; }
  try { dashboard = await request("/api/me"); render(); document.querySelector("#mypage-content").hidden = false; }
  catch (error) { setStatus(statusElement, error.message, "error"); }
})();
