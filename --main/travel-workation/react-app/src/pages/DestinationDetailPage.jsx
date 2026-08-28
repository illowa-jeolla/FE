import { Link, useParams, useSearchParams } from "react-router-dom";
import { Status } from "../components/UI";
import { useApi } from "../hooks/useApi";
import { authApiUrl } from "../config";

function imagePath(value) {
  if (!value) return "/assets/jeolla-region-map.png";
  if (/^(https?:|data:|\/)/.test(value)) return value;
  return `/${value}`;
}

function DetailValue({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || "관광 API 연동 후 제공"}</dd></div>;
}

function textOnly(value = "") {
  const parser = new DOMParser();
  return parser.parseFromString(String(value), "text/html").body.textContent?.trim() || "";
}

function firstLink(value = "") {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(value), "text/html");
  const href = document.querySelector("a")?.getAttribute("href") || "";
  return /^https?:\/\//i.test(href) ? href : "";
}

function normalizeTourDetail(place, region) {
  return {
    ...place,
    id: place.contentId,
    name: place.title,
    region,
    category: "관광지",
    description: textOnly(place.overview),
    imageUrl: place.firstImage || place.firstImageThumbnail,
    phone: place.tel,
    homepageUrl: firstLink(place.homepage),
    sourceName: "한국관광공사",
    zipcode: place.zipcode
  };
}

export default function DestinationDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const region = searchParams.get("region") || "";
  const { data, loading, error } = useApi(authApiUrl(`/tour/places/${encodeURIComponent(id)}`));
  const destination = data ? normalizeTourDetail(data, region) : null;
  const mapLink = destination?.region ? `/map?region=${encodeURIComponent(destination.region)}` : "/map";

  return <main className="feature-page-main">
    <Status loading={loading} error={error} empty={!destination}>{destination && <>
      <section className="page-intro"><div><p className="eyebrow dark">{destination.region} · {destination.category || "관광지"}</p><h1>{destination.name}</h1></div><div className="page-intro-actions"><Link className="button" to={mapLink}>지도로 돌아가기</Link></div></section>
      <section className="page-panel destination-detail-panel">
        <img src={imagePath(destination.imageUrl)} alt={`${destination.name} 전경`} />
        <div>
          <span>관광지 상세 정보</span>
          <h2>{destination.name}</h2>
          <p>{destination.description || `${destination.region}에서 즐길 수 있는 관광지입니다.`}</p>
          <div className="tag-row"><span>{destination.category || "관광지"}</span><span>{destination.sourceName}</span></div>
        </div>
      </section>
      <section className="page-workspace destination-info-grid">
        <article className="page-panel">
          <span>이용 안내</span>
          <h2>방문 전에 확인하세요</h2>
          <dl>
            <DetailValue label="주소" value={destination.address} />
            <DetailValue label="운영 시간" value={destination.openingHours} />
            <DetailValue label="전화" value={destination.phone} />
            <DetailValue label="주차" value={destination.parking} />
          </dl>
        </article>
        <article className="page-panel">
          <span>여행 정보</span>
          <h2>이렇게 둘러보기 좋아요</h2>
          <dl>
            <DetailValue label="추천 이동수단" value={destination.transport} />
            <DetailValue label="추천 동행" value={destination.companion} />
            <DetailValue label="데이터 출처" value={destination.sourceName} />
          </dl>
          {destination.homepageUrl && <a className="button" href={destination.homepageUrl} target="_blank" rel="noreferrer">공식 홈페이지 보기 →</a>}
        </article>
      </section>
    </>}</Status>
  </main>;
}
