export function normalizeImageUrl(value) {
  const url = String(value || "").trim().replace(/^<|>$/g, "").replace(/&amp;/g, "&");
  if (!url) return "";
  if (/^(data:|blob:)/i.test(url) || url.startsWith("/")) return url;
  if (/^https?:/i.test(url)) {
    try {
      const parsed = new URL(url);
      if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {}
    return url;
  }
  return `/${url.replace(/^\/+/, "")}`;
}

export function postImages(post) {
  const imageValue = (image) => normalizeImageUrl(typeof image === "string" ? image : image?.imageUrl || image?.url || image?.path || image?.fileUrl || image?.thumbnailUrl);
  if (Array.isArray(post.images)) return post.images.map(imageValue).filter(Boolean);
  if (Array.isArray(post.imageUrls)) return post.imageUrls.map(normalizeImageUrl).filter(Boolean);
  if (Array.isArray(post.media)) return post.media.map(imageValue).filter(Boolean);
  if (Array.isArray(post.attachments)) return post.attachments.map(imageValue).filter(Boolean);
  for (const raw of [post.images, post.images_data, post.image_data]) {
    if (!raw) continue;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const images = values.map(imageValue).filter(Boolean);
      if (images.length) return images;
    } catch {}
  }
  return [post.thumbnailUrl, post.imageUrl, post.firstImage, post.firstImageUrl].map(normalizeImageUrl).filter(Boolean);
}

export function readFiles(files) {
  return Promise.all([...files].slice(0, 5).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}
