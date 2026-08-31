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
  const tokenSource = data.tokenResponse ?? data.tokens ?? data.auth ?? data;
  const accessToken = tokenSource.accessToken ?? tokenSource.access_token ?? tokenSource.token;
  const user = data.user ?? data.member ?? {};
  const email = data.email ?? data.username ?? user.email ?? user.username ?? "";
  const name = data.name ?? data.nickname ?? user.name ?? user.nickname ?? "";

  if (!accessToken) throw new Error("로그인 응답에 accessToken이 없습니다.");
  ["accessToken", "refreshToken", "userId", "email", "username", "nickname"].forEach((key) => sessionStorage.removeItem(key));
  sessionStorage.setItem("accessToken", String(accessToken).replace(/^Bearer\s+/i, ""));
  const userId = data.userId ?? data.memberId ?? user.id ?? user.userId;
  if (userId != null) sessionStorage.setItem("userId", String(userId));
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
