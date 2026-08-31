let kakaoMapsPromise;

export function loadKakaoMaps(appKey) {
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao.maps.load(resolve));
  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
    script.async = true;
    script.addEventListener("load", () => window.kakao?.maps?.load(resolve), { once: true });
    script.addEventListener("error", () => reject(new Error("카카오 지도 SDK를 불러오지 못했습니다.")), { once: true });
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}

export async function searchKakaoPlaces(appKey, query, size = 10) {
  const keyword = String(query || "").trim();
  if (!keyword) return [];
  await loadKakaoMaps(appKey);
  const { maps } = window.kakao || {};
  if (!maps?.services?.Places) throw new Error("카카오 장소 검색 서비스를 불러오지 못했습니다.");
  return new Promise((resolve, reject) => {
    new maps.services.Places().keywordSearch(keyword, (items, status) => {
      if (status === maps.services.Status.ZERO_RESULT) { resolve([]); return; }
      if (status !== maps.services.Status.OK) { reject(new Error("카카오 장소 검색에 실패했습니다.")); return; }
      resolve(items.map((item) => ({ kakaoPlaceId: item.id, name: item.place_name, category: item.category_name, address: item.address_name, roadAddress: item.road_address_name, latitude: Number(item.y), longitude: Number(item.x), placeUrl: item.place_url })));
    }, { size: Math.max(1, Math.min(15, Number(size) || 10)) });
  });
}

export function kakaoCoordinates(item) {
  const latitude = Number(item?.latitude ?? item?.lat ?? item?.y);
  const longitude = Number(item?.longitude ?? item?.lng ?? item?.x);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}
