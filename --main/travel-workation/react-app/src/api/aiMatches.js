import { apiRequest } from "./client";

const API_BASE = "/api/v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requestPath(requestId) {
  const id = String(requestId || "").trim();
  if (!UUID_PATTERN.test(id)) throw new Error("AI 매칭 요청 ID가 올바르지 않습니다.");
  return `${API_BASE}/ai-matches/${encodeURIComponent(id)}`;
}

export function createAiMatch(conditions) {
  return apiRequest(`${API_BASE}/ai-matches`, { method: "POST", body: JSON.stringify(conditions) });
}

export function getAiMatch(requestId) {
  return apiRequest(requestPath(requestId), { dedupeMs: 0 });
}

export function getAiMatches({ page = 0, size = 20 } = {}) {
  const pageNumber = Number(page);
  const pageSize = Number(size);
  if (!Number.isInteger(pageNumber) || pageNumber < 0) throw new Error("페이지 번호가 올바르지 않습니다.");
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("페이지 크기가 올바르지 않습니다.");
  const query = new URLSearchParams({ page: String(pageNumber), size: String(pageSize) });
  return apiRequest(`${API_BASE}/ai-matches?${query}`);
}

export function deleteAiMatch(requestId) {
  return apiRequest(requestPath(requestId), { method: "DELETE" });
}
