import { apiRequest } from "./client";

const API_BASE = "/api/v1/me";

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function getMyProfile() { return apiRequest("/api/v1/users/me"); }
export function updateMyNickname(nickname) { return apiRequest("/api/v1/users/me/nickname", { method: "PATCH", body: JSON.stringify({ nickname }) }); }
export function deleteMyAccount() { return apiRequest(API_BASE, { method: "DELETE" }); }
export function getMySummary() { return apiRequest(`${API_BASE}/summary`); }
export function getMyVisitedPlaces(params = {}) { return apiRequest(`${API_BASE}/visited-places${queryString(params)}`); }
export function getMyTravelGuides() { return apiRequest("/api/v1/travel-guides/saved"); }
export function getMyTravelPosts(params = {}) { return apiRequest(`/api/v1/community/travel-posts/me${queryString(params)}`); }
export function getMyJobApplications(params = {}) { return apiRequest(`/api/v1/jobs/applications${queryString(params)}`); }
export function getMyFavoriteJobs(params = {}) { return apiRequest(`/api/v1/jobs/favorites${queryString(params)}`); }
export function getMyGatherings(params = { type: "hosted" }) { return apiRequest(`/api/v1/gatherings/me${queryString(params)}`); }
