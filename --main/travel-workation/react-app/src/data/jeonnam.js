export const jeonnamRegions = ["강진", "고흥", "곡성", "광양", "구례", "나주", "담양", "목포", "무안", "보성", "순천", "신안", "여수", "영광", "영암", "완도", "장성", "장흥", "진도", "함평", "해남", "화순"];

export function isJeonnamRegion(value = "") {
  return jeonnamRegions.some((region) => String(value).includes(region));
}

export function jeonnamRegionName(value) {
  const name = String(value || "").trim().replace(/^(전라남도|전남)\s*/, "").replace(/[시군]$/, "");
  return jeonnamRegions.includes(name) ? name : "";
}

// Travel APIs use different location field names. Keep the decision whitelist-only.
export function isJeonnamTravelItem(item = {}, fallbackRegion = "") {
  return isJeonnamRegion([
    item.region,
    item.regionName,
    item.address,
    item.roadAddress,
    item.location,
    fallbackRegion
  ].filter(Boolean).join(" "));
}

// Use location fields only: a title or employer mentioning Jeonnam is not a workplace.
export function isJeonnamJob(job) {
  const raw = job.rawFields || {};
  const location = String(job.workplaceAddress || raw.workplaceAddress || job.address || raw.jobAddress || job.categoryName || raw.jobCategoryNm || job.regionName || job.location || "").trim();
  return isJeonnamRegion(location);
}
