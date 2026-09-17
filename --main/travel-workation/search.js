const { request, escapeHtml, setStatus } = Workation;
const form = document.querySelector("#search-form");
const queryInput = document.querySelector("#search-query");
const results = document.querySelector("#search-results");
const status = document.querySelector("#search-status");

function searchHistory() {
  try { return JSON.parse(localStorage.getItem("workationRecentSearches") || "[]"); } catch { return []; }
}

function saveSearch(query) {
  const next = [query, ...searchHistory().filter((item) => item !== query)].slice(0, 6);
  localStorage.setItem("workationRecentSearches", JSON.stringify(next));
  renderHistory();
}

function renderHistory() {
  const entries = searchHistory();
  document.querySelector("#recent-searches").hidden = !entries.length;
  document.querySelector("#recent-search-list").innerHTML = entries.map((entry) => `<button type="button" data-search-query="${escapeHtml(entry)}">${escapeHtml(entry)}</button>`).join("");
}

function resultSection(title, items, renderItem) {
  return `<section><div class="search-result-title"><h2>${title}</h2><span>${items.length}건</span></div><div class="search-result-list">${items.length ? items.map(renderItem).join("") : '<p class="search-empty">검색 결과가 없어요.</p>'}</div></section>`;
}

async function runSearch(query) {
  setStatus(status, "검색하고 있습니다.");
  results.hidden = true;
  try {
    const data = await request(`/api/search?q=${encodeURIComponent(query)}`);
    saveSearch(query);
    results.innerHTML = [
      resultSection("관광지", data.destinations, (item) => `<a href="recommend.html?destination=${item.id}"><span>관광지 · ${escapeHtml(item.region)}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category || item.description || "")}</p></a>`),
      resultSection("일자리", data.jobs, (item) => `<a href="job-detail.html?id=${item.id}"><span>일자리 · ${escapeHtml(item.region)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.companyName || "지역 사업장")} · ${escapeHtml(item.pay || "급여 협의")}</p></a>`),
      resultSection("여행 이야기", data.posts, (item) => `<a href="community-detail.html?id=${item.id}"><span>여행 이야기 · ${escapeHtml(item.region)}</span><strong>${escapeHtml(item.concept || `${item.region} 여행`)}</strong><p>${escapeHtml(item.content)}</p></a>`),
      resultSection("게더링", data.gatherings, (item) => `<a href="gatherings.html"><span>게더링 · ${escapeHtml(item.region)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.concept || item.description || "")}</p></a>`)
    ].join("");
    results.hidden = false;
    setStatus(status);
  } catch (error) { setStatus(status, error.message, "error"); }
}

form.addEventListener("submit", (event) => { event.preventDefault(); runSearch(queryInput.value.trim()); });
document.querySelector("#recent-search-list").addEventListener("click", (event) => { const button = event.target.closest("[data-search-query]"); if (!button) return; queryInput.value = button.dataset.searchQuery; runSearch(button.dataset.searchQuery); });
document.querySelector("#clear-searches").addEventListener("click", () => { localStorage.removeItem("workationRecentSearches"); renderHistory(); });
const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery) { queryInput.value = initialQuery; runSearch(initialQuery); }
renderHistory();
