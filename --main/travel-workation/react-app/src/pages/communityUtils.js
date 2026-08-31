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
  if (Array.isArray(post.images)) return post.images.map((image) => normalizeImageUrl(typeof image === "string" ? image : image.imageUrl || image.url)).filter(Boolean);
  if (Array.isArray(post.imageUrls)) return post.imageUrls.map(normalizeImageUrl).filter(Boolean);
  if (post.thumbnailUrl) return [normalizeImageUrl(post.thumbnailUrl)].filter(Boolean);
  try { const parsed = JSON.parse(post.images_data || "[]"); if (parsed.length) return parsed.map(normalizeImageUrl).filter(Boolean); } catch {}
  return post.image_data ? [normalizeImageUrl(post.image_data)].filter(Boolean) : [];
}

export function readFiles(files) {
  return Promise.all([...files].slice(0, 5).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}
