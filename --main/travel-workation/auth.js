const localApiBaseUrl = window.JOBS_API_BASE_URL
  ?? (location.protocol === "file:" ? "http://localhost:8080" : "");
const authApiConfig = window.AUTH_API_CONFIG ?? {};

function trimTrailingSlash(value = "") {
  return String(value).replace(/\/+$/, "");
}

function authApiUrl(endpoint) {
  const origin = trimTrailingSlash(authApiConfig.origin);
  const basePath = `/${String(authApiConfig.basePath || "/api/v1").replace(/^\/+|\/+$/g, "")}`;
  return `${origin}${basePath}${endpoint}`;
}

const loginApiUrl = authApiConfig.enabled
  ? authApiUrl(authApiConfig.endpoints?.login || "/auth/login")
  : `${localApiBaseUrl}/api/auth/login`;

const message = document.querySelector("#auth-message");
const returnTo = new URLSearchParams(location.search).get("returnTo");

function loginDestination() {
  if (!returnTo || returnTo.startsWith("//") || /^[a-z]+:/i.test(returnTo) || returnTo.includes("..")) return "index.html";
  return returnTo;
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("is-error", error);
}

function showView(view) {
  document.querySelector("#login-form").hidden = view !== "login";
  document.querySelector("#register-form").hidden = view !== "register";
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    const active = tab.dataset.authView === view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active);
  });
  showMessage("");
}

async function request(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "요청을 처리하지 못했습니다.");
  return payload.data ?? payload;
}

function saveLoginSession(data) {
  const accessToken = data.accessToken ?? data.tokenResponse?.accessToken ?? data.token;
  const refreshToken = data.tokenResponse?.refreshToken;
  const email = data.email ?? data.username ?? "";
  const nickname = data.name ?? data.nickname ?? "";

  if (!accessToken) throw new Error("로그인 응답에 accessToken이 없습니다.");

  sessionStorage.setItem("accessToken", accessToken);
  if (refreshToken) sessionStorage.setItem("refreshToken", refreshToken);
  if (data.userId != null) sessionStorage.setItem("userId", String(data.userId));
  if (email) {
    sessionStorage.setItem("email", email);
    sessionStorage.setItem("username", email);
  }
  if (nickname) sessionStorage.setItem("nickname", nickname);
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.authView));
});

document.querySelectorAll("[data-social-login]").forEach((button) => {
  button.addEventListener("click", () => {
    const providerLabel = String(button.dataset.socialLogin || "");
    const provider = ({ "카카오": "kakao", "구글": "google" })[providerLabel] || providerLabel.toLowerCase();
    const endpoint = authApiConfig.endpoints?.[provider];
    if (!authApiConfig.enabled || !endpoint) {
      showMessage(`${providerLabel} 로그인을 사용할 수 없습니다.`, true);
      return;
    }
    location.assign(authApiUrl(endpoint));
  });
});

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const { email, password } = Object.fromEntries(new FormData(event.currentTarget));

  try {
    showMessage("로그인 중입니다.");
    const data = await request(loginApiUrl, { email: email.trim().toLowerCase(), password });
    saveLoginSession(data);
    location.href = loginDestination();
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.querySelector("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));

  if (values.password !== values.passwordConfirm) {
    showMessage("비밀번호가 일치하지 않습니다.", true);
    return;
  }

  try {
    showMessage("계정을 만들고 있습니다.");
    const email = values.email.trim().toLowerCase();
    const signupApiUrl = authApiConfig.enabled
      ? authApiUrl(authApiConfig.endpoints?.signup || "/auth/signup")
      : `${localApiBaseUrl}/api/auth/register`;
    const data = await request(signupApiUrl, {
      email,
      password: values.password,
      nickname: values.nickname
    });
    saveLoginSession({ ...data, email, nickname: values.nickname });
    location.href = loginDestination();
  } catch (error) {
    showMessage(error.message, true);
  }
});
