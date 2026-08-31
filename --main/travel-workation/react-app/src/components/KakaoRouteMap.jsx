import { useEffect, useRef, useState } from "react";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";
import { kakaoCoordinates as coordinates, loadKakaoMaps } from "./kakaoMaps";

export default function KakaoRouteMap({ guide, active, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const activePolylineRef = useRef(null);
  const routePositionsRef = useRef([]);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState("");
  const spots = guide?.spots || [];
  const routeSegments = guide?.routeSegments || [];

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
      const hotelLocation = coordinates(guide?.hotel);
      const segmentPaths = routeSegments.map((segment) => (segment.path || []).map((point) => new maps.LatLng(point.latitude, point.longitude))).filter((segment) => segment.length > 1);
      const fallbackPath = hotelLocation ? [new maps.LatLng(hotelLocation.latitude, hotelLocation.longitude)] : [];
      if (hotelLocation) bounds.extend(fallbackPath[0]);
      const markers = locatedSpots.map(({ spot, index, location }) => {
        const position = new maps.LatLng(location.latitude, location.longitude);
        bounds.extend(position);
        fallbackPath.push(position);
        const marker = new maps.Marker({ map, position, title: `${index + 1}. ${spot.name}`, clickable: true });
        maps.event.addListener(marker, "click", () => selectRef.current?.(index));
        return { marker, position, index };
      });
      const path = segmentPaths.length ? segmentPaths.flatMap((segment, index) => index ? segment.slice(1) : segment) : fallbackPath;
      path.forEach((position) => bounds.extend(position));
      const polyline = new maps.Polyline({
        map,
        path,
        strokeWeight: 6,
        strokeColor: "#aeb4b8",
        strokeOpacity: 0.78,
        strokeStyle: routeSegments.some((segment) => segment.estimated) ? "shortdash" : "solid"
      });
      map.setBounds(bounds, 70, 70, 70, 70);
      mapRef.current = map;
      markersRef.current = markers;
      polylineRef.current = polyline;
      routePositionsRef.current = segmentPaths.length ? segmentPaths : path.slice(0, -1).map((position, index) => [position, path[index + 1]]);
      activePolylineRef.current = new maps.Polyline({ map, path: routePositionsRef.current[active] || [], strokeWeight: 7, strokeColor: "#bd4f82", strokeOpacity: .96, strokeStyle: routeSegments[active]?.estimated ? "shortdash" : "solid" });
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach(({ marker }) => marker.setMap(null));
      polylineRef.current?.setMap(null);
      activePolylineRef.current?.setMap(null);
      markersRef.current = [];
      polylineRef.current = null;
      activePolylineRef.current = null;
      routePositionsRef.current = [];
      mapRef.current = null;
    };
  }, [guide]);

  useEffect(() => {
    const selected = markersRef.current.find((item) => item.index === active);
    if (selected && mapRef.current) mapRef.current.panTo(selected.position);
    if (mapRef.current && window.kakao?.maps && routePositionsRef.current.length) {
      activePolylineRef.current?.setMap(null);
      activePolylineRef.current = new window.kakao.maps.Polyline({ map: mapRef.current, path: routePositionsRef.current[active] || [], strokeWeight: 7, strokeColor: "#bd4f82", strokeOpacity: .96, strokeStyle: routeSegments[active]?.estimated ? "shortdash" : "solid" });
    }
  }, [active]);

  return <>
    <div className="kakao-route-map-react" ref={containerRef} aria-label="카카오 지도 기반 추천 관광지 동선" />
    {error && <div className="kakao-map-status-react"><strong>지도 연동 준비 중</strong><p>{error}</p></div>}
  </>;
}
