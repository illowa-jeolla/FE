const trimSlash = (value = "") => String(value).replace(/\/+$/, "");

export const API_BASE_URL = trimSlash(import.meta.env.VITE_API_BASE_URL || "");
export const KAKAO_MAP_JAVASCRIPT_KEY = String(import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY || "").trim();

export const AUTH_API = Object.freeze({
  enabled: import.meta.env.VITE_AUTH_API_ENABLED !== "false",
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

export function authApiUrl(endpoint) {
  return `${AUTH_API.origin}${AUTH_API.basePath}${endpoint}`;
}
