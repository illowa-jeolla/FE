import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { getRegions } from "../api/regions";
import { hasSession } from "../auth/session";
import { authApiUrl } from "../config";
import { asList } from "../hooks/useApi";

function toKoreaOffsetDateTime(value) {
  return value ? `${value.length === 16 ? `${value}:00` : value}+09:00` : "";
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function GatheringWritePage() {
  const navigate = useNavigate(); const { id } = useParams(); const editing = Boolean(id); const formRef = useRef(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [regions, setRegions] = useState([]);
  const [busy, setBusy] = useState(editing);
  const [exitOpen, setExitOpen] = useState(false);
  useEffect(() => {
    if (!hasSession()) { navigate("/auth"); return; }
    let cancelled = false; setBusy(true);
    Promise.all([getRegions(), editing ? apiRequest(authApiUrl(`/gatherings/${id}`)) : Promise.resolve(null)]).then(([regionResult, gathering]) => {
      if (cancelled) return;
      setRegions(asList(regionResult, "regions"));
      if (gathering) setTimeout(() => { const form = formRef.current; if (!form || cancelled) return; form.elements.title.value = gathering.title || ""; form.elements.region.value = gathering.region?.name || gathering.region || ""; form.elements.capacity.value = gathering.capacity || 2; form.elements.meetingPlace.value = gathering.meetingPlace || ""; form.elements.startsAt.value = toDateTimeLocal(gathering.startsAt); form.elements.concept.value = gathering.concept || ""; form.elements.description.value = gathering.description || ""; }, 0);
      setMessage(editing ? "게더링 정보를 불러왔습니다." : "");
    }).catch((requestError) => { if (!cancelled) { setError(true); setMessage(requestError.message); } }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [editing, id, navigate]);
  async function submit(event) {
    event.preventDefault();
    if (!hasSession()) { navigate("/auth"); return; }
    const selectedRegion = event.currentTarget.elements.region.value;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (editing) delete body.region;
    body.capacity = Number(body.capacity);
    body.startsAt = toKoreaOffsetDateTime(body.startsAt);
    if (new Date(body.startsAt).getTime() <= Date.now()) {
      setError(true); setMessage("날짜와 시간은 현재보다 미래여야 합니다."); return;
    }
    try { setBusy(true); setError(false); setMessage(editing ? "게더링을 수정하는 중입니다." : "게더링을 만드는 중입니다."); await apiRequest(authApiUrl(editing ? `/gatherings/${id}` : "/gatherings"), { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) }); const date = body.startsAt.slice(0, 10); navigate("/gatherings", { state: { region: selectedRegion, startsOn: date, endsOn: date } }); }
    catch (e) { setError(true); setMessage(e.message); setBusy(false); }
  }
  return <main className="feature-page-main gathering-write-main"><section className="page-intro"><div><p className="eyebrow dark">{editing ? "EDIT A GATHERING" : "CREATE A GATHERING"}</p><h1>{editing ? "게더링 정보를 수정해보세요" : "새 게더링을 만들어보세요"}</h1></div><div className="page-intro-actions">{editing ? <button className="button" type="button" onClick={() => setExitOpen(true)}>목록으로 돌아가기</button> : <Link className="button" to="/gatherings">목록으로 돌아가기</Link>}</div></section><section className="page-panel gathering-write-panel"><form className="stack-form" ref={formRef} onSubmit={submit}><label>모임 이름<input name="title" maxLength="150" placeholder="예: 여수 밤바다 펍투어" required /></label><div className="form-row"><label>지역<select name="region" required disabled={editing}><option value="">지역 선택</option>{regions.map((item) => <option value={item.name} key={item.regionId || item.id || item.name}>{item.name}</option>)}</select>{editing && <small>게더링 지역은 생성 후 변경할 수 없습니다.</small>}</label><label>정원<input name="capacity" type="number" min="2" max="100" defaultValue="4" required /></label></div><label>만날 장소<input name="meetingPlace" maxLength="255" placeholder="정확한 만남 장소" required /></label><div className="form-row"><label>날짜와 시간<input name="startsAt" type="datetime-local" required /></label><label>콘셉트<input name="concept" maxLength="100" placeholder="펍투어, 미식, 전시, 산책" required /></label></div><label>모임 설명<textarea name="description" rows="5" placeholder="어떤 모임인지, 무엇을 함께 하는지, 준비물이나 참고 사항을 알려주세요." required /></label><div className="community-write-actions">{editing && <button className="button" type="button" disabled={busy} onClick={() => setExitOpen(true)}>취소하기</button>}<button className="button button-primary" type="submit" disabled={busy}>{editing ? "수정 완료" : "게더링 만들기"}</button></div><div className={`page-status${message ? " is-visible" : ""}${error ? " is-error" : ""}`} role="status">{message}</div></form></section>{editing && exitOpen && <div className="community-exit-modal"><button className="community-exit-backdrop" type="button" aria-label="수정 취소 안내 닫기" onClick={() => setExitOpen(false)} /><section className="community-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="gathering-exit-title"><span>게더링 수정 중</span><h2 id="gathering-exit-title">수정을 취소할까요?</h2><p>변경한 내용은 저장되지 않고 게더링 목록으로 돌아갑니다.</p><div><button className="button" type="button" onClick={() => setExitOpen(false)}>계속 수정</button><button className="button button-primary" type="button" onClick={() => navigate("/gatherings")}>수정 취소</button></div></section></div>}</main>;
}
