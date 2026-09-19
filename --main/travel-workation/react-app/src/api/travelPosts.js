import { apiRequest } from "./client";

const API_BASE = "/api/v1";
const COMMUNITY_BASE = `${API_BASE}/community`;
const POSTS_BASE = `${COMMUNITY_BASE}/travel-posts`;
const DRAFTS_BASE = `${POSTS_BASE}/drafts`;

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function getTravelPosts(params = {}) {
  const page = Number(params.page ?? 0);
  const size = Number(params.size ?? 20);
  if (!Number.isInteger(page) || page < 0) throw new Error("페이지 번호는 0 이상이어야 합니다.");
  if (!Number.isInteger(size) || size < 1 || size > 50) throw new Error("페이지 크기는 1 이상 50 이하여야 합니다.");
  return apiRequest(`${POSTS_BASE}${queryString({ ...params, page, size })}`);
}

export function getTravelPost(postId) {
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}`);
}

export function createTravelPost(post) {
  return apiRequest(POSTS_BASE, { method: "POST", body: JSON.stringify(post) });
}

export function startTravelPostDraft() {
  return apiRequest(DRAFTS_BASE, { method: "POST" });
}

export function updateTravelPost(postId, post) {
  if (!postId) throw new Error("수정할 게시글 ID가 필요합니다.");
  if (!post.regionId) throw new Error("게시글 지역은 필수입니다.");
  if (!String(post.title || "").trim()) throw new Error("게시글 제목은 필수입니다.");
  if (!String(post.content || "").trim()) throw new Error("게시글 본문은 필수입니다.");
  const body = {
    regionId: Number(post.regionId),
    title: String(post.title).trim().slice(0, 200),
    ...(post.concept != null ? { concept: String(post.concept).trim().slice(0, 100) } : {}),
    content: String(post.content).trim(),
    ...(Array.isArray(post.imageIds) ? { imageIds: post.imageIds.map(Number) } : {})
  };
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteTravelPost(postId) {
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}`, { method: "DELETE" });
}

export function uploadTravelPostImage(postId, file) {
  if (!postId) throw new Error("이미지를 추가할 게시글 ID가 필요합니다.");
  if (!(file instanceof File)) throw new Error("업로드할 이미지 파일이 필요합니다.");
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) throw new Error("사진 또는 동영상 파일만 업로드할 수 있습니다.");
  if (file.size > 50 * 1024 * 1024) throw new Error("파일은 50MB 이하여야 합니다.");
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/images`, {
    method: "POST",
    body: formData
  });
}

export function deleteTravelPostImage(postId, imageId) {
  if (!postId) throw new Error("이미지를 삭제할 게시글 ID가 필요합니다.");
  if (!imageId) throw new Error("삭제할 이미지 ID가 필요합니다.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/images/${encodeURIComponent(imageId)}`, {
    method: "DELETE"
  });
}

export function createTravelComment(postId, content, secret = false) {
  if (!postId) throw new Error("댓글을 작성할 게시글 ID가 필요합니다.");
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) throw new Error("댓글 내용을 입력해 주세요.");
  if (normalizedContent.length > 2000) throw new Error("댓글은 2000자 이하로 입력해 주세요.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ content: normalizedContent, secret: Boolean(secret) })
  });
}

export function getTravelComments(postId, params = {}) {
  if (!postId) throw new Error("댓글을 조회할 게시글 ID가 필요합니다.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/comments${queryString(params)}`);
}

export function updateTravelComment(postId, commentId, content, secret = false) {
  if (!postId) throw new Error("댓글이 속한 게시글 ID가 필요합니다.");
  if (!commentId) throw new Error("수정할 댓글 ID가 필요합니다.");
  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) throw new Error("댓글 내용을 입력해 주세요.");
  if (normalizedContent.length > 2000) throw new Error("댓글은 2000자 이하로 입력해 주세요.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH",
    body: JSON.stringify({ content: normalizedContent, secret: Boolean(secret) })
  });
}

export function deleteTravelComment(postId, commentId) {
  if (!postId) throw new Error("댓글이 속한 게시글 ID가 필요합니다.");
  if (!commentId) throw new Error("삭제할 댓글 ID가 필요합니다.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE"
  });
}

export function likeTravelPost(postId) {
  if (!postId) throw new Error("좋아요를 등록할 게시글 ID가 필요합니다.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/likes`, { method: "POST" });
}

export function unlikeTravelPost(postId) {
  if (!postId) throw new Error("좋아요를 취소할 게시글 ID가 필요합니다.");
  return apiRequest(`${POSTS_BASE}/${encodeURIComponent(postId)}/likes`, { method: "DELETE" });
}

export function getMyTravelPosts(params = {}) {
  return apiRequest(`${API_BASE}/community/travel-posts/me${queryString(params)}`);
}

export function saveTravelPostDraft(draftId, draft) {
  if (!draftId) throw new Error("저장할 게시글 Draft ID가 필요합니다.");
  const body = {
    ...(draft.regionId ? { regionId: Number(draft.regionId) } : {}),
    ...(draft.title != null ? { title: String(draft.title).slice(0, 200) } : {}),
    ...(draft.concept != null ? { concept: String(draft.concept).slice(0, 100) } : {}),
    ...(draft.content != null ? { content: String(draft.content) } : {}),
    ...(Array.isArray(draft.imageIds) ? { imageIds: draft.imageIds.map(Number) } : {})
  };
  return apiRequest(`${DRAFTS_BASE}/${encodeURIComponent(draftId)}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function deleteTravelPostDraft(draftId) {
  if (!draftId) throw new Error("삭제할 게시글 Draft ID가 필요합니다.");
  return apiRequest(`${DRAFTS_BASE}/${encodeURIComponent(draftId)}`, {
    method: "DELETE"
  });
}

export function publishTravelPostDraft(draftId) {
  if (!draftId) throw new Error("게시할 Draft ID가 필요합니다.");
  return apiRequest(`${DRAFTS_BASE}/${encodeURIComponent(draftId)}/publish`, {
    method: "POST"
  });
}

export function uploadTravelPostDraftImage(draftId, file) {
  if (!draftId) throw new Error("이미지를 추가할 Draft ID가 필요합니다.");
  if (!(file instanceof File)) throw new Error("업로드할 이미지 파일이 필요합니다.");
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) throw new Error("사진 또는 동영상 파일만 업로드할 수 있습니다.");
  if (file.size > 50 * 1024 * 1024) throw new Error("파일은 50MB 이하여야 합니다.");
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(`${DRAFTS_BASE}/${encodeURIComponent(draftId)}/images`, {
    method: "POST",
    body: formData
  });
}

export function deleteTravelPostDraftImage(draftId, imageId) {
  if (!draftId) throw new Error("이미지를 삭제할 Draft ID가 필요합니다.");
  if (!imageId) throw new Error("삭제할 이미지 ID가 필요합니다.");
  return apiRequest(`${DRAFTS_BASE}/${encodeURIComponent(draftId)}/images/${encodeURIComponent(imageId)}`, {
    method: "DELETE"
  });
}
