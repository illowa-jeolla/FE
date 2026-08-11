const { request, requireLogin, setStatus } = Workation;
const gatheringForm = document.querySelector("#gathering-form");
const formStatus = document.querySelector("#gathering-status");
const timeInput = document.querySelector("#gathering-time");

function localDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

gatheringForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin(formStatus)) return;
  const body = Object.fromEntries(new FormData(gatheringForm));
  body.capacity = Number(body.capacity);
  try {
    setStatus(formStatus, "게더링을 만드는 중입니다.");
    await request("/api/gatherings", { method: "POST", body: JSON.stringify(body) });
    setStatus(formStatus, "게더링을 만들었습니다.", "success");
    setTimeout(() => { location.href = "gatherings.html"; }, 500);
  } catch (error) {
    setStatus(formStatus, error.message, "error");
  }
});

const now = new Date();
timeInput.min = localDateTimeValue(now);
timeInput.value = localDateTimeValue(new Date(now.getTime() + 3_600_000));
