import { apiRequest } from "./client";

const API_BASE = "/api/v1";
const jobBatchCache = new Map();
const allJobCache = new Map();
const JOB_CACHE_MS = 5 * 60 * 1000;
const JOB_PAGE_SIZE = 20;
const ALL_JOB_PAGE_SIZE = 100;
const ALL_JOB_MAX_PAGES = 50;

function firstValue(job, keys) {
  const raw = job?.rawFields || {};
  return keys.map((key) => job?.[key] ?? raw[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function parseJobDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/(20\d{2})[./-]?(\d{1,2})[./-]?(\d{1,2})?/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3] || 1));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isCurrentJob(job, today = new Date()) {
  const deadline = parseJobDate(firstValue(job, ["receiptDeadlineDate", "deadline", "jobEndDt", "jobCloseDt", "applyEndDate", "endDate", "closeDate"]));
  if (deadline && deadline < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return false;
  const registered = parseJobDate(firstValue(job, ["registeredAt", "insertedAt", "jobInsertDt", "createdAt", "created_at"]));
  return !registered || registered.getFullYear() >= today.getFullYear();
}

export function filterCurrentJobs(jobs) {
  return (Array.isArray(jobs) ? jobs : []).filter((job) => isCurrentJob(job));
}

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

function getExternalTourRegionJobs({ pageNo = 1, numOfRows = ALL_JOB_PAGE_SIZE, regionCode, region = "" }) {
  return apiRequest(`${API_BASE}/jobs/external/tour${queryString({ pageNo, numOfRows, arrange: "D", regnCd: regionCode, wrkpAdresText: region })}`);
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

async function fetchJobBatch(fetchPage, batchPage, pageSize = JOB_PAGE_SIZE) {
  const data = await fetchPage(batchPage, pageSize);
  const items = responseItems(data);
  const total = Number(data?.totalCount ?? data?.totalElements ?? data?.page?.totalElements);
  return { items, total: Number.isFinite(total) ? total : items.length, hasMore: Number.isFinite(total) ? batchPage * pageSize < total : items.length >= pageSize };
}

export async function getExternalJobsBatch({ region = "", page = 1 } = {}) {
  const normalizedRegion = String(region || "").trim();
  const cacheKey = `${normalizedRegion}:${page}`;
  const cached = jobBatchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < JOB_CACHE_MS) return cached.promise;

  const promise = Promise.all([
    fetchJobBatch((pageNo, size) => getExternalTourRegionJobs({ pageNo, numOfRows: size, regionCode: "5", region: normalizedRegion }), page),
    fetchJobBatch((pageNo, size) => getExternalTourRegionJobs({ pageNo, numOfRows: size, regionCode: "38", region: normalizedRegion }), page),
    fetchJobBatch((startPage, size) => getExternalJunnamJobs({ startPage, pageSize: size, numOfRows: size, region: normalizedRegion }), page)
  ]).then(([gwangju, jeonnam, junnam]) => {
    const combined = [
      ...gwangju.items.map((job) => normalizeExternalJob(job, "tour")),
      ...jeonnam.items.map((job) => normalizeExternalJob(job, "tour")),
      ...junnam.items.map((job) => normalizeExternalJob(job, "junnam"))
    ];
    const seen = new Set();
    const items = combined.filter((job) => job.id && isCurrentJob(job) && !seen.has(job.id) && seen.add(job.id));
    items.sort((left, right) => String(right.registeredAt || right.insertedAt || right.rawFields?.jobInsertDt || "").localeCompare(String(left.registeredAt || left.insertedAt || left.rawFields?.jobInsertDt || "")));
    return { items, total: gwangju.total + jeonnam.total + junnam.total, hasMore: gwangju.hasMore || jeonnam.hasMore || junnam.hasMore };
  }).catch((error) => {
    jobBatchCache.delete(cacheKey);
    throw error;
  });

  jobBatchCache.set(cacheKey, { createdAt: Date.now(), promise });
  return promise;
}

async function fetchAllPages(fetchPage) {
  const first = await fetchPage(1, ALL_JOB_PAGE_SIZE);
  const firstItems = responseItems(first);
  const total = Number(first?.totalCount ?? first?.totalElements ?? first?.page?.totalElements ?? firstItems.length);
  const pageCount = Math.min(ALL_JOB_MAX_PAGES, Math.max(1, Math.ceil(total / ALL_JOB_PAGE_SIZE)));
  const items = [...firstItems];
  const remaining = Array.from({ length: pageCount - 1 }, (_, index) => index + 2);
  for (let index = 0; index < remaining.length; index += 4) {
    const pages = await Promise.all(remaining.slice(index, index + 4).map((pageNo) => fetchPage(pageNo, ALL_JOB_PAGE_SIZE)));
    pages.forEach((data) => items.push(...responseItems(data)));
  }
  return items;
}

export function getAllExternalJobs({ region = "" } = {}) {
  const normalizedRegion = String(region || "").trim();
  const cacheKey = normalizedRegion || "전체";
  const now = Date.now();
  for (const [key, entry] of allJobCache) {
    if (now - entry.createdAt >= JOB_CACHE_MS) allJobCache.delete(key);
  }
  const cached = allJobCache.get(cacheKey);
  if (cached) return cached.promise;

  const promise = Promise.all([
    fetchAllPages((pageNo, size) => getExternalTourRegionJobs({ pageNo, numOfRows: size, regionCode: "5", region: normalizedRegion })),
    fetchAllPages((pageNo, size) => getExternalTourRegionJobs({ pageNo, numOfRows: size, regionCode: "38", region: normalizedRegion })),
    fetchAllPages((startPage, size) => getExternalJunnamJobs({ startPage, pageSize: size, numOfRows: size, region: normalizedRegion }))
  ]).then(([gwangju, jeonnam, junnam]) => {
    const combined = [
      ...gwangju.map((job) => normalizeExternalJob(job, "tour")),
      ...jeonnam.map((job) => normalizeExternalJob(job, "tour")),
      ...junnam.map((job) => normalizeExternalJob(job, "junnam"))
    ];
    const seen = new Set();
    return combined.filter((job) => job.id && !seen.has(job.id) && seen.add(job.id));
  }).catch((error) => {
    allJobCache.delete(cacheKey);
    throw error;
  });
  allJobCache.set(cacheKey, { createdAt: now, promise });
  return promise;
}

export function createJobApplication(job = {}) {
  const sourceValue = String(firstValue(job, ["source", "externalSource"]) || "").toUpperCase();
  const source = sourceValue.includes("JUNNAM") || firstValue(job, ["jobKey"])
    ? "JUNNAM_PUBLIC_JOB"
    : "TOUR_JOB";
  const externalId = String(firstValue(job, ["externalId", "jobKey", "employmentInfoNo"]) || "").trim();
  const title = String(firstValue(job, ["title", "jobTitle"]) || "").trim();

  if (!externalId) throw new Error("지원할 공고의 식별자가 없습니다.");
  if (!title) throw new Error("지원할 공고의 제목이 없습니다.");

  const optionalText = (keys) => {
    const value = firstValue(job, keys);
    return value === undefined || value === null || String(value).trim() === "" ? undefined : String(value).trim();
  };
  const payload = {
    source,
    externalId,
    title,
    companyName: optionalText(["companyName", "employerName", "enterpriseTypeName", "writer", "jobWriter"]),
    address: optionalText(["address", "workplaceAddress", "location", "regionName", "jobCategoryNm"]),
    deadline: optionalText(["deadline", "receiptDeadlineDate", "jobEndDt", "jobCloseDt", "applyEndDate", "endDate", "closeDate"]),
    sourceUrl: optionalText(["sourceUrl", "detailUrl", "homepageUrl", "url"])
  };

  return apiRequest(`${API_BASE}/jobs/applications`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function applyToJob(job) {
  return createJobApplication(job);
}

export function getMyJobApplications(params = {}) {
  return apiRequest(`${API_BASE}/jobs/applications${queryString(params)}`);
}

export function updateJobApplicationStatus(applicationId, status) {
  const id = String(applicationId ?? "").trim();
  const normalizedStatus = String(status || "").trim().toUpperCase();
  const allowedStatuses = ["APPLIED", "DOCUMENT_PASS", "INTERVIEW", "ACCEPTED", "REJECTED"];
  if (!id) throw new Error("상태를 변경할 지원 기록 ID가 없습니다.");
  if (!allowedStatuses.includes(normalizedStatus)) throw new Error("지원하지 않는 지원 상태입니다.");
  return apiRequest(`${API_BASE}/jobs/applications/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: normalizedStatus })
  });
}

export function cancelJobApplication(applicationId) {
  return apiRequest(`${API_BASE}/job-applications/${encodeURIComponent(applicationId)}`, { method: "DELETE" });
}

export function favoriteJob(job) {
  return apiRequest(`${API_BASE}/jobs/favorites`, {
    method: "POST",
    dedupeMs: 0,
    body: JSON.stringify(job)
  });
}

// JobFavoriteController deletes the saved record by favoriteId.
export function unfavoriteJob(favoriteId) {
  return apiRequest(`${API_BASE}/jobs/favorites/${encodeURIComponent(favoriteId)}`, { method: "DELETE", dedupeMs: 0 });
}

export function getFavoriteJobs(params = {}) {
  return apiRequest(`${API_BASE}/jobs/favorites${queryString(params)}`, { dedupeMs: 0 });
}
