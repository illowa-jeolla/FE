import { apiRequest } from "./client";

const API_BASE = "/api/v1";
const jobBatchCache = new Map();
const JOB_CACHE_MS = 5 * 60 * 1000;

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function externalTourJobsPath({ pageNo = 1, numOfRows = 12, arrange = "D", region = "" } = {}) {
  const page = Number(pageNo);
  const size = Number(numOfRows);
  if (!Number.isInteger(page) || page < 1) throw new Error("페이지 번호가 올바르지 않습니다.");
  if (!Number.isInteger(size) || size < 1) throw new Error("페이지당 결과 수가 올바르지 않습니다.");
  const normalizedRegion = String(region || "").trim();
  return `${API_BASE}/jobs/external/tour/jeonnam-gwangju${queryString({
    pageNo: page,
    numOfRows: size,
    arrange: String(arrange || "D"),
    wrkpAdresText: /^(전체|all)$/i.test(normalizedRegion) ? "" : normalizedRegion
  })}`;
}

export function getExternalTourJobs(params = {}) {
  return apiRequest(externalTourJobsPath(params));
}

export function externalTourJobPath(employmentInfoNo) {
  const id = String(employmentInfoNo || "").trim();
  if (!id) throw new Error("관광 일자리 식별자가 없습니다.");
  return `${API_BASE}/jobs/external/tour/jeonnam-gwangju/${encodeURIComponent(id)}`;
}

export function getExternalTourJob(employmentInfoNo) {
  return apiRequest(externalTourJobPath(employmentInfoNo));
}

export function externalJunnamJobsPath({ startPage = 1, pageSize = 12, numOfRows = 12, region = "" } = {}) {
  const page = Number(startPage);
  const size = Number(pageSize);
  const rowCount = Number(numOfRows);
  if (!Number.isInteger(page) || page < 1) throw new Error("시작 페이지가 올바르지 않습니다.");
  if (!Number.isInteger(size) || size < 1) throw new Error("페이지 크기가 올바르지 않습니다.");
  if (!Number.isInteger(rowCount) || rowCount < 1) throw new Error("페이지당 결과 수가 올바르지 않습니다.");
  const normalizedRegion = String(region || "").trim();
  return `${API_BASE}/jobs/external/junnam${queryString({
    startPage: page,
    pageSize: size,
    numOfRows: rowCount,
    region: /^(전체|all)$/i.test(normalizedRegion) ? "" : normalizedRegion
  })}`;
}

export function getExternalJunnamJobs(params = {}) {
  return apiRequest(externalJunnamJobsPath(params));
}

export function externalJunnamJobPath(jobKey) {
  const key = String(jobKey || "").trim();
  if (!key) throw new Error("전남 공공 일자리 식별자가 없습니다.");
  return `${API_BASE}/jobs/external/junnam/${encodeURIComponent(key)}`;
}

export function getExternalJunnamJob(jobKey) {
  return apiRequest(externalJunnamJobPath(jobKey));
}

export function normalizeExternalJob(job = {}, source) {
  const raw = job.rawFields || {};
  if (source === "junnam") {
    const externalId = job.jobKey || raw.jobKey;
    return {
      ...job,
      externalSource: "junnam",
      externalId,
      id: `junnam:${externalId || raw.jobTitle || job.title || "unknown"}`,
      title: job.title || raw.jobTitle || "제목 미제공",
      employerName: job.companyName || job.writer || raw.jobWriter || "전남 공공 일자리",
      regionName: job.categoryName || raw.jobCategoryNm || "전남",
      category: "전남 공공 일자리",
      location: job.address || raw.jobCategoryNm || "전남"
    };
  }
  const externalId = job.employmentInfoNo || raw.employmentInfoNo;
  return {
    ...job,
    externalSource: "tour",
    externalId,
    id: `tour:${externalId || job.title || "unknown"}`,
    title: job.title || raw.title || "제목 미제공",
    employerName: job.companyName || job.enterpriseTypeName || raw.companyName || "관광 관련 기업",
    regionName: job.regionName || job.workplaceAddress || raw.regionName || "광주·전남",
    category: "관광인 일자리",
    location: job.workplaceAddress || job.address || raw.workplaceAddress || "광주·전남"
  };
}

export function externalJobDetailPath(job) {
  if (job?.externalSource === "tour" && job.externalId) return `/jobs/tour/${encodeURIComponent(job.externalId)}`;
  if (job?.externalSource === "junnam" && job.externalId) return `/jobs/junnam/${encodeURIComponent(job.externalId)}`;
  return "/jobs";
}

function responseItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.jobs)) return data.jobs;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.jobList)) return data.jobList;
  const publicItems = data?.response?.body?.items?.item ?? data?.body?.items?.item;
  if (Array.isArray(publicItems)) return publicItems;
  if (publicItems && typeof publicItems === "object") return [publicItems];
  return [];
}

async function fetchJobBatch(fetchPage, batchPage) {
  const data = await fetchPage(batchPage, 12);
  const items = responseItems(data);
  const total = Number(data?.totalCount ?? data?.totalElements ?? data?.page?.totalElements);
  return { items, hasMore: Number.isFinite(total) ? batchPage * 12 < total : items.length >= 12 };
}

export async function getExternalJobsBatch({ region = "", page = 1 } = {}) {
  const normalizedRegion = String(region || "").trim();
  const cacheKey = `${normalizedRegion}:${page}`;
  const cached = jobBatchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < JOB_CACHE_MS) return cached.promise;

  const promise = fetchJobBatch(
    (pageNo, numOfRows) => getExternalTourJobs({ pageNo, numOfRows, arrange: "D", region: normalizedRegion }),
    page
  ).then(async (tourBatch) => {
    const tourJobs = tourBatch.items.map((job) => normalizeExternalJob(job, "tour"));
    if (tourJobs.length) return { items: tourJobs, hasMore: tourBatch.hasMore };
    const junnamBatch = await fetchJobBatch(
      (startPage, size) => getExternalJunnamJobs({ startPage, pageSize: size, numOfRows: size, region: normalizedRegion }),
      page
    );
    return { items: junnamBatch.items.map((job) => normalizeExternalJob(job, "junnam")), hasMore: junnamBatch.hasMore };
  }).catch((error) => {
    jobBatchCache.delete(cacheKey);
    throw error;
  });

  jobBatchCache.set(cacheKey, { createdAt: Date.now(), promise });
  return promise;
}

export function applyToJob(jobId, message) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/applications`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function getMyJobApplications(params = {}) {
  return apiRequest(`${API_BASE}/jobs/applications${queryString(params)}`);
}

export function cancelJobApplication(applicationId) {
  return apiRequest(`${API_BASE}/job-applications/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
}

export function favoriteJob(job) {
  return apiRequest(`${API_BASE}/jobs/favorites`, {
    method: "POST",
    body: JSON.stringify(job)
  });
}

export function unfavoriteJob(jobId) {
  return apiRequest(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/favorite`, { method: "DELETE" });
}

export function getFavoriteJobs(params = {}) {
  return apiRequest(`${API_BASE}/jobs/favorites${queryString(params)}`);
}
