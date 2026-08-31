let kakaoMapsPromise;

export function loadKakaoMaps(appKey) {
  if (window.kakao?.maps) return new Promise((resolve) => window.kakao.maps.load(resolve));
  if (kakaoMapsPromise) return kakaoMapsPromise;

  kakaoMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.addEventListener("load", () => window.kakao?.maps?.load(resolve), { once: true });
    script.addEventListener("error", () => reject(new Error("카카오 지도 SDK를 불러오지 못했습니다.")), { once: true });
    document.head.appendChild(script);
  });

  return kakaoMapsPromise;
}

export function kakaoCoordinates(item) {
  const latitude = Number(item?.latitude ?? item?.lat ?? item?.y);
  const longitude = Number(item?.longitude ?? item?.lng ?? item?.x);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}
