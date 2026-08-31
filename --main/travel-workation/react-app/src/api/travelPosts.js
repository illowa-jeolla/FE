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

export function getTravelPosts(params = {}) {
  return apiRequest(`${API_BASE}/travel-posts${queryString(params)}`);
}

export function getTravelPost(postId) {
  return apiRequest(`${API_BASE}/travel-posts/${encodeURIComponent(postId)}`);
}

export function createTravelPost(post) {
  return apiRequest(`${API_BASE}/travel-posts`, { method: "POST", body: JSON.stringify(post) });
}

export function updateTravelPost(postId, post) {
  return apiRequest(`${API_BASE}/travel-posts/${encodeURIComponent(postId)}`, { method: "PUT", body: JSON.stringify(post) });
}

export function deleteTravelPost(postId) {
  return apiRequest(`${API_BASE}/travel-posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

export function createTravelComment(postId, content) {
  return apiRequest(`${API_BASE}/travel-posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ content }) });
}

export function updateTravelComment(commentId, content) {
  return apiRequest(`${API_BASE}/travel-comments/${encodeURIComponent(commentId)}`, { method: "PUT", body: JSON.stringify({ content }) });
}

export function deleteTravelComment(commentId) {
  return apiRequest(`${API_BASE}/travel-comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
}

export function likeTravelPost(postId) {
  return apiRequest(`${API_BASE}/travel-posts/${encodeURIComponent(postId)}/like`, { method: "POST" });
}

export function unlikeTravelPost(postId) {
  return apiRequest(`${API_BASE}/travel-posts/${encodeURIComponent(postId)}/like`, { method: "DELETE" });
}

export function getMyTravelPosts(params = {}) {
  return apiRequest(`${API_BASE}/me/travel-posts${queryString(params)}`);
}
