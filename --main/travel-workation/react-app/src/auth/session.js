export function getSessionUser() {
  const email = sessionStorage.getItem("email") || sessionStorage.getItem("username") || "";
  return {
    userId: sessionStorage.getItem("userId") || "",
    email,
    name: sessionStorage.getItem("nickname") || email.split("@")[0] || ""
  };
}

export function hasSession() {
  return Boolean(sessionStorage.getItem("accessToken"));
}

export function saveLoginSession(data) {
  const accessToken = data.tokenResponse?.accessToken ?? data.token;
  const refreshToken = data.tokenResponse?.refreshToken;
  const email = data.email ?? data.username ?? "";
  const name = data.name ?? data.nickname ?? "";

  if (!accessToken) throw new Error("로그인 응답에 accessToken이 없습니다.");
  sessionStorage.setItem("accessToken", accessToken);
  if (refreshToken) sessionStorage.setItem("refreshToken", refreshToken);
  if (data.userId != null) sessionStorage.setItem("userId", String(data.userId));
  if (email) {
    sessionStorage.setItem("email", email);
    sessionStorage.setItem("username", email);
  }
  if (name) sessionStorage.setItem("nickname", name);
}

export function clearSession() {
  ["accessToken", "refreshToken", "userId", "email", "username", "nickname"].forEach((key) => {
    sessionStorage.removeItem(key);
  });
}
