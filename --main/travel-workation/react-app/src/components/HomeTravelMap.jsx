import { Link } from "react-router-dom";
import "../styles/home-travel-map.css";

// Coordinates use the full 1934 × 1176 artwork, so pins stay aligned at every size.
const pins = [
  ["영광", 32.4, 17.8], ["장성", 45.8, 16.4],
  ["담양", 55.6, 24.3], ["곡성", 70.3, 26.4],
  ["함평", 36.8, 30.1], ["구례", 85.2, 38],
  ["나주", 40.5, 44], ["화순", 63.2, 42.1],
  ["목포", 27.3, 48.4], ["신안", 11.1, 52.6],
  ["영암", 43.7, 55.2], ["순천", 72.5, 49.6],
  ["광양", 90.3, 49.5], ["보성", 64.5, 60.9],
  ["해남", 38.6, 64.9], ["장흥", 52, 65],
  ["여수", 74.5, 69.1], ["진도", 28.7, 79.2],
  ["완도", 51.3, 83.7],
];

export default function HomeTravelMap() {
  return <nav className="home-travel-map" aria-label="지도에서 전남 여행 지역 선택">
    <div className="home-travel-map-artwork">
      <img src="/images/jeonnam-illustrated-map.png" alt="전남 여행 지도" loading="lazy" width="1934" height="1176" />
      {pins.map(([name, x, y]) => <Link
        key={name}
        className="home-travel-map-pin"
        to={`/recommend?region=${encodeURIComponent(name)}`}
        aria-label={`${name} 관광지 추천 받기`}
        style={{ left: `${x}%`, top: `${y}%`, "--map-x": `${x}%`, "--map-y": `${y}%` }}
      >
        <span className="home-travel-map-zoom" aria-hidden="true" />
        <span className="home-travel-map-label">{name} <span aria-hidden="true">↗</span></span>
      </Link>)}
    </div>
    <span className="home-travel-map-caption">핀을 눌러 여행을 시작해보세요</span>
  </nav>;
}
