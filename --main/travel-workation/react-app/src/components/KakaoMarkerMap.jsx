import { useEffect, useRef, useState } from "react";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";
import { kakaoCoordinates, loadKakaoMaps } from "./kakaoMaps";

export default function KakaoMarkerMap({ items = [], selectedId, onSelect, label = "카카오 지도" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState("");

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    const located = items.map((item) => ({ item, location: kakaoCoordinates(item) })).filter(({ location }) => location);
    if (!KAKAO_MAP_JAVASCRIPT_KEY) { setError("카카오 지도 키가 설정되지 않았습니다."); return undefined; }
    if (!located.length) { setError("표시할 위치 정보가 없습니다."); return undefined; }

    setError("");
    loadKakaoMaps(KAKAO_MAP_JAVASCRIPT_KEY).then(() => {
      if (cancelled || !containerRef.current) return;
      const { maps } = window.kakao;
      const first = located[0].location;
      const map = new maps.Map(containerRef.current, { center: new maps.LatLng(first.latitude, first.longitude), level: located.length > 1 ? 10 : 4 });
      const bounds = new maps.LatLngBounds();
      markersRef.current = located.map(({ item, location }) => {
        const position = new maps.LatLng(location.latitude, location.longitude);
        bounds.extend(position);
        const marker = new maps.Marker({ map, position, title: item.name || item.title || "위치", clickable: Boolean(onSelectRef.current) });
        if (onSelectRef.current) maps.event.addListener(marker, "click", () => onSelectRef.current?.(item));
        return { marker, position, id: item.id ?? item.regionId ?? item.placeId };
      });
      if (located.length > 1) map.setBounds(bounds, 55, 55, 55, 55);
      mapRef.current = map;
    }).catch((loadError) => { if (!cancelled) setError(loadError.message); });

    return () => {
      cancelled = true;
      markersRef.current.forEach(({ marker }) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [items]);

  useEffect(() => {
    const selected = markersRef.current.find(({ id }) => String(id) === String(selectedId));
    if (selected && mapRef.current) mapRef.current.panTo(selected.position);
  }, [selectedId]);

  return <div className="kakao-marker-map-wrap"><div className="kakao-marker-map" ref={containerRef} aria-label={label} />{error && <p className="kakao-marker-map-status">{error}</p>}</div>;
}
