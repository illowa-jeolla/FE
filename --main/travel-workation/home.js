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
  const storedNickname = sessionStorage.getItem("nickname") || (storedUsername === "qwer" ? "운영자" : "");
  const headerLink = document.querySelector("[data-auth-link]");
  const cardLink = document.querySelector("[data-auth-card-link]");
  headerLink.textContent = storedNickname || storedUsername;
  headerLink.href = "local-fit.html";
  cardLink.querySelector("span").textContent = "내 로컬 핏 보기";
  cardLink.href = "local-fit.html";
}

document.querySelectorAll(".home-feature-card").forEach((card) => {
  const openCard = () => {
    const link = card.querySelector(".home-feature-card__button");
    if (link?.href) window.location.href = link.href;
  };
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.addEventListener("click", (event) => {
    if (!event.target.closest("a")) openCard();
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openCard();
    }
  });
});

loadHomeStats();
