import { apiRequest } from "./client";

const API_BASE = "/api/v1";

export async function getExternalTourJobs({ pageNo = 1, numOfRows = 12, arrange = "D" } = {}) {
  const page = Number(pageNo);
  const size = Number(numOfRows);
  if (!Number.isInteger(page) || page < 1) throw new Error("페이지 번호가 올바르지 않습니다.");
  if (!Number.isInteger(size) || size < 1) throw new Error("페이지당 결과 수가 올바르지 않습니다.");
  const params = new URLSearchParams({ pageNo: String(page), numOfRows: String(size), arrange: String(arrange || "D") });
  return apiRequest(`${API_BASE}/jobs/external/tour/jeonnam-gwangju?${params}`);
}

export async function getExternalTourJob(employmentInfoNo) {
  const id = String(employmentInfoNo || "").trim();
  if (!id) throw new Error("일자리 식별자가 없습니다.");
  return apiRequest(`${API_BASE}/jobs/external/tour/${encodeURIComponent(id)}`);
}

export async function getExternalJunnamJobs({ startPage = 1, pageSize = 12, numOfRows = 12, region = "" } = {}) {
  const params = new URLSearchParams({ startPage: String(Math.max(1, Number(startPage) || 1)), pageSize: String(Math.max(1, Number(pageSize) || 12)), numOfRows: String(Math.max(1, Number(numOfRows) || 12)) });
  const normalizedRegion = String(region || "").trim();
  if (normalizedRegion && !/^(전체|all)$/i.test(normalizedRegion)) params.set("region", normalizedRegion);
  return apiRequest(`${API_BASE}/jobs/external/junnam?${params}`);
}

export async function getExternalJunnamJob(jobKey) {
  const key = String(jobKey || "").trim();
  if (!key) throw new Error("일자리 식별자가 없습니다.");
  return apiRequest(`${API_BASE}/jobs/external/junnam/${encodeURIComponent(key)}`);
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} 정보가 올바르지 않습니다.`);
  return number;
}

function searchParams({ regionId, query, size = 10 }) {
  const keyword = String(query || "").trim();
  if (!keyword) throw new Error("검색어를 입력해 주세요.");
  if (keyword.length > 100) throw new Error("검색어는 100자 이하로 입력해 주세요.");

  return new URLSearchParams({
    regionId: String(positiveInteger(regionId, "지역")),
    query: keyword,
    size: String(Math.max(1, Math.min(15, Number(size) || 10)))
  });
}

export async function searchAccommodations({ regionId, query, size = 10 }) {
  const params = searchParams({ regionId, query, size });
  const data = await apiRequest(`${API_BASE}/locations/search?${params}`);
  return data.items || [];
}

export async function searchRoutePoints({ regionId, query, size = 10 }) {
  const params = searchParams({ regionId, query, size });
  const data = await apiRequest(`${API_BASE}/locations/route-points/search?${params}`);
  return data.items || [];
}

export async function getNearbyManualPlaces({ latitude, longitude, pageNo = 1 }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const page = Number(pageNo);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("숙소 위도 정보가 올바르지 않습니다.");
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("숙소 경도 정보가 올바르지 않습니다.");
  if (!Number.isInteger(page) || page < 1) throw new Error("페이지 번호가 올바르지 않습니다.");

  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lng), pageNo: String(page) });
  return apiRequest(`${API_BASE}/travel-guides/manual/places/nearby?${params}`);
}

export async function requestTravelRecommendation(payload) {
  return apiRequest(`${API_BASE}/travel-recommendations`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getTravelRecommendationStatus(requestId) {
  return apiRequest(`${API_BASE}/travel-recommendations/${positiveInteger(requestId, "추천 요청")}`);
}

export async function getTravelGuideDraft(draftId) {
  return apiRequest(`${API_BASE}/travel-guides/drafts/${positiveInteger(draftId, "여행안")}`);
}

export async function getTravelGuideDrafts() {
  return apiRequest(`${API_BASE}/travel-guides/drafts`);
}

export async function requestTravelGuideAlternative(draftId) {
  return apiRequest(`${API_BASE}/travel-guides/drafts/${positiveInteger(draftId, "여행안")}/alternatives`, {
    method: "POST"
  });
}

export async function saveTravelGuideDraft(draftId) {
  return apiRequest(`${API_BASE}/travel-guides/drafts/${positiveInteger(draftId, "여행안")}/save`, {
    method: "POST"
  });
}

export async function getSavedTravelGuides() {
  return apiRequest(`${API_BASE}/travel-guides/saved`);
}

export async function getDeletedSavedTravelGuides() {
  return apiRequest(`${API_BASE}/travel-guides/saved/deleted`);
}

export async function getSavedTravelGuide(guideId) {
  return apiRequest(`${API_BASE}/travel-guides/${positiveInteger(guideId, "여행 가이드")}`);
}

export async function removeSavedTravelGuide(guideId) {
  return apiRequest(`${API_BASE}/travel-guides/saved/${positiveInteger(guideId, "여행 가이드")}`, {
    method: "DELETE"
  });
}

export async function restoreSavedTravelGuide(guideId) {
  return apiRequest(`${API_BASE}/travel-guides/saved/${positiveInteger(guideId, "여행 가이드")}/restore`, {
    method: "POST"
  });
}

export async function waitForTravelRecommendation(requestId, { interval = 1200, timeout = 90000 } = {}) {
  const startedAt = Date.now();
  let latest;

  while (Date.now() - startedAt < timeout) {
    latest = await getTravelRecommendationStatus(requestId);
    if (latest.status === "COMPLETED") return latest;
    if (latest.status === "FAILED") throw new Error(latest.message || "여행 추천을 생성하지 못했습니다.");
    await new Promise((resolve) => window.setTimeout(resolve, interval));
  }

  throw new Error("여행 추천 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
}
