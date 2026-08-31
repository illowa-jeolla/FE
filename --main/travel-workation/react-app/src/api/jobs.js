import { apiRequest } from "./client";

const API_BASE = "/api/v1";

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function getJobs(params = {}) {
  return apiRequest(`${API_BASE}/jobs${queryString(params)}`);
}

export function getJob(jobId) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`);
}

export function applyToJob(jobId, message) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/applications`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function getMyJobApplications(params = {}) {
  return apiRequest(`${API_BASE}/me/job-applications${queryString(params)}`);
}

export function cancelJobApplication(applicationId) {
  return apiRequest(`${API_BASE}/job-applications/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
}

export function favoriteJob(jobId) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/favorite`, { method: "POST" });
}

export function unfavoriteJob(jobId) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/favorite`, { method: "DELETE" });
}

export function getFavoriteJobs(params = {}) {
  return apiRequest(`${API_BASE}/me/favorite-jobs${queryString(params)}`);
}
