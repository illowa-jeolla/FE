import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { regions } from "../data/regions";
import { authApiUrl } from "../config";

function toKoreaOffsetDateTime(value) {
  return value ? `${value.length === 16 ? `${value}:00` : value}+09:00` : "";
}

export default function GatheringWritePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.capacity = Number(body.capacity);
    body.startsAt = toKoreaOffsetDateTime(body.startsAt);
    if (new Date(body.startsAt).getTime() <= Date.now()) {
      setError(true); setMessage("날짜와 시간은 현재보다 미래여야 합니다."); return;
    }
    try { setError(false); setMessage("게더링을 만드는 중입니다."); await apiRequest(authApiUrl("/gatherings"), { method: "POST", body: JSON.stringify(body) }); const date = body.startsAt.slice(0, 10); navigate("/gatherings", { state: { region: body.region, startsOn: date, endsOn: date } }); }
    catch (e) { setError(true); setMessage(e.message); }
  }
  return <main className="feature-page-main gathering-write-main"><section className="page-intro"><div><p className="eyebrow dark">CREATE A GATHERING</p><h1>새 게더링을 만들어보세요</h1></div><div className="page-intro-actions"><Link className="button" to="/gatherings">목록으로 돌아가기</Link></div></section><section className="page-panel gathering-write-panel"><form className="stack-form" onSubmit={submit}><label>모임 이름<input name="title" maxLength="60" placeholder="예: 여수 밤바다 펍투어" required /></label><div className="form-row"><label>지역<select name="region" required><option value="">지역 선택</option>{regions.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>정원<input name="capacity" type="number" min="2" max="100" defaultValue="4" required /></label></div><label>만날 장소<input name="meetingPlace" maxLength="255" placeholder="정확한 만남 장소" required /></label><div className="form-row"><label>날짜와 시간<input name="startsAt" type="datetime-local" required /></label><label>콘셉트<input name="concept" maxLength="100" placeholder="펍투어, 미식, 전시, 산책" required /></label></div><label>모임 설명<textarea name="description" maxLength="500" rows="5" placeholder="어떤 모임인지, 무엇을 함께 하는지, 준비물이나 참고 사항을 알려주세요." required /></label><button className="button button-primary">게더링 만들기</button><div className={`page-status${message ? " is-visible" : ""}${error ? " is-error" : ""}`} role="status">{message}</div></form></section></main>;
}
