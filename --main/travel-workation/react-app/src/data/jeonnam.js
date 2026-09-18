export const jeonnamRegions = ["강진", "고흥", "곡성", "광양", "구례", "나주", "담양", "목포", "무안", "보성", "순천", "신안", "여수", "영광", "영암", "완도", "장성", "장흥", "진도", "함평", "해남", "화순"];

export function jeonnamRegionName(value) {
  const name = String(value || "").trim().replace(/^(전라남도|전남)\s*/, "").replace(/[시군]$/, "");
  return jeonnamRegions.includes(name) ? name : "";
}

// Use location fields only: a title or employer mentioning Jeonnam is not a workplace.
export function isJeonnamJob(job) {
  const raw = job.rawFields || {};
  const location = String(job.workplaceAddress || raw.workplaceAddress || job.address || raw.jobAddress || job.categoryName || raw.jobCategoryNm || job.regionName || job.location || "").trim();
  if (/^(전북|전라북도|전북특별자치도|광주|서울|부산|대구|인천|대전|울산|세종|경기|강원|충북|충청북도|충남|충청남도|경북|경상북도|경남|경상남도|제주)/.test(location)) return false;
  if (/^(전라남도|전남)(?:\s|$)/.test(location)) return true;
  return jeonnamRegions.some((name) => new RegExp(`^${name}(?:시|군)?(?:\\s|$)`).test(location));
}
