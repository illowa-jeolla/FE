const { request, escapeHtml, setStatus, updateAuthLink } = Workation;
const profileForm = document.querySelector("#profile-form");
const pageStatus = document.querySelector("#mypage-status");
const profileStatus = document.querySelector("#profile-status");
const postsElement = document.querySelector("#mypage-posts");
const applicationsElement = document.querySelector("#mypage-applications");
let profile = null;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).replace(" ", "T") + (String(value).includes("Z") ? "" : "Z"));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
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
  document.querySelector("#mypage-created-at").textContent = formatDate(data.createdAt);
  document.querySelector("#post-tab-count").textContent = data.postCount;
  document.querySelector("#application-tab-count").textContent = data.applicationCount;
}

function renderPosts(posts) {
  if (!posts.length) {
    postsElement.innerHTML = '<div class="mypage-empty"><strong>아직 작성한 게시물이 없어요.</strong><a class="button button-small" href="community-write.html">여행 기록 작성하기</a></div>';
    return;
  }
  postsElement.innerHTML = posts.map((post) => {
    const image = safeImage(post);
    return `<article class="mypage-post-item">
      ${image ? `<img src="${image}" alt="${escapeHtml(post.region)} 여행 기록">` : '<div class="mypage-image-placeholder">여행 기록</div>'}
      <div><span>${escapeHtml(post.region)} · ${formatDate(post.created_at)}</span><h3>${escapeHtml(post.concept || "나의 여행 기록")}</h3><p>${escapeHtml(post.content)}</p><small>댓글 ${Number(post.comment_count || 0)}개</small></div>
      <a class="button button-small" href="community-detail.html?id=${post.id}">게시물 보기</a>
    </article>`;
  }).join("");
}

function renderApplications(applications) {
  if (!applications.length) {
    applicationsElement.innerHTML = '<div class="mypage-empty"><strong>아직 지원한 일자리가 없어요.</strong><a class="button button-small" href="map.html">일자리 둘러보기</a></div>';
    return;
  }
  applicationsElement.innerHTML = applications.map(({ job, appliedAt }) => `<article class="mypage-application-item">
    <div class="mypage-job-badge">${escapeHtml((job.region || "전라도").slice(0, 2))}</div>
    <div><span>지원일 ${formatDate(appliedAt)}</span><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.companyName || "지역 사업장")} · ${escapeHtml(job.region)} · ${escapeHtml(job.workType || "근무 방식 협의")}</p><small>${escapeHtml(job.pay || "급여 협의")}</small></div>
    <div class="mypage-item-actions"><a class="button button-small" href="job-detail.html?id=${job.id}">공고 보기</a><button class="button button-small" type="button" data-cancel-job="${job.id}">지원 취소</button></div>
  </article>`).join("");
}

function selectView(view) {
  const applicationsView = view === "applications";
  postsElement.hidden = applicationsView;
  applicationsElement.hidden = !applicationsView;
  document.querySelectorAll("[data-mypage-view]").forEach((button) => {
    const active = button.dataset.mypageView === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

async function loadPage() {
  if (!sessionStorage.getItem("accessToken")) {
    location.replace("auth.html?returnTo=mypage.html");
    return;
  }
  try {
    const [profileData, posts, applications] = await Promise.all([
      request("/api/me"), request("/api/me/posts"), request("/api/me/applications")
    ]);
    renderProfile(profileData);
    renderPosts(posts);
    renderApplications(applications);
    document.querySelector("#mypage-summary").hidden = false;
    document.querySelector("#mypage-content").hidden = false;
    setStatus(pageStatus);
    selectView(new URLSearchParams(location.search).get("view") === "applications" ? "applications" : "posts");
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
    const result = await request("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ nickname: values.nickname, currentPassword: values.currentPassword, newPassword: values.newPassword })
    });
    sessionStorage.setItem("nickname", result.nickname);
    profileForm.elements.currentPassword.value = "";
    profileForm.elements.newPassword.value = "";
    profileForm.elements.newPasswordConfirm.value = "";
    renderProfile({ ...profile, nickname: result.nickname });
    updateAuthLink();
    setStatus(profileStatus, result.message);
  } catch (error) {
    setStatus(profileStatus, error.message, "error");
  }
});

applicationsElement.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-cancel-job]");
  if (!button || !confirm("이 일자리 지원을 취소할까요?")) return;
  try {
    button.disabled = true;
    await request(`/api/jobs/${button.dataset.cancelJob}/application`, { method: "DELETE" });
    const [profileData, applications] = await Promise.all([request("/api/me"), request("/api/me/applications")]);
    renderProfile(profileData);
    renderApplications(applications);
  } catch (error) {
    setStatus(pageStatus, error.message, "error");
    button.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  sessionStorage.clear();
  location.replace("index.html");
});

loadPage();
