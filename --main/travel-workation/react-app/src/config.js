const trimSlash = (value = "") => String(value).replace(/\/+$/, "");

export const API_BASE_URL = trimSlash(import.meta.env.VITE_API_BASE_URL || "");
export const KAKAO_MAP_JAVASCRIPT_KEY = String(import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY || "").trim();
export const LEGACY_ORIGIN = trimSlash(
  import.meta.env.VITE_LEGACY_ORIGIN || (import.meta.env.DEV ? "http://localhost:8080" : window.location.origin)
);

export const AUTH_API = Object.freeze({
  enabled: import.meta.env.VITE_AUTH_API_ENABLED === "true",
  origin: trimSlash(import.meta.env.VITE_AUTH_API_ORIGIN || ""),
  basePath: `/${String(import.meta.env.VITE_AUTH_API_BASE_PATH || "/api/v1").replace(/^\/+|\/+$/g, "")}`,
  endpoints: Object.freeze({
    signup: "/auth/signup",
    login: "/auth/login",
    kakao: "/auth/kakao",
    kakaoCallback: "/auth/kakao/callback",
    google: "/auth/google",
    googleCallback: "/auth/google/callback",
    csrf: "/auth/csrf",
    refresh: "/auth/refresh",
    logout: "/auth/logout"
  })
});

export function legacyUrl(path = "") {
  return `${LEGACY_ORIGIN}/${String(path).replace(/^\/+/, "")}`;
}

export function authApiUrl(endpoint) {
  return `${AUTH_API.origin}${AUTH_API.basePath}${endpoint}`;
}
