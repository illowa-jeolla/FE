import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import { FormMessage, Modal, PageIntro, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

export default function JobDetailPage() {
  const { id } = useParams();
  const { data: job, loading, error } = useApi(`/api/jobs/${id}`);
  const [favorite, setFavorite] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (hasSession()) apiRequest(`/api/jobs/${id}/favorite`).then((result) => setFavorite(Boolean(result.favorite))).catch(() => {}); }, [id]);
  async function toggleFavorite() { if (!hasSession()) { setMessage("로그인 후 찜할 수 있어요."); return; } const method = favorite ? "DELETE" : "POST"; try { await apiRequest(`/api/jobs/${id}/favorite`, { method }); setFavorite(!favorite); } catch (e) { setMessage(e.message); } }
  async function apply() { if (!hasSession()) { setMessage("로그인 후 지원할 수 있어요."); setApplyOpen(false); return; } try { await apiRequest(`/api/jobs/${id}/apply`, { method: "POST", body: JSON.stringify({}) }); setMessage("지원 내역에 저장했습니다."); setApplyOpen(false); } catch (e) { setMessage(e.message); } }
  return <main className="page-shell-react"><Status loading={loading} error={error} empty={!job}>{job && <><PageIntro eyebrow={`${job.region} · ${job.category}`} title={job.title} description={`${job.companyName} · ${job.location}`} action={<Link className="secondary-action-react" to="/jobs">목록으로</Link>} /><FormMessage message={message} /><section className="job-hero-react"><div><div className="chip-row">{[job.workType, job.workTime, job.duration].filter(Boolean).map((item) => <span key={item}>{item}</span>)}</div><h2>{job.title}</h2><p>{job.companyName}</p><dl><div><dt>급여</dt><dd>{job.pay}</dd></div><div><dt>근무 시간</dt><dd>{job.workTime}</dd></div><div><dt>평점</dt><dd>★ {job.rating}</dd></div></dl></div><div className="job-hero-actions-react"><button className="primary-action-react" onClick={() => setApplyOpen(true)}>공고 지원하기</button><button className="favorite-action-react" aria-pressed={favorite} onClick={toggleFavorite}>{favorite ? "♥" : "♡"}</button></div></section><div className="job-detail-grid-react"><article><span>주요 업무</span><h2>무엇을 하게 되나요?</h2><p>{job.description || `${job.region} 관광 생활권에서 방문객을 응대하고 지역 콘텐츠 운영을 지원합니다.`}</p><ul><li>관광객 안내와 현장 운영 지원</li><li>지역 콘텐츠와 프로그램 관리</li><li>팀원과 일정 및 고객 요청 공유</li></ul></article><article><span>근무 위치</span><h2>{job.location}</h2><p>지원 전 담당자에게 상세 주소와 출근 방법을 확인해 주세요.</p><div className="mini-map-react">N <small>{job.region} 근무 위치</small></div></article></div></>}</Status><Modal open={applyOpen} title="이 공고에 지원할까요?" onClose={() => setApplyOpen(false)} actions={<><button onClick={() => setApplyOpen(false)}>취소</button><button className="primary-action-react" onClick={apply}>지원하기</button></>}><p>지원하면 마이페이지의 ‘내가 지원한 공고’에서 진행 상태를 확인할 수 있어요.</p></Modal></main>;
}
