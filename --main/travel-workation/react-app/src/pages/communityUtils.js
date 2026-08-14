export function postImages(post) {
  if (Array.isArray(post.images)) return post.images;
  try { const parsed = JSON.parse(post.images_data || "[]"); if (parsed.length) return parsed; } catch {}
  return post.image_data ? [post.image_data] : [];
}

export function readFiles(files) {
  return Promise.all([...files].slice(0, 5).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}
