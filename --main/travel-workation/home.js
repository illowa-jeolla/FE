const { request } = Workation;

async function loadHomeStats() {
  try {
    const stats = await request("/api/stats");
    document.querySelector("#region-stat").textContent = `${Number(stats.regionCount || 0)}개`;
    document.querySelector("#job-stat").textContent = `${Number(stats.jobCount || 0)}개`;
    document.querySelector("#rating-stat").textContent = stats.averageRating == null ? "정보 없음" : Number(stats.averageRating).toFixed(1);
  } catch {
    document.querySelector("#region-stat").textContent = "-";
    document.querySelector("#job-stat").textContent = "-";
    document.querySelector("#rating-stat").textContent = "-";
  }
}

const storedUsername = sessionStorage.getItem("username");
if (storedUsername) {
  const headerLink = document.querySelector("[data-auth-link]");
  const cardLink = document.querySelector("[data-auth-card-link]");
  headerLink.textContent = storedUsername;
  headerLink.href = "local-fit.html";
  cardLink.querySelector("span").textContent = "내 로컬 핏 보기";
  cardLink.href = "local-fit.html";
}

loadHomeStats();
