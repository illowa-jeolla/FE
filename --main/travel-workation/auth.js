const apiBaseUrl = window.AUTH_API_BASE_URL
  ?? window.JOBS_API_BASE_URL
  ?? (location.protocol === "file:" ? "http://localhost:8080" : "");

const message = document.querySelector("#auth-message");

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

async function request(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data;
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
  const { username, password } = Object.fromEntries(new FormData(event.currentTarget));

  try {
    showMessage("로그인 중입니다.");
    const data = await request("/api/auth/login", { username, password });
    if (data.token) sessionStorage.setItem("accessToken", data.token);
    if (data.username) sessionStorage.setItem("username", data.username);
    location.href = "index.html";
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
    await request("/api/auth/register", {
      username: values.username,
      password: values.password
    });
    event.currentTarget.reset();
    showView("login");
    showMessage("회원가입이 완료되었습니다. 로그인해 주세요.");
  } catch (error) {
    showMessage(error.message, true);
  }
});
