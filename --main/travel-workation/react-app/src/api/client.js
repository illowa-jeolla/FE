import { API_BASE_URL, AUTH_API, authApiUrl } from "../config";

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function parseResponse(response) {
  return response.json().catch(() => ({}));
}

export async function refreshAccessToken() {
  if (!AUTH_API.enabled) throw new Error("토큰 재발급 API가 비활성화되어 있습니다.");

  const csrfResponse = await fetch(authApiUrl(AUTH_API.endpoints.csrf), {
    headers: { Accept: "application/json" },
    credentials: "include"
  });
  const csrfPayload = await parseResponse(csrfResponse);
  if (!csrfResponse.ok) throw new Error(csrfPayload.message || "CSRF 토큰을 발급받지 못했습니다.");

  const cookieName = csrfPayload.data?.cookieName || "XSRF-TOKEN";
  const headerName = csrfPayload.data?.headerName || "X-XSRF-TOKEN";
  const csrfToken = readCookie(cookieName);
  if (!csrfToken) throw new Error("CSRF 쿠키를 읽을 수 없습니다.");

  const refreshResponse = await fetch(authApiUrl(AUTH_API.endpoints.refresh), {
    method: "POST",
    headers: { Accept: "application/json", [headerName]: csrfToken },
    credentials: "include"
  });
  const refreshPayload = await parseResponse(refreshResponse);
  if (!refreshResponse.ok) throw new Error(refreshPayload.message || "로그인 세션을 갱신하지 못했습니다.");

  const accessToken = refreshPayload.data?.accessToken;
  if (!accessToken) throw new Error("토큰 재발급 응답에 accessToken이 없습니다.");
  sessionStorage.setItem("accessToken", accessToken);
  return accessToken;
}

export async function logoutFromBackend() {
  const token = sessionStorage.getItem("accessToken");
  const response = await fetch(authApiUrl(AUTH_API.endpoints.logout), {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: "include"
  });
  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(payload.message || "로그아웃하지 못했습니다.");
    error.status = response.status;
    throw error;
  }
}

export async function apiRequest(path, options = {}, retry = true) {
  const token = sessionStorage.getItem("accessToken");
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  const data = await parseResponse(response);
  if (response.status === 401 && retry && AUTH_API.enabled) {
    await refreshAccessToken();
    return apiRequest(path, options, false);
  }
  if (!response.ok) {
    const error = new Error(data.message || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    throw error;
  }
  return data.data ?? data;
}

export async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data.data ?? data;
}
