import { API_BASE_URL, AUTH_API, authApiUrl } from "../config";
import { clearSession } from "../auth/session";

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}

async function parseResponse(response) {
  return response.json().catch(() => ({}));
}

function tunnelHeaders(url) {
  return {};
}

function accessTokenFrom(payload = {}) {
  const data = payload.data ?? payload;
  const source = data.tokenResponse ?? data.tokens ?? data.auth ?? data;
  const token = source.accessToken ?? source.access_token ?? source.token;
  return token ? String(token).replace(/^Bearer\s+/i, "") : "";
}

function refreshTokenFrom(payload = {}) {
  const data = payload.data ?? payload;
  const source = data.tokenResponse ?? data.tokens ?? data.auth ?? data;
  return source.refreshToken ?? source.refresh_token ?? "";
}

function errorValue(payload = {}, key) {
  return payload?.[key]
    ?? payload?.error?.[key]
    ?? payload?.data?.[key]
    ?? payload?.data?.error?.[key]
    ?? "";
}

function isAuthenticationFailure(response, payload = {}) {
  const code = String(errorValue(payload, "code") || errorValue(payload, "errorCode")).toUpperCase();
  const message = String(errorValue(payload, "message")).toLowerCase();
  return response.status === 401
    || code.includes("AUTH_401")
    || code.includes("AUTH_403")
    || code.includes("INVALID_TOKEN")
    || code.includes("EXPIRED_TOKEN")
    || message.includes("유효하지 않은 토큰")
    || message.includes("만료된 토큰")
    || message.includes("invalid token")
    || message.includes("expired token");
}

let refreshInFlight = null;
const requestInFlight = new Map();
const GET_CACHE_MS = 30 * 1000;
const MUTATION_DEDUPE_MS = 1000;

function tokenNeedsRefresh(token) {
  try {
    const payloadPart = String(token).split(".")[1];
    if (!payloadPart) return false;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payloadPart.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized));
    return Number(payload.exp || 0) * 1000 <= Date.now() + 30000;
  } catch {
    return false;
  }
}

async function performTokenRefresh() {
  if (!AUTH_API.enabled) throw new Error("토큰 재발급 API가 비활성화되어 있습니다.");

  const csrfResponse = await fetch(authApiUrl(AUTH_API.endpoints.csrf), {
    headers: { Accept: "application/json", ...tunnelHeaders(authApiUrl(AUTH_API.endpoints.csrf)) },
    credentials: "include"
  });
  const csrfPayload = await parseResponse(csrfResponse);
  if (!csrfResponse.ok) throw new Error(errorValue(csrfPayload, "message") || "CSRF 토큰을 발급받지 못했습니다.");

  const cookieName = csrfPayload.data?.cookieName || "XSRF-TOKEN";
  const headerName = csrfPayload.data?.headerName || "X-XSRF-TOKEN";
  const csrfToken = csrfPayload.data?.token || readCookie(cookieName);
  if (!csrfToken) throw new Error("CSRF 쿠키를 읽을 수 없습니다.");
  const storedRefreshToken = sessionStorage.getItem("refreshToken");

  const refreshResponse = await fetch(authApiUrl(AUTH_API.endpoints.refresh), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...tunnelHeaders(authApiUrl(AUTH_API.endpoints.refresh)),
      [headerName]: csrfToken
    },
    body: JSON.stringify(storedRefreshToken ? { refreshToken: storedRefreshToken } : {}),
    credentials: "include"
  });
  const refreshPayload = await parseResponse(refreshResponse);
  if (!refreshResponse.ok) throw new Error(errorValue(refreshPayload, "message") || "로그인 세션을 갱신하지 못했습니다.");

  const accessToken = accessTokenFrom(refreshPayload);
  if (!accessToken) throw new Error("토큰 재발급 응답에 accessToken이 없습니다.");
  sessionStorage.setItem("accessToken", accessToken);
  const rotatedRefreshToken = refreshTokenFrom(refreshPayload);
  if (rotatedRefreshToken) sessionStorage.setItem("refreshToken", String(rotatedRefreshToken).replace(/^Bearer\s+/i, ""));
  return accessToken;
}

export function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = performTokenRefresh()
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function logoutFromBackend() {
  const token = sessionStorage.getItem("accessToken");
  const url = authApiUrl(AUTH_API.endpoints.logout);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...tunnelHeaders(url),
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

async function executeApiRequest(path, options = {}, retry = true) {
  let token = sessionStorage.getItem("accessToken");
  if (token && retry && AUTH_API.enabled && tokenNeedsRefresh(token)) {
    try {
      token = await refreshAccessToken();
    } catch {
      token = null;
    }
  }
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    Accept: "application/json",
    ...tunnelHeaders(url),
    ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  const data = await parseResponse(response);
  if (isAuthenticationFailure(response, data) && retry && AUTH_API.enabled) {
    try {
      await refreshAccessToken();
    } catch {
      // 재발급 쿠키까지 만료된 경우에는 토큰 없이 한 번 재시도해 최종 상태를 확인합니다.
    }
    return executeApiRequest(path, options, false);
  }
  if (!response.ok) {
    const sessionExpired = isAuthenticationFailure(response, data) && !sessionStorage.getItem("accessToken");
    const error = new Error(sessionExpired
      ? "로그인 세션이 만료되었습니다. 다시 로그인해 주세요."
      : errorValue(data, "message") || `요청을 처리하지 못했습니다. (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data.data ?? data;
}

export function apiRequest(path, options = {}) {
  const { dedupeMs, ...requestOptions } = options;
  const method = String(requestOptions.method || "GET").toUpperCase();
  const key = `${method}:${path}:${typeof requestOptions.body === "string" ? requestOptions.body : ""}`;
  const existing = requestInFlight.get(key);
  if (existing) return existing.promise;

  if (method !== "GET") {
    for (const cachedKey of requestInFlight.keys()) {
      if (cachedKey.startsWith("GET:")) requestInFlight.delete(cachedKey);
    }
  }

  const entry = { promise: executeApiRequest(path, requestOptions) };
  requestInFlight.set(key, entry);
  const release = () => {
    setTimeout(() => {
      if (requestInFlight.get(key) === entry) requestInFlight.delete(key);
    }, dedupeMs ?? (method === "GET" ? GET_CACHE_MS : MUTATION_DEDUPE_MS));
  };
  entry.promise.then(release, release);
  return entry.promise;
}

export async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...tunnelHeaders(url) },
    credentials: "include",
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data.data ?? data;
}
