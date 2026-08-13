import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, PageIntro } from "../components/UI";
import { regions } from "../data/regions";

export default function GatheringWritePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.capacity = Number(body.capacity);
    try { setError(false); setMessage("게더링을 만드는 중입니다."); await apiRequest("/api/gatherings", { method: "POST", body: JSON.stringify(body) }); navigate("/gatherings"); }
    catch (e) { setError(true); setMessage(e.message); }
  }
  return <main className="page-shell-react narrow-react"><PageIntro eyebrow="CREATE A GATHERING" title="새 게더링을 만들어보세요" description="장소와 시간을 정하고 가까운 여행자를 초대해요." /><form className="editor-react" onSubmit={submit}><label>게더링 이름<input name="title" maxLength="60" placeholder="여수 밤바다 산책" required /></label><div className="form-grid-react"><label>지역<select name="region">{regions.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>장소<input name="location" placeholder="여수 해양공원 입구" required /></label><label>날짜와 시간<input name="eventTime" type="datetime-local" required /></label><label>최대 인원<input name="capacity" type="number" min="2" max="20" defaultValue="6" required /></label><label>콘셉트<input name="concept" placeholder="산책, 미식, 전시" /></label></div><label>상세 설명<textarea name="description" rows="6" maxLength="1000" placeholder="어떤 모임인지 알려주세요." required /></label><div className="editor-actions-react"><Link to="/gatherings">취소</Link><button className="primary-action-react">게더링 만들기</button></div><FormMessage message={message} error={error} /></form></main>;
}
