const { request, requireLogin, setStatus } = Workation;
const form = document.querySelector("#post-form");
const statusElement = document.querySelector("#post-status");
const imageInput = document.querySelector("#post-image");
const preview = document.querySelector("#post-preview");
let selectedImages = [];

function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); }
function renderPreviews() {
  preview.innerHTML = selectedImages.map((item, index) => `<article class="photo-preview-card"><img src="${item.data}" alt="선택한 여행 사진 ${index + 1}">${index === 0 ? '<span>대표 사진</span>' : ""}<button type="button" data-remove-photo="${index}" aria-label="사진 삭제">×</button></article>`).join("") + (selectedImages.length < 5 ? '<button class="photo-add-card" type="button"><span>＋</span><b>사진 추가</b></button>' : "");
}
preview.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-photo]");
  if (removeButton) { selectedImages.splice(Number(removeButton.dataset.removePhoto), 1); renderPreviews(); return; }
  if (event.target.closest(".photo-add-card")) imageInput.click();
});
imageInput.addEventListener("change", async () => {
  const files = [...imageInput.files];
  if (selectedImages.length + files.length > 5) { setStatus(statusElement, "사진은 최대 5장까지 선택할 수 있습니다.", "error"); imageInput.value = ""; return; }
  if (files.some((file) => file.size > 1_000_000)) { setStatus(statusElement, "사진은 한 장당 1MB 이하로 선택해 주세요.", "error"); imageInput.value = ""; return; }
  for (const file of files) selectedImages.push({ file, data: await fileToDataUrl(file) });
  imageInput.value = "";
  setStatus(statusElement);
  renderPreviews();
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(statusElement)) return;
  const values = Object.fromEntries(new FormData(form));
  try {
    setStatus(statusElement, "여행 기록을 공유하는 중입니다.");
    values.imageData = selectedImages.map((item) => item.data);
    const result = await request("/api/posts", { method: "POST", body: JSON.stringify(values) });
    location.href = `community-detail.html?id=${result.id}`;
  } catch (error) { setStatus(statusElement, error.message, "error"); }
});
