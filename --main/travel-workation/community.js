const { request, requireLogin, setStatus, escapeHtml } = Workation;
const feedStatus = document.querySelector("#feed-status");
const postFeed = document.querySelector("#post-feed");

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTime(value) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(`${value}Z`).getTime()) / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : "24시간 전";
}

function renderPosts(posts) {
  if (!posts.length) {
    postFeed.innerHTML = "";
    setStatus(feedStatus, "선택한 지역에 24시간 내 등록된 여행이 없습니다.");
    return;
  }
  setStatus(feedStatus);
  postFeed.innerHTML = posts.map((post) => `
    <a class="post-card" href="community-detail.html?id=${post.id}">
      ${post.image_data ? `<img src="${escapeHtml(post.image_data)}" alt="${escapeHtml(post.region)} 여행 사진">` : '<div class="post-image-fallback" aria-hidden="true"></div>'}
      <div class="post-body">
        <div class="post-meta"><span>${escapeHtml(post.region)}</span><time>${formatTime(post.created_at)}</time></div>
        <h3>${escapeHtml(post.concept || "지금의 여행")}</h3>
        <p>${escapeHtml(post.content)}</p>
        <div class="post-card-footer"><span>@${escapeHtml(post.nickname || post.username)}</span><span>댓글 ${(post.comments || []).length}</span></div>
      </div>
    </a>
  `).join("");
}

async function loadPosts() {
  const region = document.querySelector("#post-region-filter").value;
  document.querySelector("#community-filter-notice").textContent = region
    ? `${region} · 최근 24시간 여행 기록이에요.`
    : "전라도 전체 · 최근 24시간 여행 기록이에요.";
  try {
    setStatus(feedStatus, "최근 게시물을 불러오는 중입니다.");
    const query = region ? `?region=${encodeURIComponent(region)}` : "";
    renderPosts(await request(`/api/posts${query}`));
  } catch (error) {
    setStatus(feedStatus, error.message, "error");
  }
}

document.querySelector("#post-filter-button").addEventListener("click", loadPosts);

postFeed.addEventListener("submit", async (event) => {
  const commentForm = event.target.closest(".comment-form");
  if (!commentForm) return;
  event.preventDefault();
  if (!requireLogin(feedStatus)) return;
  try {
    const content = new FormData(commentForm).get("content");
    await request(`/api/posts/${commentForm.dataset.postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    await loadPosts();
  } catch (error) {
    setStatus(feedStatus, error.message, "error");
  }
});

loadPosts();
