const { request, escapeHtml, setStatus, updateAuthLink, showToast } = Workation;
const profileForm = document.querySelector("#profile-form");
const pageStatus = document.querySelector("#mypage-status");
const profileStatus = document.querySelector("#profile-status");
const panels = {
  posts: document.querySelector("#mypage-posts"),
  applications: document.querySelector("#mypage-applications"),
  bookmarks: document.querySelector("#mypage-bookmarks"),
  recent: document.querySelector("#mypage-recent")
};
let profile = null;

const typeLabels = { job: "일자리", destination: "관광지", post: "여행 기록" };
const typeIcons = { job: "일", destination: "여", post: "글" };
const statusSteps = [
  { key: "applied", label: "지원 완료" },
  { key: "reviewing", label: "검토 중" },
  { key: "interview", label: "면접" },
  { key: "accepted", label: "최종 결과" }
];

function formatDate(value) {
  if (!value) return "-";
  const source = String(value);
  const date = new Date(source.replace(" ", "T") + (source.includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? source.slice(0, 10) : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function safeImage(post) {
  let images = [];
  try { images = JSON.parse(post.images_data || "[]"); } catch { images = []; }
  const source = images[0] || post.image_data || "";
  return /^(data:image\/(png|jpeg|webp);base64,|assets\/)/.test(source) ? source : "";
}

function renderProfile(data) {
  profile = data;
  profileForm.elements.username.value = data.username;
  profileForm.elements.nickname.value = data.nickname;
  document.querySelector("#mypage-nickname").textContent = data.nickname;
  document.querySelector("#mypage-username").textContent = `@${data.username}`;
  document.querySelector("#mypage-avatar").textContent = data.nickname.trim().slice(0, 1).toUpperCase();
  document.querySelector("#mypage-post-count").textContent = data.postCount;
  document.querySelector("#mypage-application-count").textContent = data.applicationCount;
  document.querySelector("#mypage-bookmark-count").textContent = data.bookmarkCount;
  document.querySelector("#mypage-created-at").textContent = formatDate(data.createdAt);
  document.querySelector("#post-tab-count").textContent = data.postCount;
  document.querySelector("#application-tab-count").textContent = data.applicationCount;
  document.querySelector("#bookmark-tab-count").textContent = data.bookmarkCount;
  document.querySelector("#notification-unread-count").textContent = data.unreadNotificationCount;
}

function renderPosts(posts) {
  if (!posts.length) {
    panels.posts.innerHTML = '<div class="mypage-empty"><strong>아직 작성한 게시물이 없어요</strong><a class="button button-small" href="community-write.html">여행 기록 작성하기</a></div>';
    return;
  }
  panels.posts.innerHTML = posts.map((post) => {
    const image = safeImage(post);
    return `<article class="mypage-post-item">
      ${image ? `<img src="${image}" alt="${escapeHtml(post.region)} 여행 기록">` : '<div class="mypage-image-placeholder">여행 기록</div>'}
      <div><span>${escapeHtml(post.region)} · ${formatDate(post.created_at)}</span><h3>${escapeHtml(post.concept || "나의 여행 기록")}</h3><p>${escapeHtml(post.content)}</p><small>댓글 ${Number(post.comment_count || 0)}개</small></div>
      <a class="button button-small" href="community-detail.html?id=${post.id}">게시물 보기</a>
    </article>`;
  }).join("");
}

function progressMarkup(status) {
  const current = Math.max(0, statusSteps.findIndex((step) => step.key === status));
  const rejected = status === "rejected";
  return `<ol class="application-progress" aria-label="지원 진행 상태">${statusSteps.map((step, index) => `<li class="${index <= current && !rejected ? "is-complete" : ""} ${index === current ? "is-current" : ""}"><span>${index + 1}</span><small>${step.label}</small></li>`).join("")}</ol>${rejected ? '<p class="application-result is-rejected">이번 지원은 종료되었어요.</p>' : ""}`;
}

function renderApplications(applications) {
  if (!applications.length) {
    panels.applications.innerHTML = '<div class="mypage-empty"><strong>아직 지원한 일자리가 없어요</strong><a class="button button-small" href="map.html">일자리 둘러보기</a></div>';
    return;
  }
  panels.applications.innerHTML = applications.map(({ job, appliedAt, status, note }) => `<article class="mypage-application-card">
    <div class="mypage-application-item">
      <div class="mypage-job-badge">${escapeHtml((job.region || "전라도").slice(0, 2))}</div>
      <div><span>지원일 ${formatDate(appliedAt)}</span><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.companyName || "지역 사업장")} · ${escapeHtml(job.region)} · ${escapeHtml(job.workType || "근무 방식 협의")}</p><small>${escapeHtml(job.pay || "급여 협의")}</small></div>
      <div class="mypage-item-actions"><a class="button button-small" href="job-detail.html?id=${job.id}">공고 보기</a><a class="button button-small" href="planner.html?itemType=job&itemId=${job.id}">일정 추가</a><button class="button button-small" type="button" data-cancel-job="${job.id}">지원 취소</button></div>
    </div>
    ${progressMarkup(status)}
    <form class="application-note" data-note-job="${job.id}"><label>개인 메모<input name="note" maxlength="300" value="${escapeHtml(note || "")}" placeholder="담당자 연락, 준비할 서류 등을 적어두세요"></label><button class="button button-small" type="submit">메모 저장</button></form>
  </article>`).join("");
}

function renderSavedItems(items, panel, { removable = false } = {}) {
  if (!items.length) {
    panel.innerHTML = `<div class="mypage-empty"><strong>${removable ? "아직 찜한 항목이 없어요" : "최근 본 항목이 없어요"}</strong><a class="button button-small" href="recommend.html">새로운 여행 찾기</a></div>`;
    return;
  }
  panel.innerHTML = items.map((item) => `<article class="mypage-saved-item">
    <div class="mypage-saved-icon is-${item.itemType}">${typeIcons[item.itemType] || "저"}</div>
    <div><span>${typeLabels[item.itemType] || "저장 항목"} · ${formatDate(item.viewedAt || item.createdAt)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subtitle || "")}</p></div>
    <div class="mypage-item-actions"><a class="button button-small" href="${escapeHtml(item.link)}">바로 보기</a>${item.itemType !== "post" ? `<a class="button button-small" href="planner.html?itemType=${item.itemType}&itemId=${item.itemId}">일정 추가</a>` : ""}${removable ? `<button class="icon-action" type="button" data-remove-bookmark="${item.itemType}:${item.itemId}" title="찜 해제"><span aria-hidden="true">♥</span></button>` : ""}</div>
  </article>`).join("");
}

function renderNotifications(notifications) {
  const list = document.querySelector("#notification-list");
  if (!notifications.length) {
    list.innerHTML = '<p class="mypage-notification-empty">새 알림이 없어요.</p>';
    return;
  }
  list.innerHTML = notifications.slice(0, 5).map((notification) => `<a class="mypage-notification ${notification.isRead ? "" : "is-unread"}" href="${escapeHtml(notification.link || "mypage.html")}"><span aria-hidden="true">${notification.type === "comment" ? "말" : notification.type === "planner" ? "일" : "알"}</span><div><strong>${escapeHtml(notification.title)}</strong><p>${escapeHtml(notification.message)}</p></div><time>${formatDate(notification.createdAt)}</time></a>`).join("");
}

function selectView(view) {
  const target = panels[view] ? view : "posts";
  Object.entries(panels).forEach(([name, panel]) => { panel.hidden = name !== target; });
  document.querySelectorAll("[data-mypage-view]").forEach((button) => {
    const active = button.dataset.mypageView === target;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  history.replaceState(null, "", `mypage.html?view=${target}`);
}

async function loadPage() {
  if (!sessionStorage.getItem("accessToken")) {
    location.replace("auth.html?returnTo=mypage.html");
    return;
  }
  try {
    const [profileData, posts, applications, bookmarks, recent, notifications] = await Promise.all([
      request("/api/me"), request("/api/me/posts"), request("/api/me/applications"),
      request("/api/me/bookmarks"), request("/api/me/recent-views"), request("/api/me/notifications")
    ]);
    renderProfile(profileData);
    renderPosts(posts);
    renderApplications(applications);
    renderSavedItems(bookmarks, panels.bookmarks, { removable: true });
    renderSavedItems(recent, panels.recent);
    renderNotifications(notifications);
    document.querySelector("#mypage-summary").hidden = false;
    document.querySelector("#mypage-content").hidden = false;
    setStatus(pageStatus);
    selectView(new URLSearchParams(location.search).get("view") || "posts");
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.clear();
      location.replace("auth.html?returnTo=mypage.html");
      return;
    }
    setStatus(pageStatus, error.message, "error");
  }
}

document.querySelectorAll("[data-mypage-view]").forEach((button) => button.addEventListener("click", () => selectView(button.dataset.mypageView)));

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(profileForm));
  if (values.newPassword !== values.newPasswordConfirm) {
    setStatus(profileStatus, "새 비밀번호가 일치하지 않습니다.", "error");
    return;
  }
  try {
    setStatus(profileStatus, "변경사항을 저장하고 있습니다.");
    const result = await request("/api/me", { method: "PATCH", body: JSON.stringify({ nickname: values.nickname, currentPassword: values.currentPassword, newPassword: values.newPassword }) });
    sessionStorage.setItem("nickname", result.nickname);
    profileForm.elements.currentPassword.value = "";
    profileForm.elements.newPassword.value = "";
    profileForm.elements.newPasswordConfirm.value = "";
    renderProfile({ ...profile, nickname: result.nickname });
    updateAuthLink();
    setStatus(profileStatus, result.message);
  } catch (error) { setStatus(profileStatus, error.message, "error"); }
});

panels.applications.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel-job]");
  if (!button || !confirm("이 일자리 지원을 취소할까요?")) return;
  try {
    button.disabled = true;
    await request(`/api/jobs/${button.dataset.cancelJob}/application`, { method: "DELETE" });
    await loadPage();
  } catch (error) { setStatus(pageStatus, error.message, "error"); button.disabled = false; }
});

panels.applications.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-note-job]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button");
  try {
    button.disabled = true;
    const result = await request(`/api/jobs/${form.dataset.noteJob}/application`, { method: "PATCH", body: JSON.stringify({ note: form.elements.note.value }) });
    showToast(result.message);
  } catch (error) { showToast(error.message); } finally { button.disabled = false; }
});

panels.bookmarks.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-remove-bookmark]");
  if (!button) return;
  const [type, id] = button.dataset.removeBookmark.split(":");
  try {
    await request(`/api/bookmarks/${type}/${id}`, { method: "DELETE" });
    await loadPage();
    selectView("bookmarks");
  } catch (error) { showToast(error.message); }
});

document.querySelector("#notification-read-all").addEventListener("click", async () => {
  try {
    await request("/api/me/notifications/read", { method: "PATCH" });
    await loadPage();
    showToast("알림을 모두 읽음 처리했어요.");
  } catch (error) { showToast(error.message); }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  sessionStorage.clear();
  location.replace("index.html");
});

loadPage();
