(function () {
  const apiBaseUrl = window.WORKATION_API_BASE_URL
    ?? window.JOBS_API_BASE_URL
    ?? (location.protocol === "file:" ? "http://localhost:8080" : "");

  const htmlEscapes = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapes[character]);
  }

  async function request(path, options = {}) {
    const token = sessionStorage.getItem("accessToken");
    const headers = {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "요청을 처리하지 못했습니다.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function requireLogin(messageElement) {
    if (sessionStorage.getItem("accessToken")) return true;
    if (messageElement) {
      messageElement.textContent = "로그인 후 이용할 수 있습니다.";
      messageElement.className = "page-status is-visible is-error";
    }
    return false;
  }

  function setStatus(element, message = "", type = "") {
    element.textContent = message;
    element.className = `page-status${message ? " is-visible" : ""}${type ? ` is-${type}` : ""}`;
  }

  function updateAuthLink() {
    const link = document.querySelector("[data-auth-link]");
    if (!link) return;
    const username = sessionStorage.getItem("username");
    const nickname = sessionStorage.getItem("nickname") || (username === "qwer" ? "운영자" : "");
    if (username) {
      link.textContent = nickname || username;
      link.href = "mypage.html";
    }
  }

  function showToast(message) {
    let toast = document.querySelector("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  async function wireBookmarkButton(button, itemType, itemId) {
    if (!button || !itemId) return;
    const update = (bookmarked) => {
      button.classList.toggle("is-saved", bookmarked);
      button.setAttribute("aria-pressed", String(bookmarked));
      button.setAttribute("title", bookmarked ? "찜 해제" : "찜하기");
      const label = button.querySelector("[data-bookmark-label]");
      if (label) label.textContent = bookmarked ? "찜됨" : "찜";
      const icon = button.querySelector("[data-bookmark-icon]");
      if (icon) icon.textContent = bookmarked ? "♥" : "♡";
    };
    update(false);
    if (sessionStorage.getItem("accessToken")) {
      try { update((await request(`/api/bookmarks/${itemType}/${itemId}`)).bookmarked); } catch { update(false); }
    }
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!sessionStorage.getItem("accessToken")) {
        location.href = `auth.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
        return;
      }
      const bookmarked = button.getAttribute("aria-pressed") === "true";
      button.disabled = true;
      try {
        const result = await request(`/api/bookmarks/${itemType}/${itemId}`, { method: bookmarked ? "DELETE" : "POST" });
        update(result.bookmarked);
        showToast(result.message);
      } catch (error) {
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  function recordRecentView(itemType, itemId) {
    if (!sessionStorage.getItem("accessToken") || !itemId) return Promise.resolve();
    return request(`/api/recent-views/${itemType}/${itemId}`, { method: "POST" }).catch(() => null);
  }

  function comparedJobs() {
    try { return JSON.parse(localStorage.getItem("comparedJobs") || "[]"); } catch { return []; }
  }

  function renderCompareTray() {
    const jobs = comparedJobs();
    let tray = document.querySelector("#job-compare-tray");
    if (!jobs.length) {
      tray?.remove();
      return;
    }
    if (!tray) {
      tray = document.createElement("aside");
      tray.id = "job-compare-tray";
      tray.className = "job-compare-tray";
      tray.setAttribute("aria-label", "일자리 비교 목록");
      document.body.append(tray);
    }
    tray.innerHTML = `<strong>비교 ${jobs.length}/3</strong><div>${jobs.map((job) => `<span>${escapeHtml(job.title)}<button type="button" data-remove-compare="${job.id}" title="비교에서 제거">×</button></span>`).join("")}</div><a class="button button-small button-primary" href="compare.html">비교하기</a>`;
    tray.querySelectorAll("[data-remove-compare]").forEach((button) => button.addEventListener("click", () => {
      localStorage.setItem("comparedJobs", JSON.stringify(comparedJobs().filter((job) => String(job.id) !== button.dataset.removeCompare)));
      renderCompareTray();
      document.dispatchEvent(new CustomEvent("job-compare-change"));
    }));
  }

  function toggleJobComparison(job) {
    const jobs = comparedJobs();
    const exists = jobs.some((entry) => Number(entry.id) === Number(job.id));
    const next = exists ? jobs.filter((entry) => Number(entry.id) !== Number(job.id)) : [...jobs, { id: job.id, title: job.title }];
    if (!exists && jobs.length >= 3) {
      showToast("일자리는 최대 3개까지 비교할 수 있어요.");
      return false;
    }
    localStorage.setItem("comparedJobs", JSON.stringify(next));
    renderCompareTray();
    document.dispatchEvent(new CustomEvent("job-compare-change"));
    showToast(exists ? "비교 목록에서 뺐어요." : "비교 목록에 담았어요.");
    return !exists;
  }

  window.Workation = {
    apiBaseUrl,
    escapeHtml,
    request,
    requireLogin,
    setStatus,
    updateAuthLink,
    showToast,
    wireBookmarkButton,
    recordRecentView,
    comparedJobs,
    toggleJobComparison,
    renderCompareTray
  };

  updateAuthLink();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderCompareTray);
  else renderCompareTray();
})();
