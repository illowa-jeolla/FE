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

export function getMyProfile() { return apiRequest(API_BASE); }
export function updateMyProfile(profile) { return apiRequest(API_BASE, { method: "PATCH", body: JSON.stringify(profile) }); }
export function deleteMyAccount() { return apiRequest(API_BASE, { method: "DELETE" }); }
export function getMySummary() { return apiRequest(`${API_BASE}/summary`); }
export function getMyVisitedPlaces(params = {}) { return apiRequest(`${API_BASE}/visited-places${queryString(params)}`); }
export function getMyTravelGuides(params = {}) { return apiRequest(`${API_BASE}/travel-guides${queryString(params)}`); }
export function getMyTravelPosts(params = {}) { return apiRequest(`${API_BASE}/travel-posts${queryString(params)}`); }
export function getMyJobApplications(params = {}) { return apiRequest(`${API_BASE}/job-applications${queryString(params)}`); }
export function getMyFavoriteJobs(params = {}) { return apiRequest(`${API_BASE}/favorite-jobs${queryString(params)}`); }
export function getMyGatherings(params = {}) { return apiRequest(`${API_BASE}/gatherings${queryString(params)}`); }
