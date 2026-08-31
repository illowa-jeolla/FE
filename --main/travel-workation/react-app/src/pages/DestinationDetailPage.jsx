import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addPlaceVisit, createPlaceReview, deletePlaceReview, deletePlaceVisit, getPlace, getPlaceReviews, updatePlaceReview } from "../api/regions";
import { asList } from "../hooks/useApi";
import KakaoMarkerMap from "../components/KakaoMarkerMap";

function imagePath(place) {
  const value = place?.imageUrl || place?.image || place?.thumbnailUrl || place?.firstImage;
  if (!value) return "/assets/jeolla-region-map.png";
  if (/^(https?:|data:|\/)/.test(value)) return value;
  return `/${value}`;
}

function valueOf(place, ...keys) {
  return keys.map((key) => place?.[key]).find((value) => value !== undefined && value !== null && value !== "") || "정보 없음";
}

function reviewValues(review = {}) {
  return { rating: Number(review.rating || review.score || 5), content: review.content || review.text || review.comment || "" };
}

export default function DestinationDetailPage() {
  const { id } = useParams();
  const [place, setPlace] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [visited, setVisited] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ rating: 5, content: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [placeResult, reviewResult] = await Promise.all([getPlace(id), getPlaceReviews(id)]);
      setPlace(placeResult);
      setVisited(Boolean(placeResult?.visited || placeResult?.isVisited || placeResult?.visitRegistered));
      setReviews(asList(reviewResult, "reviews"));
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitReview(event) {
    event.preventDefault();
    if (!form.content.trim()) return setMessage("리뷰 내용을 입력해 주세요.");
    const wasEditing = Boolean(editingId);
    setBusy(true); setMessage("");
    try {
      if (editingId) await updatePlaceReview(editingId, { rating: Number(form.rating), content: form.content.trim() });
      else await createPlaceReview(id, { rating: Number(form.rating), content: form.content.trim() });
      setForm({ rating: 5, content: "" }); setEditingId(null);
      const result = await getPlaceReviews(id);
      setReviews(asList(result, "reviews"));
      setMessage(wasEditing ? "리뷰를 수정했습니다." : "리뷰를 등록했습니다.");
    } catch (requestError) { setMessage(requestError.message); }
    finally { setBusy(false); }
  }

  async function removeReview(reviewId) {
    if (!window.confirm("이 리뷰를 삭제할까요?")) return;
    setBusy(true); setMessage("");
    try {
      await deletePlaceReview(reviewId);
      setReviews((current) => current.filter((review) => String(review.id || review.reviewId) !== String(reviewId)));
      if (String(editingId) === String(reviewId)) { setEditingId(null); setForm({ rating: 5, content: "" }); }
      setMessage("리뷰를 삭제했습니다.");
    } catch (requestError) { setMessage(requestError.message); }
    finally { setBusy(false); }
  }

  async function toggleVisit() {
    setBusy(true); setMessage("");
    try {
      if (visited) await deletePlaceVisit(id); else await addPlaceVisit(id);
      setVisited((current) => !current);
      setMessage(visited ? "방문 기록을 삭제했습니다." : "방문한 관광지로 등록했습니다.");
    } catch (requestError) { setMessage(requestError.message); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="feature-page-main destination-detail-react"><div className="page-status is-visible">관광지 정보를 불러오는 중입니다.</div></main>;
  if (error || !place) return <main className="feature-page-main destination-detail-react"><div className="page-status is-visible is-error">{error || "관광지 정보를 찾을 수 없습니다."}</div></main>;

  const name = valueOf(place, "name", "title");
  const regionName = place.regionName || place.region?.name || place.region || "전라도";
  const averageRating = Number(place.averageRating ?? place.rating ?? 0);

  return <main className="feature-page-main destination-detail-react">
    <section className="page-intro"><div><p className="eyebrow dark">{regionName} · 관광지</p><h1>{name}</h1></div><div className="page-intro-actions"><Link className="button" to="/map">지도로 돌아가기</Link><button className={`button${visited ? " button-primary" : ""}`} type="button" disabled={busy} onClick={toggleVisit}>{visited ? "✓ 방문 완료" : "방문 등록"}</button></div></section>
    {message && <p className="place-action-message" role="status">{message}</p>}
    <section className="destination-hero-react"><img src={imagePath(place)} alt={`${name} 전경`} /><div><span>관광지 상세 정보</span><h2>{name}</h2><p>{valueOf(place, "description", "overview", "summary")}</p><div className="destination-score-react"><strong>★ {averageRating.toFixed(1)}</strong><span>리뷰 {place.reviewCount ?? reviews.length}개</span></div></div></section>
    <section className="destination-info-grid-react">
      <article><span>이용 안내</span><h2>방문 전에 확인하세요</h2><dl><div><dt>주소</dt><dd>{valueOf(place, "address", "roadAddress")}</dd></div><div><dt>운영 시간</dt><dd>{valueOf(place, "openingHours", "businessHours", "useTime")}</dd></div><div><dt>전화</dt><dd>{valueOf(place, "phone", "telephone", "tel")}</dd></div><div><dt>주차</dt><dd>{valueOf(place, "parking", "parkingInfo")}</dd></div></dl></article>
      <article><span>위치 정보</span><h2>관광지 위치</h2><KakaoMarkerMap items={[place]} label={`${name} 위치 카카오 지도`} /><dl><div><dt>지역</dt><dd>{regionName}</dd></div><div><dt>위도</dt><dd>{valueOf(place, "latitude", "lat")}</dd></div><div><dt>경도</dt><dd>{valueOf(place, "longitude", "lng")}</dd></div><div><dt>분류</dt><dd>{valueOf(place, "category", "placeType", "type")}</dd></div></dl></article>
    </section>
    <section className="place-reviews-panel page-panel">
      <div className="place-reviews-heading"><div><span>PLACE REVIEWS</span><h2>관광지 리뷰</h2></div><strong>{reviews.length}개</strong></div>
      <form className="place-review-form" onSubmit={submitReview}><label>별점<select value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}>{[5,4,3,2,1].map((rating) => <option value={rating} key={rating}>{rating}점</option>)}</select></label><label>리뷰<textarea rows="3" value={form.content} placeholder="관광지에 대한 경험을 남겨 주세요." onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /></label><div><button className="button button-primary" disabled={busy} type="submit">{editingId ? "리뷰 수정" : "리뷰 작성"}</button>{editingId && <button className="button" type="button" onClick={() => { setEditingId(null); setForm({ rating: 5, content: "" }); }}>취소</button>}</div></form>
      <div className="place-review-list">{reviews.length ? reviews.map((review) => { const reviewId = review.id || review.reviewId; const values = reviewValues(review); return <article key={reviewId}><header><div><strong>{review.nickname || review.username || review.authorName || "여행자"}</strong><span>{"★".repeat(Math.max(1, Math.min(5, values.rating)))}</span></div><small>{review.createdAt ? new Date(review.createdAt).toLocaleDateString("ko-KR") : ""}</small></header><p>{values.content}</p><footer><button type="button" disabled={busy} onClick={() => { setEditingId(reviewId); setForm(values); }}>수정</button><button type="button" disabled={busy} onClick={() => removeReview(reviewId)}>삭제</button></footer></article>; }) : <p className="place-reviews-empty">첫 리뷰를 작성해 주세요.</p>}</div>
    </section>
  </main>;
}
