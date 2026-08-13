import { Link, useParams } from "react-router-dom";
import { PageIntro, Status } from "../components/UI";
import { useApi } from "../hooks/useApi";

function imagePath(value) {
  if (!value) return "/assets/jeolla-region-map.png";
  if (/^(https?:|data:|\/)/.test(value)) return value;
  return `/${value}`;
}

function DetailValue({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || "관광 API 연동 후 제공"}</dd></div>;
}

export default function DestinationDetailPage() {
  const { id } = useParams();
  const { data: destination, loading, error } = useApi(`/api/destinations/${id}`);
  const mapLink = destination?.region ? `/map?region=${encodeURIComponent(destination.region)}` : "/map";

  return <main className="page-shell-react destination-detail-react">
    <Status loading={loading} error={error} empty={!destination}>{destination && <>
      <PageIntro
        eyebrow={`${destination.region} · ${destination.category || "관광지"}`}
        title={destination.name}
        description={destination.description}
        action={<Link className="secondary-action-react" to={mapLink}>지도로 돌아가기</Link>}
      />
      <section className="destination-hero-react">
        <img src={imagePath(destination.imageUrl)} alt={`${destination.name} 전경`} />
        <div>
          <span>관광지 상세 정보</span>
          <h2>{destination.name}</h2>
          <p>{destination.description || `${destination.region}에서 즐길 수 있는 관광지입니다.`}</p>
          <div className="destination-score-react"><strong>★ {Number(destination.rating || 0).toFixed(1)}</strong><span>{destination.category || "관광지"}</span></div>
        </div>
      </section>
      <section className="destination-info-grid-react">
        <article>
          <span>이용 안내</span>
          <h2>방문 전에 확인하세요</h2>
          <dl>
            <DetailValue label="주소" value={destination.address} />
            <DetailValue label="운영 시간" value={destination.openingHours} />
            <DetailValue label="전화" value={destination.phone} />
            <DetailValue label="주차" value={destination.parking} />
          </dl>
        </article>
        <article>
          <span>여행 정보</span>
          <h2>이렇게 둘러보기 좋아요</h2>
          <dl>
            <DetailValue label="추천 이동수단" value={destination.transport} />
            <DetailValue label="추천 동행" value={destination.companion} />
            <DetailValue label="데이터 출처" value={destination.sourceName} />
          </dl>
          {destination.homepageUrl && <a className="destination-homepage-react" href={destination.homepageUrl} target="_blank" rel="noreferrer">공식 홈페이지 보기 →</a>}
        </article>
      </section>
    </>}</Status>
  </main>;
}
