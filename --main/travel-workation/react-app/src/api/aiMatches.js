import { apiRequest } from "./client";

const API_BASE = "/api/v1";

export function createAiMatch(conditions) {
  return apiRequest(`${API_BASE}/ai-matches`, { method: "POST", body: JSON.stringify(conditions) });
}

export function getAiMatch(requestId) {
  return apiRequest(`${API_BASE}/ai-matches/${encodeURIComponent(requestId)}`);
}

export function getAiMatchResults(requestId) {
  return apiRequest(`${API_BASE}/ai-matches/${encodeURIComponent(requestId)}/results`);
}

export function getAiMatchResult(resultId) {
  return apiRequest(`${API_BASE}/ai-match-results/${encodeURIComponent(resultId)}`);
}

export function retryAiMatch(requestId, conditions) {
  return apiRequest(`${API_BASE}/ai-matches/${encodeURIComponent(requestId)}/retry`, {
    method: "POST",
    body: JSON.stringify(conditions)
  });
}
