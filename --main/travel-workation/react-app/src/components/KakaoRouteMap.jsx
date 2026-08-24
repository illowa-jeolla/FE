import { useEffect, useRef, useState } from "react";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";

let kakaoMapsPromise;

function loadKakaoMaps(appKey) {
  if (window.kakao?.maps) {
    return new Promise((resolve) => window.kakao.maps.load(resolve));
  }
  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.addEventListener("load", () => window.kakao.maps.load(resolve), { once: true });
    script.addEventListener("error", () => reject(new Error("카카오 지도 SDK를 불러오지 못했습니다.")), { once: true });
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}

function coordinates(item) {
  const latitude = Number(item?.latitude);
  const longitude = Number(item?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

export default function KakaoRouteMap({ guide, active, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState("");
  const spots = guide?.spots || [];

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    const locatedSpots = spots.map((spot, index) => ({ spot, index, location: coordinates(spot) })).filter((item) => item.location);

    if (!KAKAO_MAP_JAVASCRIPT_KEY) {
      setError("카카오 지도 JavaScript 키를 설정하면 실제 지도가 표시됩니다.");
      return undefined;
    }
    if (!locatedSpots.length) {
      setError("추천 관광지의 위치 정보를 확인하지 못했습니다.");
      return undefined;
    }

    setError("");
    loadKakaoMaps(KAKAO_MAP_JAVASCRIPT_KEY).then(() => {
      if (cancelled || !containerRef.current) return;
      const { maps } = window.kakao;
      const first = locatedSpots[0].location;
      const map = new maps.Map(containerRef.current, {
        center: new maps.LatLng(first.latitude, first.longitude),
        level: 7
      });
      const bounds = new maps.LatLngBounds();
      const path = [];
      const markers = locatedSpots.map(({ spot, index, location }) => {
        const position = new maps.LatLng(location.latitude, location.longitude);
        bounds.extend(position);
        path.push(position);
        const marker = new maps.Marker({ map, position, title: `${index + 1}. ${spot.name}`, clickable: true });
        maps.event.addListener(marker, "click", () => selectRef.current?.(index));
        return { marker, position, index };
      });
      const polyline = new maps.Polyline({
        map,
        path,
        strokeWeight: 5,
        strokeColor: "#e85d9e",
        strokeOpacity: 0.85,
        strokeStyle: "solid"
      });
      map.setBounds(bounds, 70, 70, 70, 70);
      mapRef.current = map;
      markersRef.current = markers;
      polylineRef.current = polyline;
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach(({ marker }) => marker.setMap(null));
      polylineRef.current?.setMap(null);
      markersRef.current = [];
      polylineRef.current = null;
      mapRef.current = null;
    };
  }, [guide]);

  useEffect(() => {
    const selected = markersRef.current.find((item) => item.index === active);
    if (selected && mapRef.current) mapRef.current.panTo(selected.position);
  }, [active]);

  return <>
    <div className="kakao-route-map-react" ref={containerRef} aria-label="카카오 지도 기반 추천 관광지 동선" />
    {error && <div className="kakao-map-status-react"><strong>지도 연동 준비 중</strong><p>{error}</p></div>}
  </>;
}
