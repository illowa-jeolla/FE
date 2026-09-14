import { useEffect, useRef, useState } from "react";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";
import { kakaoCoordinates as coordinates, loadKakaoMaps } from "./kakaoMaps";
import { getTourPlaceDetail } from "../api/travelRecommendations";

function homepageUrl(value) { const text = String(value || ""); const href = text.match(/href=["']<?([^"'>]+)>?["']/i)?.[1]; return String(href || text.match(/https?:\/\/[^\s"<]+/i)?.[0] || "").replace(/^<|>$/g, "").replace(/&amp;/g, "&"); }

export default function KakaoRouteMap({ guide, active, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const activePolylineRef = useRef(null);
  const routePositionsRef = useRef([]);
  const routeEstimatedRef = useRef([]);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState("");
  const spots = guide?.spots || [];
  const routeSegments = guide?.routeSegments || [];

  function fitRouteWithoutCard(map, bounds) { map.setBounds(bounds, 80, 80, 80, 80); }

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
      const startLocation = coordinates(guide?.routeStart || guide?.hotel);
      const destinationLocation = coordinates(guide?.routeDestination || guide?.hotel);
      const fallbackNodes = [startLocation ? new maps.LatLng(startLocation.latitude, startLocation.longitude) : null];
      const destinationMarkerLocation = coordinates(guide?.routeDestination);
      const destinationOverlay = destinationMarkerLocation ? (() => {
        const content = document.createElement("div");
        content.className = "travel-map-destination-marker";
        const destinationImage = guide?.routeDestination?.imageUrl || guide?.routeDestination?.thumbnailUrl || guide?.routeDestination?.firstImage;
        if (destinationImage) { const image = document.createElement("img"); image.src = destinationImage; image.alt = ""; content.append(image); }
        const label = document.createElement("span"); label.textContent = guide?.routeDestination?.name || guide?.destinationLabel || "목적지"; content.append(label);
        return new maps.CustomOverlay({ map, position: new maps.LatLng(destinationMarkerLocation.latitude, destinationMarkerLocation.longitude), content, zIndex: 5, xAnchor: 0.5, yAnchor: 1 });
      })() : null;
      const markers = locatedSpots.map(({ spot, index, location }) => {
        const position = new maps.LatLng(location.latitude, location.longitude);
        bounds.extend(position);
        fallbackNodes.push(position);
        const content = document.createElement("div");
        content.className = "travel-map-place-marker";
        const button = document.createElement("button");
        button.type = "button"; button.className = "travel-map-place-number"; button.setAttribute("aria-label", `${index + 1}. ${spot.name}`);
        if (spot.imageUrl) { const markerImage = document.createElement("img"); markerImage.src = spot.imageUrl; markerImage.alt = ""; button.append(markerImage); }
        const number = document.createElement("span"); number.textContent = String(index + 1); button.append(number);
        const markerLabel = document.createElement("small"); markerLabel.className = "travel-map-place-label"; markerLabel.textContent = spot.name || "관광지";
        const preview = document.createElement("article"); preview.className = "travel-map-place-preview";
        if (spot.imageUrl) { const previewImage = document.createElement("img"); previewImage.src = spot.imageUrl; previewImage.alt = ""; preview.append(previewImage); }
        const copy = document.createElement("div");
        const name = document.createElement("strong"); name.textContent = spot.name || "관광지";
        const address = document.createElement("small"); address.textContent = spot.address || spot.category || "관광지";
        const link = document.createElement("a"); link.href = spot.sourceUrl || ""; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = "사이트 이동 ↗"; link.hidden = !spot.sourceUrl;
        copy.append(name, address, link); preview.append(copy); content.append(button, markerLabel, preview);
        const positionPreview = () => {
          const mapRect = containerRef.current?.getBoundingClientRect();
          const markerRect = content.getBoundingClientRect();
          if (!mapRect) return;
          const width = 260; const height = 112; const gap = 10;
          const centerX = markerRect.left + markerRect.width / 2; const centerY = markerRect.top + markerRect.height / 2;
          const candidates = {
            right: { left: markerRect.right + gap, top: centerY - height / 2, width, height },
            left: { left: markerRect.left - gap - width, top: centerY - height / 2, width, height },
            above: { left: centerX - width / 2, top: markerRect.top - gap - height, width, height },
            below: { left: centerX - width / 2, top: markerRect.bottom + gap, width, height }
          };
          const obstacles = [...containerRef.current.querySelectorAll(".travel-map-place-marker")].filter((element) => element !== content).map((element) => element.getBoundingClientRect());
          const fixedCard = containerRef.current.parentElement?.querySelector(".travel-map-card")?.getBoundingClientRect();
          if (fixedCard) obstacles.push(fixedCard);
          const overlap = (a, b) => Math.max(0, Math.min(a.left + a.width, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.bottom) - Math.max(a.top, b.top));
          const score = (box) => {
            const outside = Math.max(0, mapRect.left - box.left) + Math.max(0, box.left + box.width - mapRect.right) + Math.max(0, mapRect.top - box.top) + Math.max(0, box.top + box.height - mapRect.bottom);
            return outside * 10000 + obstacles.reduce((sum, obstacle) => sum + overlap(box, obstacle), 0);
          };
          const direction = Object.entries(candidates).sort((a, b) => score(a[1]) - score(b[1]))[0][0];
          content.classList.toggle("place-preview-side-right", direction === "right");
          content.classList.toggle("place-preview-side-left", direction === "left");
          content.classList.toggle("place-preview-opens-below", direction === "below");
          content.classList.remove("place-preview-opens-right", "place-preview-opens-left");
        };
        let detailRequested = false;
        const loadDetail = async () => {
          positionPreview();
          if (detailRequested || !spot.contentId) return;
          detailRequested = true;
          try {
            const detail = await getTourPlaceDetail(spot.contentId);
            name.textContent = detail.title || spot.name || "관광지";
            address.textContent = detail.address || spot.address || spot.category || "관광지";
            const nextUrl = homepageUrl(detail.homepage) || detail.sourceUrl || spot.sourceUrl;
            if (nextUrl) { link.href = nextUrl; link.hidden = false; }
            const nextImage = detail.firstImage || detail.firstImageThumbnail || spot.imageUrl;
            if (nextImage) {
              let markerImage = button.querySelector("img");
              if (!markerImage) { markerImage = document.createElement("img"); markerImage.alt = ""; button.prepend(markerImage); }
              markerImage.src = nextImage;
              let previewImage = preview.querySelector("img");
              if (!previewImage) { previewImage = document.createElement("img"); previewImage.alt = ""; preview.prepend(previewImage); }
              previewImage.src = nextImage;
            }
          } catch { detailRequested = false; }
        };
        content.addEventListener("mouseenter", () => { marker.setZIndex?.(100); loadDetail(); });
        content.addEventListener("mouseleave", () => marker.setZIndex?.(6));
        content.addEventListener("focusin", () => { marker.setZIndex?.(100); loadDetail(); });
        content.addEventListener("focusout", () => marker.setZIndex?.(6));
        button.addEventListener("click", () => selectRef.current?.(index));
        const marker = new maps.CustomOverlay({ map, position, content, zIndex: 6, xAnchor: 0.5, yAnchor: 1 });
        return { marker, position, index, content };
      });
      fallbackNodes.push(destinationLocation ? new maps.LatLng(destinationLocation.latitude, destinationLocation.longitude) : null);
      const routePositions = Array.from({ length: spots.length + 1 }, (_, index) => {
        const backendPath = (routeSegments[index]?.path || []).map((point) => coordinates(point)).filter(Boolean).map((point) => new maps.LatLng(point.latitude, point.longitude));
        const fallbackSegment = fallbackNodes[index] && fallbackNodes[index + 1] ? [fallbackNodes[index], fallbackNodes[index + 1]] : [];
        return backendPath.length > 1 ? backendPath : fallbackSegment;
      });
      const routeEstimated = routePositions.map((segment, index) => Boolean(routeSegments[index]?.estimated || (!routeSegments[index]?.path?.length && segment.length > 1)));
      const path = routePositions.filter((segment) => segment.length > 1).flatMap((segment, index) => index ? segment.slice(1) : segment);
      const polyline = new maps.Polyline({
        map,
        path,
        strokeWeight: 6,
        strokeColor: "#aeb4b8",
        strokeOpacity: 0.78,
        strokeStyle: "solid"
      });
      if (locatedSpots.length > 1) map.setBounds(bounds, 70, 70, 70, 70);
      mapRef.current = map;
      markersRef.current = markers;
      if (destinationOverlay) markersRef.current.push({ marker: destinationOverlay, position: new maps.LatLng(destinationMarkerLocation.latitude, destinationMarkerLocation.longitude), index: -1 });
      polylineRef.current = polyline;
      routePositionsRef.current = routePositions;
      routeEstimatedRef.current = routeEstimated;
      activePolylineRef.current = new maps.Polyline({ map, path: routePositionsRef.current[active] || [], strokeWeight: 7, strokeColor: "#bd4f82", strokeOpacity: .96, strokeStyle: routeEstimatedRef.current[active] ? "shortdash" : "solid" });
      const initialPath = routePositionsRef.current[active] || [];
      if (initialPath.length > 1) {
        const initialBounds = new maps.LatLngBounds();
        initialPath.forEach((position) => initialBounds.extend(position));
        fitRouteWithoutCard(map, initialBounds);
      }
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
      routeEstimatedRef.current = [];
      mapRef.current = null;
    };
  }, [guide]);

  useEffect(() => {
    const selected = markersRef.current.find((item) => item.index === active);
    if (mapRef.current && window.kakao?.maps && routePositionsRef.current.length) {
      const activePath = routePositionsRef.current[active] || [];
      activePolylineRef.current?.setMap(null);
      activePolylineRef.current = new window.kakao.maps.Polyline({ map: mapRef.current, path: activePath, strokeWeight: 7, strokeColor: "#bd4f82", strokeOpacity: .96, strokeStyle: routeEstimatedRef.current[active] ? "shortdash" : "solid" });
      if (activePath.length > 1) {
        const activeBounds = new window.kakao.maps.LatLngBounds();
        activePath.forEach((position) => activeBounds.extend(position));
        fitRouteWithoutCard(mapRef.current, activeBounds);
      } else if (selected) mapRef.current.panTo(selected.position);
    }
  }, [active]);

  return <>
    <div className="kakao-route-map-react" ref={containerRef} aria-label="카카오 지도 기반 추천 관광지 동선" />
    {error && <div className="kakao-map-status-react"><strong>지도 연동 준비 중</strong><p>{error}</p></div>}
  </>;
}
