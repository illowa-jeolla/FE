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
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data;
}

function saveLoginSession(data) {
  const accessToken = data.tokenResponse?.accessToken ?? data.token;
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
    showMessage(`${button.dataset.socialLogin} 간편 로그인은 연동 준비 중입니다.`);
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
    await request(`${localApiBaseUrl}/api/auth/register`, {
      email,
      password: values.password,
      nickname: values.nickname
    });
    event.currentTarget.reset();
    showView("login");
    document.querySelector("#login-form [name='email']").value = email;
    showMessage("회원가입이 완료되었습니다. 로그인해 주세요.");
  } catch (error) {
    showMessage(error.message, true);
  }
});
