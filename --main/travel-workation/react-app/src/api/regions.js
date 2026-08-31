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

export function getRegions(params = { parentId: 1 }) {
  return apiRequest(`${API_BASE}/regions${queryString(params)}`);
}

export function getRegion(regionId) {
  return apiRequest(`${API_BASE}/regions/${encodeURIComponent(regionId)}`);
}

export function getRegionPlaces(regionId, params = {}) {
  return apiRequest(`${API_BASE}/regions/${encodeURIComponent(regionId)}/places${queryString(params)}`);
}

export function getPlace(placeId) {
  return apiRequest(`${API_BASE}/places/${encodeURIComponent(placeId)}`);
}

export function getPlaceReviews(placeId, params = {}) {
  return apiRequest(`${API_BASE}/places/${encodeURIComponent(placeId)}/reviews${queryString(params)}`);
}

export function createPlaceReview(placeId, review) {
  return apiRequest(`${API_BASE}/places/${encodeURIComponent(placeId)}/reviews`, {
    method: "POST",
    body: JSON.stringify(review)
  });
}

export function updatePlaceReview(reviewId, review) {
  return apiRequest(`${API_BASE}/place-reviews/${encodeURIComponent(reviewId)}`, {
    method: "PUT",
    body: JSON.stringify(review)
  });
}

export function deletePlaceReview(reviewId) {
  return apiRequest(`${API_BASE}/place-reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
}

export function addPlaceVisit(placeId) {
  return apiRequest(`${API_BASE}/places/${encodeURIComponent(placeId)}/visits`, { method: "POST" });
}

export function deletePlaceVisit(placeId) {
  return apiRequest(`${API_BASE}/places/${encodeURIComponent(placeId)}/visits`, { method: "DELETE" });
}
