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
    if (username) {
      link.textContent = username;
      link.href = "local-fit.html";
    }
  }

  window.Workation = {
    apiBaseUrl,
    escapeHtml,
    request,
    requireLogin,
    setStatus,
    updateAuthLink
  };

  updateAuthLink();
})();
