const { request, requireLogin, setStatus, escapeHtml } = Workation;
const postForm = document.querySelector("#post-form");
const postStatus = document.querySelector("#post-status");
const feedStatus = document.querySelector("#feed-status");
const postFeed = document.querySelector("#post-feed");
const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTime(value) {
  return timeFormatter.format(new Date(`${value}Z`));
}

function renderPosts(posts) {
  if (!posts.length) {
    postFeed.innerHTML = "";
    setStatus(feedStatus, "선택한 지역에 24시간 내 등록된 여행이 없습니다.");
    return;
  }
  setStatus(feedStatus);
  postFeed.innerHTML = posts.map((post) => `
    <article class="post-card">
      ${post.image_data ? `<img src="${post.image_data}" alt="${escapeHtml(post.region)} 여행 사진">` : ""}
      <div class="post-body">
        <div class="post-meta"><span>${escapeHtml(post.username)} · ${escapeHtml(post.region)}</span><time>${formatTime(post.created_at)}</time></div>
        <h3>${escapeHtml(post.concept || "지금의 여행")}</h3>
        <p>${escapeHtml(post.content)}</p>
        <div class="comment-list">
          ${(post.comments || []).map((comment) => `<p><strong>${escapeHtml(comment.username)}</strong> ${escapeHtml(comment.content)}</p>`).join("") || "<p>첫 댓글을 남겨보세요.</p>"}
        </div>
        <form class="comment-form" data-post-id="${post.id}">
          <input name="content" maxlength="120" placeholder="댓글 입력" required>
          <button class="button button-primary" type="submit">등록</button>
        </form>
      </div>
    </article>
  `).join("");
}

async function loadPosts() {
  const region = document.querySelector("#post-region-filter").value;
  try {
    setStatus(feedStatus, "최근 게시물을 불러오는 중입니다.");
    const query = region ? `?region=${encodeURIComponent(region)}` : "";
    renderPosts(await request(`/api/posts${query}`));
  } catch (error) {
    setStatus(feedStatus, error.message, "error");
  }
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(postStatus)) return;
  const values = Object.fromEntries(new FormData(postForm));
  const file = document.querySelector("#post-image").files[0];
  if (file && file.size > 1_000_000) {
    setStatus(postStatus, "사진은 1MB 이하로 선택해 주세요.", "error");
    return;
  }
  try {
    setStatus(postStatus, "여행을 공유하는 중입니다.");
    values.imageData = file ? await fileToDataUrl(file) : "";
    await request("/api/posts", { method: "POST", body: JSON.stringify(values) });
    postForm.reset();
    setStatus(postStatus, "여행을 공유했습니다.", "success");
    await loadPosts();
  } catch (error) {
    setStatus(postStatus, error.message, "error");
  }
});

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
