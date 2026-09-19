import { useEffect, useRef, useState } from "react";
import { KAKAO_MAP_JAVASCRIPT_KEY } from "../config";
import { kakaoCoordinates as coordinates, loadKakaoMaps } from "./kakaoMaps";
import { getTourPlaceDetail } from "../api/travelRecommendations";

function homepageUrl(value) { const text = String(value || ""); const href = text.match(/href=["']<?([^"'>]+)>?["']/i)?.[1]; return String(href || text.match(/https?:\/\/[^\s"<]+/i)?.[0] || "").replace(/^<|>$/g, "").replace(/&amp;/g, "&"); }

function focusRoute(map, path, maps, onSettled) {
  if (!map || !path?.length) return;
  const latitudes = path.map((point) => point.getLat());
  const longitudes = path.map((point) => point.getLng());
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const center = new maps.LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2);
  const span = Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos(center.getLat() * Math.PI / 180));
  const level = span < .006 ? 4 : span < .014 ? 5 : span < .032 ? 6 : span < .07 ? 7 : span < .15 ? 8 : 9;
  let centeringFinished = false;
  const finishCentering = () => {
    if (centeringFinished) return;
    centeringFinished = true;
    maps.event.removeListener(map, "idle", finishCentering);
    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      maps.event.removeListener(map, "idle", complete);
      onSettled?.();
    };
    maps.event.addListener(map, "idle", complete);
    map.panTo(center);
    window.setTimeout(complete, 420);
  };
  maps.event.addListener(map, "idle", finishCentering);
  map.setLevel(level, { animate: true });
  map.panTo(center);
  window.setTimeout(finishCentering, 760);
}

export default function KakaoRouteMap({ guide, active, focusKey, onSelect, onPreviewChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const activePolylineRef = useRef(null);
  const routeAnimationRef = useRef(0);
  const focusRequestRef = useRef(0);
  const lastFocusKeyRef = useRef(focusKey);
  const routePositionsRef = useRef([]);
  const routeEstimatedRef = useRef([]);
  const selectRef = useRef(onSelect);
  const previewRef = useRef(onPreviewChange);
  const [error, setError] = useState("");
  const spots = guide?.spots || [];
  const routeSegments = guide?.routeSegments || [];

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { previewRef.current = onPreviewChange; }, [onPreviewChange]);

  function clearActiveRoute() {
    if (routeAnimationRef.current) cancelAnimationFrame(routeAnimationRef.current);
    routeAnimationRef.current = 0;
    activePolylineRef.current?.setMap(null);
    activePolylineRef.current = null;
  }

  function routeAnimationPoints(path, maps) {
    if (path.length !== 2) return path;
    const [start, end] = path;
    return Array.from({ length: 37 }, (_, index) => {
      const ratio = index / 36;
      return new maps.LatLng(start.getLat() + (end.getLat() - start.getLat()) * ratio, start.getLng() + (end.getLng() - start.getLng()) * ratio);
    });
  }

  function animateActiveRoute(map, sourcePath, maps, estimated) {
    clearActiveRoute();
    const path = routeAnimationPoints(sourcePath, maps);
    activePolylineRef.current = new maps.Polyline({ map, path: [], strokeWeight: 8, strokeColor: "#1677ff", strokeOpacity: .96, strokeStyle: estimated ? "shortdash" : "solid" });
    const startedAt = performance.now();
    const duration = 1520;
    const draw = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const count = Math.max(2, Math.ceil(eased * path.length));
      activePolylineRef.current?.setPath(path.slice(0, count));
      if (progress < 1) routeAnimationRef.current = requestAnimationFrame(draw);
      else {
        routeAnimationRef.current = 0;
      }
    };
    routeAnimationRef.current = requestAnimationFrame(draw);
  }

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
      const hotelLocation = coordinates(guide?.hotel);
      const fallbackNodes = [startLocation ? new maps.LatLng(startLocation.latitude, startLocation.longitude) : null];
      const sameLocation = (left, right) => left && right && Math.abs(left.latitude - right.latitude) < .00001 && Math.abs(left.longitude - right.longitude) < .00001;
      const createRoutePointOverlay = (item, location, type, fallbackLabel) => {
        if (!location) return null;
        const content = document.createElement("div");
        content.className = `travel-map-route-marker is-${type}`;
        const badge = document.createElement("span"); badge.className = "travel-map-route-badge";
        const imageUrl = item?.imageUrl || item?.thumbnailUrl || item?.firstImage;
        if (imageUrl && type !== "hotel") {
          const image = document.createElement("img"); image.src = imageUrl; image.alt = "";
          image.addEventListener("error", () => image.remove()); badge.append(image);
        }
        const icon = document.createElement("i"); icon.textContent = type === "hotel" ? "⌂" : type === "start" ? "S" : "E"; badge.append(icon);
        const label = document.createElement("small"); label.className = "travel-map-route-label"; label.textContent = item?.name || fallbackLabel;
        content.append(badge, label);
        return { marker: new maps.CustomOverlay({ map, position: new maps.LatLng(location.latitude, location.longitude), content, zIndex: 5, xAnchor: 0.5, yAnchor: 1 }), position: new maps.LatLng(location.latitude, location.longitude), index: type === "destination" ? spots.length : -2 };
      };
      const hotelOverlay = createRoutePointOverlay(guide?.hotel, hotelLocation, "hotel", "숙소");
      const startOverlay = !sameLocation(startLocation, hotelLocation) ? createRoutePointOverlay(guide?.routeStart, startLocation, "start", "출발지") : null;
      const destinationOverlay = !sameLocation(destinationLocation, hotelLocation) && !sameLocation(destinationLocation, startLocation) ? createRoutePointOverlay(guide?.routeDestination, destinationLocation, "destination", guide?.destinationLabel || "도착지") : null;
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
        let previewCloseTimer = 0;
        const openPreview = () => {
          window.clearTimeout(previewCloseTimer);
          [...(containerRef.current?.querySelectorAll(".travel-map-place-marker.is-preview-open") || [])].forEach((element) => {
            if (element !== content) element.classList.remove("is-preview-open");
          });
          content.classList.add("is-preview-open");
          previewRef.current?.(index);
          marker.setZIndex?.(100);
          loadDetail();
        };
        const schedulePreviewClose = () => {
          window.clearTimeout(previewCloseTimer);
          previewCloseTimer = window.setTimeout(() => {
            if (content.classList.contains("is-preview-pinned")) return;
            if (content.matches(":hover") || content.contains(document.activeElement)) return;
            content.classList.remove("is-preview-open");
            const pinnedPreview = containerRef.current?.querySelector(".travel-map-place-marker.is-preview-pinned");
            if (pinnedPreview) pinnedPreview.classList.add("is-preview-open");
            previewRef.current?.(null);
            marker.setZIndex?.(6);
          }, 130);
        };
        content.addEventListener("mouseenter", openPreview);
        content.addEventListener("mouseleave", schedulePreviewClose);
        content.addEventListener("focusin", openPreview);
        content.addEventListener("focusout", schedulePreviewClose);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          window.clearTimeout(previewCloseTimer);
          [...(containerRef.current?.querySelectorAll(".travel-map-place-marker.is-preview-pinned") || [])].forEach((element) => element.classList.remove("is-preview-pinned", "is-preview-open"));
          content.classList.add("is-preview-pinned", "is-preview-open");
          button.blur();
          previewRef.current?.(null);
          marker.setZIndex?.(100);
          selectRef.current?.(index, { focusMap: false });
        });
        const marker = new maps.CustomOverlay({ map, position, content, zIndex: 6, xAnchor: 0.5, yAnchor: 1, clickable: true });
        return { marker, position, index, content };
      });
      const dismissPreviews = () => {
        [...(containerRef.current?.querySelectorAll(".travel-map-place-marker.is-preview-open, .travel-map-place-marker.is-preview-pinned") || [])].forEach((element) => element.classList.remove("is-preview-open", "is-preview-pinned"));
        markersRef.current.forEach(({ marker }) => marker.setZIndex?.(6));
        previewRef.current?.(null);
        if (containerRef.current?.contains(document.activeElement)) document.activeElement?.blur?.();
      };
      maps.event.addListener(map, "click", dismissPreviews);
      maps.event.addListener(map, "dragstart", dismissPreviews);
      maps.event.addListener(map, "zoom_start", dismissPreviews);
      fallbackNodes.push(destinationLocation ? new maps.LatLng(destinationLocation.latitude, destinationLocation.longitude) : null);
      const routePositions = Array.from({ length: spots.length + 1 }, (_, index) => {
        const backendPath = (routeSegments[index]?.path || []).map((point) => coordinates(point)).filter(Boolean).map((point) => new maps.LatLng(point.latitude, point.longitude));
        const fallbackSegment = fallbackNodes[index] && fallbackNodes[index + 1] ? [fallbackNodes[index], fallbackNodes[index + 1]] : [];
        return backendPath.length > 1 ? backendPath : fallbackSegment;
      });
      const routeEstimated = routePositions.map((segment, index) => Boolean(routeSegments[index]?.estimated || (!routeSegments[index]?.path?.length && segment.length > 1)));
      const path = routePositions.filter((segment) => segment.length > 1).flatMap((segment, index) => index ? segment.slice(1) : segment);
      const overviewBounds = new maps.LatLngBounds();
      path.forEach((position) => overviewBounds.extend(position));
      if (!path.length) locatedSpots.forEach(({ location }) => overviewBounds.extend(new maps.LatLng(location.latitude, location.longitude)));
      const polyline = new maps.Polyline({
        map,
        path,
        strokeWeight: 6,
        strokeColor: "#aeb4b8",
        strokeOpacity: 0.78,
        strokeStyle: "solid"
      });
      mapRef.current = map;
      markersRef.current = markers;
      [hotelOverlay, startOverlay, destinationOverlay].filter(Boolean).forEach((overlay) => markersRef.current.push(overlay));
      polylineRef.current = polyline;
      routePositionsRef.current = routePositions;
      routeEstimatedRef.current = routeEstimated;
      const showInitialRoute = () => {
        maps.event.removeListener(map, "idle", showInitialRoute);
        if (cancelled) return;
        const initialPath = routePositions[0] || [];
        if (initialPath.length > 1) animateActiveRoute(map, initialPath, maps, routeEstimated[0]);
      };
      maps.event.addListener(map, "idle", showInitialRoute);
      map.setBounds(overviewBounds, 90, 90, 90, 90);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message);
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach(({ marker }) => marker.setMap(null));
      polylineRef.current?.setMap(null);
      clearActiveRoute();
      markersRef.current = [];
      polylineRef.current = null;
      routePositionsRef.current = [];
      routeEstimatedRef.current = [];
      mapRef.current = null;
    };
  }, [guide]);

  useEffect(() => {
    if (mapRef.current && window.kakao?.maps && routePositionsRef.current.length) {
      const activePath = routePositionsRef.current[active] || [];
      const requestId = ++focusRequestRef.current;
      const shouldMoveMap = focusKey !== lastFocusKeyRef.current;
      lastFocusKeyRef.current = focusKey;
      clearActiveRoute();
      const selected = markersRef.current.find((item) => item.index === active);
      if (activePath.length > 1 && shouldMoveMap) focusRoute(mapRef.current, activePath, window.kakao.maps, () => {
          if (focusRequestRef.current === requestId) animateActiveRoute(mapRef.current, activePath, window.kakao.maps, routeEstimatedRef.current[active]);
        });
      else if (activePath.length > 1) animateActiveRoute(mapRef.current, activePath, window.kakao.maps, routeEstimatedRef.current[active]);
      else {
        if (selected && shouldMoveMap) mapRef.current.panTo(selected.position);
      }
    }
  }, [active, focusKey]);

  return <>
    <div className="kakao-route-map-react" ref={containerRef} aria-label="카카오 지도 기반 추천 관광지 동선" />
    {error && <div className="kakao-map-status-react"><strong>지도 연동 준비 중</strong><p>{error}</p></div>}
  </>;
}
