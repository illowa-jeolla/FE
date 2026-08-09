const { request, requireLogin, setStatus, escapeHtml, wireBookmarkButton, recordRecentView } = Workation;
const detailCard = document.querySelector("#community-detail-card");
const detailStatus = document.querySelector("#detail-status");
const postId = new URLSearchParams(location.search).get("id");

function relativeTime(value) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(`${value}Z`).getTime()) / 60000));
  return minutes < 60 ? `${minutes}분 전` : `${Math.min(24, Math.floor(minutes / 60))}시간 전`;
}

async function loadDetail() {
  if (!postId) return setStatus(detailStatus, "게시글 주소가 올바르지 않습니다.", "error");
  try {
    const post = await request(`/api/posts/${postId}`);
    let images = [];
    try { images = JSON.parse(post.images_data || "[]"); } catch { images = []; }
    if (!images.length && post.image_data) images = [post.image_data];
    let hashtags = [];
    try { hashtags = JSON.parse(post.hashtags || "[]"); } catch { hashtags = []; }
    detailCard.innerHTML = `
      <a class="community-back" href="community.html">← 모든 여행 기록으로</a>
      ${images.length ? `<div class="community-detail-gallery"><img class="community-detail-image" id="community-main-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(post.region)} 여행 사진"><div class="community-detail-thumbs">${images.map((image, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-gallery-image="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt="여행 사진 ${index + 1}"></button>`).join("")}</div></div>` : '<div class="community-detail-image post-image-fallback"></div>'}
      <div class="community-detail-content">
        <div class="community-detail-meta"><span>${escapeHtml(post.region)} · ${escapeHtml(post.nickname || post.username)}</span><time>${relativeTime(post.created_at)}</time></div>
        <h2>${escapeHtml(post.concept || "지금의 여행")}</h2>
        <p class="community-detail-copy">${escapeHtml(post.content)}</p>
        <div class="tag-row">${(hashtags.length ? hashtags : [post.region, "여행기록", "최근24시간"]).map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="community-detail-actions"><button class="icon-action" id="post-bookmark-button" type="button" aria-pressed="false"><span data-bookmark-icon>♡</span><span data-bookmark-label>찜</span></button><a class="button button-small" href="planner.html?itemType=post&itemId=${post.id}">여행 일정에 참고</a></div>
        <section class="community-comments"><h3>댓글 <span>${post.comments.length}</span></h3><div id="detail-comments">${post.comments.map((comment) => `<article><strong>${escapeHtml(comment.nickname || comment.username)}</strong><p>${escapeHtml(comment.content)}</p><time>${relativeTime(comment.created_at)}</time></article>`).join("") || '<p class="empty-comment">첫 댓글을 남겨보세요.</p>'}</div>
          <form class="community-comment-form" id="detail-comment-form"><input name="content" maxlength="120" placeholder="여행 이야기에 댓글을 남겨보세요" required><button class="button button-primary" type="submit">등록</button></form>
          <div class="page-status" id="comment-status"></div>
        </section>
      </div>`;
    document.querySelector("#detail-comment-form").addEventListener("submit", submitComment);
    wireBookmarkButton(document.querySelector("#post-bookmark-button"), "post", Number(postId));
    recordRecentView("post", Number(postId));
    document.querySelector(".community-detail-thumbs")?.addEventListener("click", (event) => { const button = event.target.closest("[data-gallery-image]"); if (!button) return; document.querySelector("#community-main-image").src = button.dataset.galleryImage; document.querySelectorAll(".community-detail-thumbs button").forEach((item) => item.classList.toggle("is-active", item === button)); });
  } catch (error) { setStatus(detailStatus, error.message, "error"); }
}

async function submitComment(event) {
  event.preventDefault();
  const status = document.querySelector("#comment-status");
  if (!requireLogin(status)) return;
  try {
    const content = new FormData(event.currentTarget).get("content");
    await request(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ content }) });
    await loadDetail();
  } catch (error) { setStatus(status, error.message, "error"); }
}

loadDetail();
