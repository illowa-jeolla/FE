import { useEffect, useMemo, useRef, useState } from "react";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";
import { loadKakaoMaps } from "./kakaoMaps";

export default function JobKakaoMap({ address, title }) {
  const containerRef = useRef(null);
  const [error, setError] = useState("");
  const query = String(address || "").trim();
  const kakaoUrl = useMemo(() => `https://map.kakao.com/link/search/${encodeURIComponent(query || title || "전남")}`, [query, title]);

  useEffect(() => {
    let cancelled = false;
    if (!KAKAO_MAP_JAVASCRIPT_KEY) { setError("카카오 지도 JavaScript 키가 설정되지 않았습니다."); return undefined; }
    if (!query) { setError("공고에 근무지 주소가 제공되지 않았습니다."); return undefined; }
    setError("");
    loadKakaoMaps(KAKAO_MAP_JAVASCRIPT_KEY).then(() => {
      if (cancelled || !containerRef.current) return;
      const { maps } = window.kakao;
      const geocoder = new maps.services.Geocoder();
      geocoder.addressSearch(query, (results, status) => {
        if (cancelled || !containerRef.current) return;
        if (status !== maps.services.Status.OK || !results[0]) { setError("주소의 지도 위치를 찾지 못했습니다."); return; }
        const position = new maps.LatLng(Number(results[0].y), Number(results[0].x));
        const map = new maps.Map(containerRef.current, { center: position, level: 4 });
        new maps.Marker({ map, position, title: title || query });
        maps.event.addListener(map, "click", () => window.open(kakaoUrl, "_blank", "noopener,noreferrer"));
      });
    }).catch((loadError) => { if (!cancelled) setError(loadError.message); });
    return () => { cancelled = true; };
  }, [query, title, kakaoUrl]);

  return <div className="job-kakao-map-wrap">
    <div className="job-kakao-map" ref={containerRef} aria-label={`${title || "일자리"} 근무지 카카오 지도`} />
    {error && <p className="job-kakao-map-error">{error}</p>}
    <a className="job-kakao-map-link" href={kakaoUrl} target="_blank" rel="noreferrer">카카오맵에서 보기 ↗</a>
  </div>;
}
